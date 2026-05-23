import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const TEMPLATE_DIR = join(ROOT, "public", "templates");
const PAGE_DIR = join(TEMPLATE_DIR, "pages");
const OUTPUT = join(ROOT, "src", "pages_templates.ts");

const pageFiles = readdirSync(PAGE_DIR)
  .filter((file) => file.endsWith(".html"))
  .sort();

const pageEntries = pageFiles
  .map((file) => `  ${file.replace(".html", "")}: readFileSync(join(PAGE_DIR, "${file}"), "utf8")`)
  .join(",\n");

const content = `import { readFileSync } from "node:fs";
import { join } from "node:path";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const TEMPLATE_DIR = join(process.cwd(), "public", "templates");
const PAGE_DIR = join(TEMPLATE_DIR, "pages");

const APP_TEMPLATE = readFileSync(join(TEMPLATE_DIR, "app.html"), "utf8");
const MESSAGE_TEMPLATE = readFileSync(join(TEMPLATE_DIR, "message.html"), "utf8");
const PAGE_TEMPLATES = {
${pageEntries}
};

export function messagePage(title, message) {
  return MESSAGE_TEMPLATE
    .replace(/%%TITLE%%/g, escapeHtml(title))
    .replace(/%%MESSAGE%%/g, message);
}

export function appPage(page: string = "links", detail: any = {}) {
  const titles = { create: "단축하기", links: "대시보드", logs: "통계 분석", detail: "링크 정보", settings: "설정" };
  const pageTitle = titles[page] || titles.links;
  const main = (PAGE_TEMPLATES[page] || PAGE_TEMPLATES.links)
    .replace(/%%DETAIL_CODE%%/g, escapeHtml(detail.code || ""));

  return APP_TEMPLATE
    .replace(/%%PAGE_TITLE%%/g, escapeHtml(pageTitle))
    .replace(/%%PAGE%%/g, escapeHtml(page))
    .replace(/%%DETAIL_CODE%%/g, escapeHtml(detail.code || ""))
    .replace(/%%NAV_CREATE_CLASS%%/g, page === "create" ? "active" : "")
    .replace(/%%NAV_LINKS_CLASS%%/g, page === "links" ? "active" : "")
    .replace(/%%NAV_LOGS_CLASS%%/g, page === "logs" ? "active" : "")
    .replace(/%%NAV_SETTINGS_CLASS%%/g, page === "settings" ? "active" : "")
    .replace(/%%MAIN%%/g, main);
}
`;

writeFileSync(OUTPUT, content);
console.log("pages_templates.ts regenerated from public/templates.");
