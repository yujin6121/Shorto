export function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

export function sendHtml(res, html, status = 200) {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(html);
}

export function sendNotFound(res) {
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("Not found");
}

export async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "";
}

export function publicBaseUrl(req, port) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host || `localhost:${port}`;
  return `${proto}://${host}`;
}

export function parseDevice(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (/mobi|android|iphone|ipad|phone/i.test(ua)) {
    if (/ipad|tablet/i.test(ua)) return "Tablet";
    return "Mobile";
  }
  return "Desktop";
}

export function parseReferer(referer) {
  if (!referer) return "Direct";
  try {
    const url = new URL(referer);
    const host = url.hostname.toLowerCase();
    if (host.includes("google")) return "Google";
    if (host.includes("naver")) return "Naver";
    if (host.includes("daum") || host.includes("kakao")) return "Kakao/Daum";
    if (host.includes("facebook") || host.includes("instagram") || host.includes("t.co") || host.includes("twitter")) return "Social Media";
    return url.hostname;
  } catch {
    return "Unknown";
  }
}
