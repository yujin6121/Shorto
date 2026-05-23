import fs from 'fs';

let pagesTs = fs.readFileSync('src/pages.ts', 'utf8');

const settingsHtml = 
"      ${page === 'settings' ? `\n" +
"        <div class=\"card\" style=\"max-width:600px; margin: 0 auto; padding: 32px 24px;\">\n" +
"          <div class=\"card-header\">\n" +
"            <h2>앱 환경 설정</h2>\n" +
"          </div>\n" +
"          <div class=\"settings-list\">\n" +
"            <div class=\"settings-item flex-between form-group\" style=\"margin-bottom:0;\">\n" +
"              <div class=\"settings-label\">\n" +
"                <strong style=\"display:block; font-size:15px; margin-bottom:4px;\">화면 테마</strong>\n" +
"                <span style=\"font-size:13px; color:var(--text-secondary);\">시스템 기본값이나 다크 모드로 테마를 고정할 수 있습니다.</span>\n" +
"              </div>\n" +
"              <select id=\"settingTheme\" class=\"form-control\" style=\"width: 140px;\">\n" +
"                <option value=\"system\">시스템</option>\n" +
"                <option value=\"light\">라이트</option>\n" +
"                <option value=\"dark\">다크</option>\n" +
"              </select>\n" +
"            </div>\n" +
"            \n" +
"            <div class=\"settings-divider\"></div>\n" +
"            <div class=\"settings-item flex-between form-group\" style=\"margin-bottom:0;\">\n" +
"              <div class=\"settings-label\">\n" +
"                <strong style=\"display:block; font-size:15px; margin-bottom:4px;\">트랜지션 애니메이션 효과</strong>\n" +
"                <span style=\"font-size:13px; color:var(--text-secondary);\">버튼을 움직여 부드러운 애니메이션 효과를 끌 수 있습니다.</span>\n" +
"              </div>\n" +
"              <label class=\"toggle-switch\">\n" +
"                <input type=\"checkbox\" id=\"settingAnimation\" checked>\n" +
"                <span class=\"slider\"></span>\n" +
"              </label>\n" +
"            </div>\n" +
"            <div class=\"settings-divider\"></div>\n" +
"            <div class=\"settings-item flex-between form-group\" style=\"align-items:center; margin-bottom:0;\">\n" +
"              <div class=\"settings-label\">\n" +
"                <strong style=\"display:block; font-size:15px; margin-bottom:4px;\">브라우저 로컬 데이터 정리</strong>\n" +
"                <span style=\"font-size:13px; color:var(--text-secondary);\">저장된 설정 등 프론트엔드 캐시를 지웁니다.</span>\n" +
"              </div>\n" +
"              <button class=\"btn btn-danger btn-sm\" id=\"settingClearCache\" style=\"flex-shrink:0;\">데이터 비우기</button>\n" +
"            </div>\n" +
"          </div>\n" +
"        </div>\n" +
"      ` : ''}";

pagesTs = pagesTs.replace("</main>", settingsHtml + "\n    </main>");

pagesTs = pagesTs.replace(
  /const theme = localStorage.getItem\("theme"\) \|\| .*?;/g,
  `const stored = localStorage.getItem("theme");
    const theme = stored === "dark" || stored === "light" ? stored : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");`
);
fs.writeFileSync('src/pages.ts', pagesTs);

let serverTs = fs.readFileSync('server.ts', 'utf8');
serverTs = serverTs.replace(
  `if (req.method === "GET" && url.pathname === "/logs") {`,
  `if (req.method === "GET" && url.pathname === "/settings") {
      sendHtml(res, appPage("settings"));
      return;
    }

    if (req.method === "GET" && url.pathname === "/logs") {`
);
fs.writeFileSync('server.ts', serverTs);

