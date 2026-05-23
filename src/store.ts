import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { parseDevice, parseReferer } from "./http.js";

const DATA_DIR = join(process.cwd(), "data", "app");
const DB_FILE = join(DATA_DIR, "db.json");

const initialDb = {
  links: {},
  logs: [],
  domains: [],
  settings: {}
};

async function ensureDb() {
  await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(DB_FILE)) {
    await writeDb(initialDb);
  }
}

export async function readDb() {
  await ensureDb();
  const text = await readFile(DB_FILE, "utf8");
  if (!text.trim()) {
    await writeDb(initialDb);
    return {
      links: {},
      logs: [],
      domains: [],
      settings: {}
    };
  }
  let db;
  try {
    db = JSON.parse(text);
  } catch (err) {
    throw new Error(`데이터베이스 파일이 손상되었습니다: ${DB_FILE}`);
  }
  if (!db || typeof db !== "object") {
    throw new Error(`데이터베이스 형식이 올바르지 않습니다: ${DB_FILE}`);
  }
  db.links ||= {};
  db.logs ||= [];
  db.domains ||= [];
  db.settings ||= {};

  for (const link of Object.values(db.links) as any[]) {
    link.active = link.active !== false;
    link.expiresAt ??= null;
    link.lastClickedAt ??= null;
    link.clicks ||= 0;
    link.domains = Array.isArray(link.domains) ? link.domains : [];
    link.domain ??= link.domains[0] || null;
  }

  return db;
}

let writePromise = Promise.resolve();

export async function writeDb(data) {
  writePromise = writePromise.then(async () => {
    await mkdir(DATA_DIR, { recursive: true });
    const tmpFile = `${DB_FILE}.tmp`;
    await writeFile(tmpFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await rename(tmpFile, DB_FILE);
  });
  return writePromise;
}

export function logEvent(db, event) {
  const userAgent = event.userAgent || "";
  const referer = event.referer || "";
  db.logs.unshift({
    id: randomBytes(8).toString("hex"),
    at: new Date().toISOString(),
    ...event,
    device: parseDevice(userAgent),
    refererName: parseReferer(referer)
  });
  db.logs = db.logs.slice(0, 800);
}

export function makeCode(existing) {
  let code = "";
  do {
    code = randomBytes(4).toString("base64url").slice(0, 6);
  } while (existing[code]);
  return code;
}

export function isExpired(link) {
  return Boolean(link.expiresAt && new Date(link.expiresAt).getTime() < Date.now());
}

export function statusOf(link) {
  if (isExpired(link)) return "expired";
  if (link.active === false) return "inactive";
  return "active";
}

export function linksList(db) {
  return Object.values(db.links)
    .map((link: any) => ({ ...link, status: statusOf(link) }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function logsForCode(db, code) {
  return db.logs.filter((log) => log.code === code);
}
