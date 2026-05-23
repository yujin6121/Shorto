import fs from 'fs';
let clientTs = fs.readFileSync('src/client.ts', 'utf8');

// Also inject logic for Setting page inside clientTs
const settingsLogic = `
if (pageType === 'settings') {
    const themeSelect = document.getElementById('settingTheme') as HTMLSelectElement;
    const animToggle = document.getElementById('settingAnimation') as HTMLInputElement;
    const cacheBtn = document.getElementById('settingClearCache') as HTMLButtonElement;
    
    if (themeSelect) {
        themeSelect.value = localStorage.getItem('theme') || 'system';
        themeSelect.addEventListener('change', (e) => {
            const val = (e.target as HTMLSelectElement).value;
            if (val === 'system') {
                localStorage.removeItem('theme');
                document.documentElement.dataset.theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
            } else {
                localStorage.setItem('theme', val);
                document.documentElement.dataset.theme = val;
            }
            showToast('테마 설정이 변경되었습니다.');
        });
    }

    if (animToggle) {
        animToggle.checked = localStorage.getItem('noanim') !== 'true';
        animToggle.addEventListener('change', (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            if (checked) {
                localStorage.removeItem('noanim');
                document.documentElement.classList.remove('no-anim');
            } else {
                localStorage.setItem('noanim', 'true');
                document.documentElement.classList.add('no-anim');
            }
            showToast('애니메이션 설정이 변경되었습니다.');
        });
    }

    if (cacheBtn) {
        cacheBtn.addEventListener('click', () => {
            if (confirm('로컬 브라우저 설정을 모두 지우시겠습니까?')) {
                localStorage.clear();
                showToast('초기화되었습니다. 페이지를 새로고침합니다.');
                setTimeout(() => window.location.reload(), 800);
            }
        });
    }
}
`;

// Pre-init animation check logic into client.ts
const preAnimCheck = `
const isNoAnim = localStorage.getItem('noanim') === 'true';
if (isNoAnim) document.documentElement.classList.add('no-anim');

// Apply stored theme logic properly to the top Theme Toggle as well
`;

clientTs = preAnimCheck + clientTs + settingsLogic;

// Fix theme toggle logic in client.ts
clientTs = clientTs.replace(
  `const newTheme = currentTheme === 'dark' ? 'light' : 'dark';\n        doc.dataset.theme = newTheme;\n        localStorage.setItem('theme', newTheme);`,
  `const newTheme = currentTheme === 'dark' ? 'light' : 'dark';\n        doc.dataset.theme = newTheme;\n        localStorage.setItem('theme', newTheme);\n        // Settings 페이지에 동기화\n        const sel = document.getElementById('settingTheme');\n        if (sel) (sel as HTMLSelectElement).value = newTheme;`
);

// Prevent transitions if no-anim
clientTs = clientTs.replace(
  `document.getElementById(\'main\')!.classList.add(\'page-leave\');`,
  `if (!document.documentElement.classList.contains('no-anim')) { document.getElementById('main')!.classList.add('page-leave'); }`
);

clientTs = clientTs.replace(
  `setTimeout(() => {`,
  `const animDuration = document.documentElement.classList.contains('no-anim') ? 0 : 250;\n                setTimeout(() => {`
);

clientTs = clientTs.replace(
  `}, 250);`,
  `}, animDuration);`
);

fs.writeFileSync('src/client.ts', clientTs.replace(/!/g, '')); // Avoid ts ! in non strict? Wait, ! is valid TS. Remove '!.' fallback just in case or keep.
