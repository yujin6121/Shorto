import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes, createHash } from "node:crypto";

import { getClientIp, parseBody, publicBaseUrl, sendHtml, sendJson, sendNotFound } from "./src/http.js";
import { appPage, escapeHtml, messagePage } from "./src/pages_templates.js";
import { linksList, logEvent, logsForCode, makeCode, readDb, statusOf, writeDb } from "./src/store.js";
import { normalizeCode, normalizeDomain, normalizeExpiresAt, normalizeUrl } from "./src/validation.js";

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = join(process.cwd(), "public");
const NODE_MODULES_DIR = join(process.cwd(), "node_modules");

const assetTypes = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8"
};

function uniq(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").map(s => s.trim()).filter(Boolean).reduce((acc, pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return acc;
    const k = pair.slice(0, idx);
    const v = pair.slice(idx + 1);
    acc[k] = decodeURIComponent(v);
    return acc;
  }, {});
}

function hashPassword(pw) {
  return createHash('sha256').update(String(pw)).digest('hex');
}

// Load .env file if present (simple parser) so developers can set ADMIN_PASSWORD in a .env file.
try {
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const envText = readFileSync(envPath, 'utf8');
    for (const line of envText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch (err) {
  // ignore .env errors
}

const ADMIN_PW_HASH = process.env.ADMIN_PASSWORD ? hashPassword(process.env.ADMIN_PASSWORD) : null;

function configuredDomains(db, req) {
  return uniq([publicBaseUrl(req, PORT), ...(db.domains || [])]);
}

function defaultDomain(db, req) {
  const domains = configuredDomains(db, req);
  const configured = db.settings?.defaultDomain;
  return configured && domains.includes(configured) ? configured : domains[0];
}

function domainUsage(db, req) {
  const domains = configuredDomains(db, req);
  const usage = Object.fromEntries(domains.map((domain) => [domain, 0]));
  for (const rawLink of Object.values(db.links) as any[]) {
    const linkDomains = rawLink.domains?.length
      ? rawLink.domains
      : [rawLink.domain || defaultDomain(db, req)];
    for (const domain of linkDomains) {
      usage[domain] = (usage[domain] || 0) + 1;
    }
  }
  return usage;
}

function normalizeSelectedDomains(value) {
  const rawDomains = Array.isArray(value)
    ? value
    : value
      ? [value]
      : [];
  return uniq(rawDomains.map((domain) => normalizeDomain(domain)));
}

function shortUrlFor(domain, code) {
  return `${domain}/s/${encodeURIComponent(code)}`;
}

function decorateLink(link, req) {
  const domains = link.domains?.length ? link.domains : [link.domain || publicBaseUrl(req, PORT)];
  const shortUrls = domains.map((domain) => shortUrlFor(domain, link.code));
  return {
    ...link,
    domains,
    domain: domains[0],
    shortUrl: shortUrls[0],
    shortUrls,
    status: statusOf(link)
  };
}

async function requireAdmin(req, res) {
  const db = await readDb();
  const cookies = parseCookies(req);
  const token = cookies.session || cookies.admin_session || null;
  if (!token) return null;
  db.settings ||= {};
  db.settings.sessions ||= {};
  if (db.settings.sessions[token]) return { db, token };
  return null;
}

function findApiKey(db, key) {
  if (!db.settings || !Array.isArray(db.settings.apiKeys)) return null;
  return db.settings.apiKeys.find((k) => k.key === key) || null;
}

async function sendStaticAsset(req, res, pathname, prefix, baseDir) {
  const relative = normalize(pathname.replace(prefix, ""));
  if (relative.startsWith("..")) {
    sendNotFound(res);
    return;
  }

  try {
    const filePath = join(baseDir, relative);
    const contentType = assetTypes[extname(filePath)] || "application/octet-stream";
    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": contentType,
      "cache-control": "no-store"
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(body);
  } catch {
    sendNotFound(res);
  }
}

async function sendAsset(req, res, pathname) {
  await sendStaticAsset(req, res, pathname, "/assets/", PUBLIC_DIR);
}

async function sendVendorAsset(req, res, pathname) {
  await sendStaticAsset(req, res, pathname, "/vendor/", NODE_MODULES_DIR);
}

async function handleCreate(req, res) {
  try {
    const body = await parseBody(req);
    const targetUrl = normalizeUrl(body.url);
    // optional API key validation: if provided, must be valid
    const apiKeyHeader = (req.headers['x-api-key'] || req.headers['x_api_key'] || '') + '';
    if (apiKeyHeader) {
      const db = await readDb();
      if (!findApiKey(db, apiKeyHeader)) {
        sendJson(res, 401, { error: '유효하지 않은 API 키입니다.' });
        return;
      }
    }
    const db = await readDb();
    const availableDomains = configuredDomains(db, req);
    const selectedDomains = normalizeSelectedDomains(body.domains || body.domain);
    const domains = selectedDomains.length ? selectedDomains : [defaultDomain(db, req)];
    const invalidDomain = domains.find((domain) => !availableDomains.includes(domain));
    if (invalidDomain) {
      throw new Error("설정에 등록된 도메인만 선택할 수 있습니다.");
    }

    const customCode = normalizeCode(body.customCode);
    const code = customCode || makeCode(db.links);

    if (db.links[code]) {
      throw new Error("이미 사용 중인 짧은 코드입니다.");
    }

    const now = new Date().toISOString();
    const expiresAt = normalizeExpiresAt(body.expiresAt);

    db.links[code] = {
      code,
      targetUrl,
      createdAt: now,
      expiresAt,
      active: true,
      clicks: 0,
      lastClickedAt: null,
      domain: domains[0],
      domains
    };

    logEvent(db, {
      type: "created",
      code,
      targetUrl,
      ip: getClientIp(req),
      userAgent: req.headers["user-agent"] || "",
      referer: req.headers["referer"] || ""
    });

    await writeDb(db);

    sendJson(res, 201, {
      ...decorateLink(db.links[code], req),
      status: "active"
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "URL을 만들 수 없어요." });
  }
}

async function handleToggle(req, res, code) {
  const db = await readDb();
  const link = db.links[code];
  if (!link) {
    sendJson(res, 404, { error: "링크를 찾을 수 없습니다." });
    return;
  }

  const body = await parseBody(req);
  link.active = body.active !== false;
  logEvent(db, {
    type: link.active ? "enabled" : "disabled",
    code,
    targetUrl: link.targetUrl,
    ip: getClientIp(req),
    userAgent: req.headers["user-agent"] || "",
    referer: req.headers["referer"] || ""
  });
  await writeDb(db);
  sendJson(res, 200, { ...link, status: statusOf(link) });
}

async function handleDelete(req, res, code) {
  const db = await readDb();
  const link = db.links[code];
  if (!link) {
    sendJson(res, 404, { error: "링크를 찾을 수 없습니다." });
    return;
  }

  logEvent(db, {
    type: "deleted",
    code,
    targetUrl: link.targetUrl,
    ip: getClientIp(req),
    userAgent: req.headers["user-agent"] || "",
    referer: req.headers["referer"] || ""
  });
  delete db.links[code];
  await writeDb(db);
  sendJson(res, 200, { ok: true });
}

async function handleRedirect(req, res, code) {
  const db = await readDb();
  const link = db.links[code];

  if (!link) {
    logEvent(db, {
      type: "missing",
      code,
      ip: getClientIp(req),
      userAgent: req.headers["user-agent"] || "",
      referer: req.headers["referer"] || ""
    });
    await writeDb(db);
    sendHtml(res, messagePage("짧은 링크가 없어요", `${escapeHtml(code)} 코드를 찾지 못했습니다.`), 404);
    return;
  }

  const status = statusOf(link);
  if (status !== "active") {
    logEvent(db, {
      type: status,
      code,
      targetUrl: link.targetUrl,
      ip: getClientIp(req),
      userAgent: req.headers["user-agent"] || "",
      referer: req.headers["referer"] || ""
    });
    await writeDb(db);
    const title = status === "expired" ? "만료된 링크입니다" : "비활성화된 링크입니다";
    sendHtml(res, messagePage(title, "관리자가 이 짧은 링크의 이동을 막아두었습니다."), 410);
    return;
  }

  link.clicks += 1;
  link.lastClickedAt = new Date().toISOString();
  logEvent(db, {
    type: "visited",
    code,
    targetUrl: link.targetUrl,
    ip: getClientIp(req),
    userAgent: req.headers["user-agent"] || "",
    referer: req.headers["referer"] || ""
  });
  await writeDb(db);

  res.writeHead(302, {
    location: link.targetUrl,
    "cache-control": "no-store"
  });
  res.end();
}

function paginate(items, url) {
  const page = Math.max(Number(url.searchParams.get("page") || 1), 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || items.length || 10), 1), 100);
  const start = (page - 1) * limit;
  return {
    page,
    limit,
    total: items.length,
    items: items.slice(start, start + limit)
  };
}

async function handleLinks(req, res, url) {
  const db = await readDb();
  const query = String(url.searchParams.get("q") || "").toLowerCase();
  const domain = url.searchParams.get("domain") || "";
  const links = linksList(db)
    .map((link) => decorateLink(link, req))
    .filter((link) => !domain || link.domains?.includes(domain))
    .filter((link) => {
      if (!query) return true;
      return [
        link.code,
        link.targetUrl,
        link.shortUrl,
        ...(link.domains || [])
      ].some((value) => String(value || "").toLowerCase().includes(query));
    });
  const page = paginate(links, url);
  sendJson(res, 200, {
    links: page.items,
    total: page.total,
    page: page.page,
    limit: page.limit
  });
}

async function handleStats(req, res) {
  const db = await readDb();
  sendJson(res, 200, {
    links: linksList(db).map((link) => decorateLink(link, req)),
    logs: db.logs,
    domains: configuredDomains(db, req),
    defaultDomain: defaultDomain(db, req),
    domainUsage: domainUsage(db, req)
  });
}

async function handleLogs(_req, res, url) {
  const db = await readDb();
  const event = url.searchParams.get("event") || "all";
  const code = url.searchParams.get("code") || "";
  const logs = db.logs
    .filter((log) => !code || log.code === code)
    .filter((log) => {
      if (event === "all") return true;
      if (event === "blocked") return ["missing", "expired", "inactive"].includes(log.type);
      if (event === "admin") return ["created", "enabled", "disabled", "deleted"].includes(log.type);
      return log.type === event;
    })
    .map((log) => ({
      ...log,
      timestamp: log.at,
      event: log.type
    }));
  const page = paginate(logs, url);
  sendJson(res, 200, {
    logs: page.items,
    total: page.total,
    page: page.page,
    limit: page.limit,
    metrics: {
      visited: db.logs.filter((log) => log.type === "visited").length,
      created: Object.values(db.links).filter((link: any) => statusOf(link) === "active").length,
      blocked: db.logs.filter((log) => ["missing", "expired", "inactive"].includes(log.type)).length
    }
  });
}

async function handleAnalytics(_req, res) {
  const db = await readDb();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
  const dailyVisits = days.map((date) => ({
    date,
    count: db.logs.filter((log) => log.type === "visited" && String(log.at).startsWith(date)).length
  }));
  const devices = db.logs
    .filter((log) => log.type === "visited")
    .reduce((acc, log) => {
      const key = log.device || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  sendJson(res, 200, { dailyVisits, devices });
}

async function handleLinkDetail(req, res, code) {
  const db = await readDb();
  const link = db.links[code];
  if (!link) {
    sendJson(res, 404, { error: "링크를 찾을 수 없습니다." });
    return;
  }

  sendJson(res, 200, {
    ...decorateLink(link, req),
    link: decorateLink(link, req),
    logs: logsForCode(db, code)
  });
}

async function detailPage(req, res, code) {
  const db = await readDb();
  const link = db.links[code];
  if (!link) {
    sendHtml(res, messagePage("상세 정보를 찾을 수 없어요", `${escapeHtml(code)} 링크가 없습니다.`), 404);
    return;
  }

  sendHtml(res, appPage("detail", {
    code,
    shortUrl: decorateLink(link, req).shortUrl,
    targetUrl: link.targetUrl
  }));
}

function safeDecode(str) {
  try {
    return decodeURIComponent(str);
  } catch {
    return null;
  }
}

async function handleUpdate(req, res, code) {
  try {
    const body = await parseBody(req);
    const db = await readDb();
    const link = db.links[code];
    if (!link) {
      sendJson(res, 404, { error: "링크를 찾을 수 없습니다." });
      return;
    }

    if (typeof body.active === "boolean" || typeof body.isActive === "boolean") {
      link.active = typeof body.active === "boolean" ? body.active : body.isActive;
      logEvent(db, {
        type: link.active ? "enabled" : "disabled",
        code,
        targetUrl: link.targetUrl,
        ip: getClientIp(req),
        userAgent: req.headers["user-agent"] || "",
        referer: req.headers["referer"] || ""
      });
      await writeDb(db);
      sendJson(res, 200, decorateLink(link, req));
      return;
    }

    const targetUrl = normalizeUrl(body.url || body.targetUrl);
    const expiresAt = normalizeExpiresAt(body.expiresAt);
    if ("domains" in body || "domain" in body) {
      const availableDomains = configuredDomains(db, req);
      const selectedDomains = normalizeSelectedDomains(body.domains || body.domain);
      const domains = selectedDomains.length ? selectedDomains : [defaultDomain(db, req)];
      const invalidDomain = domains.find((domain) => !availableDomains.includes(domain));
      if (invalidDomain) {
        throw new Error("설정에 등록된 도메인만 선택할 수 있습니다.");
      }
      link.domains = domains;
      link.domain = domains[0];
    }
    const oldTarget = link.targetUrl;
    link.targetUrl = targetUrl;
    link.expiresAt = expiresAt;

    logEvent(db, {
      type: "enabled",
      code,
      targetUrl: `수정됨: ${oldTarget} -> ${targetUrl}`,
      ip: getClientIp(req),
      userAgent: req.headers["user-agent"] || "",
      referer: req.headers["referer"] || ""
    });

    await writeDb(db);
    sendJson(res, 200, decorateLink(link, req));
  } catch (error) {
    sendJson(res, 400, { error: error.message || "링크를 수정할 수 없어요." });
  }
}

async function handleGetDomains(req, res) {
  const db = await readDb();
  sendJson(res, 200, {
    domains: configuredDomains(db, req),
    defaultDomain: defaultDomain(db, req),
    usage: domainUsage(db, req)
  });
}

async function handleAddDomain(req, res) {
  try {
    const body = await parseBody(req);
    const domain = normalizeDomain(body.domain);
    const db = await readDb();
    db.domains = uniq([...(db.domains || []), domain]);
    db.settings ||= {};
    db.settings.defaultDomain ||= defaultDomain(db, req);
    await writeDb(db);
    sendJson(res, 201, {
      domains: configuredDomains(db, req),
      defaultDomain: defaultDomain(db, req),
      usage: domainUsage(db, req),
      domain
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "도메인을 추가할 수 없어요." });
  }
}

async function handleDeleteDomain(req, res, domainValue) {
  const domain = normalizeDomain(domainValue);
  const db = await readDb();
  if (domain === publicBaseUrl(req, PORT)) {
    sendJson(res, 400, { error: "현재 접속 중인 도메인은 삭제할 수 없습니다." });
    return;
  }
  const usage = domainUsage(db, req)[domain] || 0;
  const force = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`).searchParams.get("force") === "true";
  if (usage > 0 && !force) {
    sendJson(res, 409, {
      error: "이 도메인을 사용하는 링크가 있습니다.",
      domain,
      usage
    });
    return;
  }

  db.domains = (db.domains || []).filter((item) => item !== domain);
  db.settings ||= {};
  if (db.settings.defaultDomain === domain) {
    delete db.settings.defaultDomain;
  }
  for (const link of Object.values(db.links) as any[]) {
    link.domains = (link.domains || []).filter((item) => item !== domain);
    if (!link.domains.length) {
      link.domains = [defaultDomain(db, req)];
    }
    link.domain = link.domains[0];
  }
  await writeDb(db);
  sendJson(res, 200, {
    domains: configuredDomains(db, req),
    defaultDomain: defaultDomain(db, req),
    usage: domainUsage(db, req)
  });
}

async function handleSetDefaultDomain(req, res) {
  try {
    const body = await parseBody(req);
    const domain = normalizeDomain(body.domain);
    const db = await readDb();
    const domains = configuredDomains(db, req);
    if (!domains.includes(domain)) {
      throw new Error("설정에 등록된 도메인만 기본값으로 지정할 수 있습니다.");
    }
    db.settings ||= {};
    db.settings.defaultDomain = domain;
    await writeDb(db);
    sendJson(res, 200, {
      domains,
      defaultDomain: defaultDomain(db, req),
      usage: domainUsage(db, req)
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "기본 도메인을 변경할 수 없어요." });
  }
}

async function handleAdminLogin(req, res) {
  try {
    const body = await parseBody(req);
    const pw = String(body.password || "");
    if (!pw) throw new Error('비밀번호를 입력하세요.');
    const hashed = hashPassword(pw);
    // If ADMIN_PASSWORD is provided via env/.env, prefer that and do not write to DB
    if (ADMIN_PW_HASH) {
      if (hashed !== ADMIN_PW_HASH) {
        sendJson(res, 401, { error: '비밀번호가 일치하지 않습니다.' });
        return;
      }
      const db = await readDb();
      db.settings ||= {};
      db.settings.sessions ||= {};
      const token = randomBytes(18).toString('hex');
      db.settings.sessions[token] = { createdAt: new Date().toISOString(), via: 'env' };
      await writeDb(db);
      res.setHeader('Set-Cookie', `session=${encodeURIComponent(token)}; HttpOnly; Path=/`);
      sendJson(res, 200, { ok: true });
      return;
    }

    const db = await readDb();
    db.settings ||= {};
    const stored = db.settings.adminPassword || null;
    if (!stored) {
      // bootstrap admin password (store hashed in db)
      db.settings.adminPassword = hashed;
    } else if (stored !== hashed) {
      sendJson(res, 401, { error: '비밀번호가 일치하지 않습니다.' });
      return;
    }
    db.settings.sessions ||= {};
    const token = randomBytes(18).toString('hex');
    db.settings.sessions[token] = { createdAt: new Date().toISOString() };
    await writeDb(db);
    res.setHeader('Set-Cookie', `session=${encodeURIComponent(token)}; HttpOnly; Path=/`);
    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 400, { error: err.message || '로그인 실패' });
  }
}

async function handleAdminLogout(req, res) {
  try {
    const cookies = parseCookies(req);
    const token = cookies.session || null;
    const db = await readDb();
    if (token && db.settings?.sessions) delete db.settings.sessions[token];
    await writeDb(db);
    res.setHeader('Set-Cookie', `session=; HttpOnly; Path=/; Max-Age=0`);
    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 500, { error: '로그아웃 실패' });
  }
}

async function handleGetApiKeys(req, res) {
  const auth = await requireAdmin(req, res);
  if (!auth) { sendJson(res, 401, { error: '권한이 필요합니다.' }); return; }
  const db = auth.db;
  db.settings ||= {};
  db.settings.apiKeys ||= [];
  sendJson(res, 200, { apiKeys: db.settings.apiKeys.map(k => ({ label: k.label, createdAt: k.createdAt, id: k.id })) });
}

async function handleCreateApiKey(req, res) {
  const auth = await requireAdmin(req, res);
  if (!auth) { sendJson(res, 401, { error: '권한이 필요합니다.' }); return; }
  try {
    const body = await parseBody(req);
    const label = String(body.label || '');
    const db = auth.db;
    db.settings ||= {};
    db.settings.apiKeys ||= [];
    const key = randomBytes(24).toString('hex');
    const id = randomBytes(6).toString('hex');
    const entry = { id, key, label, createdAt: new Date().toISOString() };
    db.settings.apiKeys.push(entry);
    await writeDb(db);
    sendJson(res, 201, { id: entry.id, key: entry.key, label: entry.label, createdAt: entry.createdAt });
  } catch (err) {
    sendJson(res, 400, { error: 'API 키 생성 실패' });
  }
}

async function handleDeleteApiKey(req, res, keyId) {
  const auth = await requireAdmin(req, res);
  if (!auth) { sendJson(res, 401, { error: '권한이 필요합니다.' }); return; }
  try {
    const db = auth.db;
    db.settings ||= {};
    db.settings.apiKeys ||= [];
    db.settings.apiKeys = db.settings.apiKeys.filter(k => k.id !== keyId && k.key !== keyId);
    await writeDb(db);
    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 400, { error: '삭제 실패' });
  }
}

async function handleQrProxy(req, res, urlObj) {
  try {
    const data = urlObj.searchParams.get('data') || '';
    const size = urlObj.searchParams.get('size') || '300x300';
    const format = (urlObj.searchParams.get('format') || 'png').toLowerCase();
    const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${encodeURIComponent(size)}&data=${encodeURIComponent(data)}&format=${encodeURIComponent(format)}`;
    const r = await fetch(apiUrl);
    if (!r.ok) { sendJson(res, 502, { error: 'QR 제공자 오류' }); return; }
    const buffer = await r.arrayBuffer();
    res.writeHead(200, { 'content-type': r.headers.get('content-type') || 'image/png', 'cache-control': 'no-store' });
    res.end(Buffer.from(buffer));
  } catch (err) {
    sendJson(res, 500, { error: 'QR 생성 실패' });
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const linkMatch = url.pathname.match(/^\/api\/links\/([^/]+)$/);
    const toggleMatch = url.pathname.match(/^\/api\/links\/([^/]+)\/toggle$/);
    const updateMatch = url.pathname.match(/^\/api\/links\/([^/]+)\/update$/);
    const domainMatch = url.pathname.match(/^\/api\/domains\/(.+)$/);
    const detailMatch = url.pathname.match(/^\/links\/([^/]+)$/);

    if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/assets/")) {
      await sendAsset(req, res, url.pathname);
      return;
    }

    if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/vendor/")) {
      await sendVendorAsset(req, res, url.pathname);
      return;
    }

    if (req.method === "GET" && url.pathname === "/") {
      sendHtml(res, appPage("create"));
      return;
    }

    if (req.method === "GET" && url.pathname === "/links") {
      sendHtml(res, appPage("links"));
      return;
    }

    if (req.method === "GET" && url.pathname === "/settings") {
      sendHtml(res, appPage("settings"));
      return;
    }

    if (req.method === "GET" && url.pathname === "/logs") {
      sendHtml(res, appPage("logs"));
      return;
    }

    if (req.method === "GET" && detailMatch) {
      const code = safeDecode(detailMatch[1]);
      if (!code) {
        sendNotFound(res);
        return;
      }
      await detailPage(req, res, code);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/shorten") {
      await handleCreate(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/links") {
      await handleLinks(req, res, url);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/stats") {
      await handleStats(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/logs") {
      await handleLogs(req, res, url);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/analytics") {
      await handleAnalytics(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/qr") {
      await handleQrProxy(req, res, url);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/login") {
      await handleAdminLogin(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/logout") {
      await handleAdminLogout(req, res);
      return;
    }

    if (url.pathname === '/api/apikeys' && req.method === 'GET') {
      await handleGetApiKeys(req, res);
      return;
    }

    if (url.pathname === '/api/apikeys' && req.method === 'POST') {
      await handleCreateApiKey(req, res);
      return;
    }

    const apikeyDeleteMatch = url.pathname.match(/^\/api\/apikeys\/(.+)$/);
    if (req.method === 'DELETE' && apikeyDeleteMatch) {
      const id = safeDecode(apikeyDeleteMatch[1]);
      if (!id) { sendJson(res, 400, { error: '잘못된 키 id' }); return; }
      await handleDeleteApiKey(req, res, id);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/domains") {
      await handleGetDomains(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/domains") {
      await handleAddDomain(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/domains/default") {
      await handleSetDefaultDomain(req, res);
      return;
    }

    if (req.method === "DELETE" && domainMatch) {
      const domain = safeDecode(domainMatch[1]);
      if (!domain) {
        sendJson(res, 400, { error: "잘못된 도메인입니다." });
        return;
      }
      await handleDeleteDomain(req, res, domain);
      return;
    }

    if (req.method === "GET" && linkMatch) {
      const code = safeDecode(linkMatch[1]);
      if (!code) {
        sendNotFound(res);
        return;
      }
      await handleLinkDetail(req, res, code);
      return;
    }

    if (req.method === "POST" && toggleMatch) {
      const code = safeDecode(toggleMatch[1]);
      if (!code) {
        sendJson(res, 400, { error: "잘못된 링크 코드입니다." });
        return;
      }
      await handleToggle(req, res, code);
      return;
    }

    if (req.method === "POST" && updateMatch) {
      const code = safeDecode(updateMatch[1]);
      if (!code) {
        sendJson(res, 400, { error: "잘못된 링크 코드입니다." });
        return;
      }
      await handleUpdate(req, res, code);
      return;
    }

    if (req.method === "PUT" && linkMatch) {
      const code = safeDecode(linkMatch[1]);
      if (!code) {
        sendJson(res, 400, { error: "잘못된 링크 코드입니다." });
        return;
      }
      await handleUpdate(req, res, code);
      return;
    }

    if (req.method === "DELETE" && linkMatch) {
      const code = safeDecode(linkMatch[1]);
      if (!code) {
        sendJson(res, 400, { error: "잘못된 링크 코드입니다." });
        return;
      }
      await handleDelete(req, res, code);
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/s/")) {
      const code = safeDecode(url.pathname.slice(3));
      if (!code) {
        sendNotFound(res);
        return;
      }
      await handleRedirect(req, res, code);
      return;
    }

    sendNotFound(res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "서버에서 문제가 생겼어요." });
  }
});

server.listen(PORT, () => {
  console.log(`Shorto running at http://localhost:${PORT}`);
});
