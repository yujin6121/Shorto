export function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    throw new Error("URL을 입력해 주세요.");
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("http 또는 https URL만 사용할 수 있어요.");
  }

  return url.toString();
}

export function normalizeCode(value) {
  const code = String(value || "").trim();
  if (!code) return "";
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(code)) {
    throw new Error("커스텀 코드는 영문, 숫자, -, _ 조합 3~32자로 입력해 주세요.");
  }
  return code;
}

export function normalizeExpiresAt(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(`${raw}T23:59:59.999`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("만료 날짜 형식이 올바르지 않습니다.");
  }
  return date.toISOString();
}

export function normalizeDomain(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    throw new Error("도메인을 입력해 주세요.");
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("도메인은 http 또는 https 주소만 사용할 수 있어요.");
  }

  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("도메인은 경로 없이 origin 형식으로 입력해 주세요.");
  }

  return url.origin;
}
