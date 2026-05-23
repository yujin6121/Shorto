function escapeHtml(value: any) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function showToast(message: string, type: string = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function renderLinkStatus(link: any) {
    if (link.status === 'expired') return '<span class="badge badge-inactive">만료됨</span>';
    if (link.status === 'inactive' || link.active === false || link.isActive === false) return '<span class="badge badge-inactive">비활성</span>';
    return '<span class="badge badge-active">활성</span>';
}

async function fetchDomains() {
    const res = await fetch('/api/domains');
    const data = await res.json();
    return data.domains || [];
}

async function fetchDomainSettings() {
    const res = await fetch('/api/domains');
    return res.json();
}

function renderDomainPicker(container: HTMLElement | null, domains: string[], selectedDomains: string[] = [], defaultDomain?: string) {
    if (!container) return;
    const selected = new Set(selectedDomains.length ? selectedDomains : [defaultDomain || domains[0]].filter(Boolean));
    container.innerHTML = domains
        .map((domain: string) => `
            <label class="domain-option">
              <input type="checkbox" name="domains" value="${escapeHtml(domain)}" ${selected.has(domain) ? 'checked' : ''}>
              <span class="domain-check"></span>
              <span class="domain-option-text">${escapeHtml(domain)}</span>
              ${domain === defaultDomain ? '<span class="domain-default-mark">기본</span>' : ''}
            </label>
        `)
        .join('');
}

function selectedDomainsFrom(container: HTMLElement | null) {
    if (!container) return [];
    return Array.from(container.querySelectorAll<HTMLInputElement>('input[name="domains"]:checked'))
        .map((input) => input.value);
}

function renderLinks(links: any[]) {
    const tbody = document.getElementById('linksBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (links.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 40px; color: var(--text-secondary);">등록된 링크가 없습니다.</td></tr>';
        return;
    }

    links.forEach(link => {
        const shortUrl = link.shortUrl || `${window.location.origin}/s/${link.code}`;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
              <a href="/links/${link.code}" style="font-weight:600; color:var(--primary-color);">${escapeHtml(shortUrl)}</a>
              ${link.shortUrls?.length > 1 ? `<div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">도메인 ${link.shortUrls.length}개</div>` : ''}
            </td>
            <td>
              <a href="${escapeHtml(link.targetUrl)}" target="_blank" class="text-trunc" style="color:var(--text-secondary);" title="${escapeHtml(link.targetUrl)}">${escapeHtml(link.targetUrl)}</a>
            </td>
            <td>${renderLinkStatus(link)}</td>
            <td>
              <div class="flex-gap">
                <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${escapeHtml(shortUrl)}'); showToast('복사되었습니다.')">복사</button>
                <a href="/links/${link.code}" class="btn btn-secondary btn-sm">관리</a>
              </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderPagination(total: number, page: number, limit: number, onPageClick: (page: number) => void, containerId: string = 'pagination') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const totalPages = Math.ceil(total / limit);
    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = `btn btn-sm ${i === page ? 'btn-primary' : 'btn-secondary'}`;
        btn.textContent = String(i);
        btn.onclick = () => onPageClick(i);
        container.appendChild(btn);
    }
}

// CREATE PAGE
const createForm = document.getElementById('createForm') as HTMLFormElement;
if (createForm) {
    const domainPicker = document.getElementById('domainPicker') as HTMLElement;
    const expiresAtInput = document.getElementById('expiresAtInput') as HTMLInputElement;
    function selectedCreateDomains() {
        return selectedDomainsFrom(domainPicker);
    }

    function resetCreateDomains() {
        fetchDomainSettings()
            .then((data) => renderDomainPicker(domainPicker, data.domains || [], [], data.defaultDomain))
            .catch(() => {});
    }

    fetchDomainSettings()
        .then((data) => renderDomainPicker(domainPicker, data.domains || [], [], data.defaultDomain))
        .catch(() => showToast('도메인 목록을 불러오지 못했습니다.', 'error'));

    if (expiresAtInput) {
        expiresAtInput.addEventListener('focus', () => {
            expiresAtInput.type = 'date';
        });
        expiresAtInput.addEventListener('blur', () => {
            if (!expiresAtInput.value) {
                expiresAtInput.type = 'text';
            }
        });
    }

    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selectedDomains = selectedCreateDomains();
        const payload = {
            url: (document.getElementById('urlInput') as HTMLInputElement).value,
            customCode: (document.getElementById('customCodeInput') as HTMLInputElement).value || undefined,
            expiresAt: (document.getElementById('expiresAtInput') as HTMLInputElement).value || undefined,
            domains: selectedDomains
        };

        try {
            const res = await fetch('/api/shorten', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok) {
                const shortUrls = data.shortUrls?.length ? data.shortUrls : [data.shortUrl];
                const primaryUrl = shortUrls[0];
                (document.getElementById('result') as HTMLElement).style.display = 'flex';
                const resultLinks = document.getElementById('resultLinks') as HTMLElement;
                resultLinks.innerHTML = shortUrls
                    .map((shortUrl: string) => `<a href="${escapeHtml(shortUrl)}" target="_blank" class="short-link-display">${escapeHtml(shortUrl)}</a>`)
                    .join('');
                
                (document.getElementById('copyButton') as HTMLElement).onclick = (btnE) => {
                    (btnE as MouseEvent).preventDefault();
                    navigator.clipboard.writeText(shortUrls.join('\n'));
                    showToast('클립보드에 복사되었습니다.');
                };
                showToast('링크가 생성되었습니다.');
                createForm.reset();
                if (primaryUrl) resetCreateDomains();
            } else {
                showToast(data.error || '생성 실패', 'error');
            }
        } catch (err) {
            showToast('서버 통신 오류', 'error');
        }
    });
}

const pageType = document.body.dataset.page;

if (pageType === 'links') {
    let currentPage = 1;
    let currentSearch = '';
    let currentDomain = '';
    function loadLinks(page: number = 1, searchQuery: string = currentSearch, domain: string = currentDomain) {
        currentSearch = searchQuery;
        currentDomain = domain;
        const q = searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : '';
        const d = domain ? `&domain=${encodeURIComponent(domain)}` : '';
        fetch(`/api/links?page=${page}&limit=10${q}${d}`)
            .then(res => res.json())
            .then(data => {
                currentPage = page;
                (document.getElementById('linkCount') as HTMLElement).textContent = data.total;
                renderLinks(data.links);
                renderPagination(data.total, page, 10, (p) => loadLinks(p, searchQuery, domain));
            });
    }

    fetchDomains()
        .then((domains) => {
            const filter = document.getElementById('domainFilter') as HTMLSelectElement;
            if (!filter) return;
            filter.innerHTML = '<option value="">전체 도메인</option>' + domains
                .map((domain: string) => `<option value="${escapeHtml(domain)}">${escapeHtml(domain)}</option>`)
                .join('');
        })
        .catch(() => {});

    loadLinks();
    
    document.getElementById('linkSearchInput')?.addEventListener('input', (e) => {
        loadLinks(1, (e.target as HTMLInputElement).value, currentDomain);
    });

    document.getElementById('domainFilter')?.addEventListener('change', (e) => {
        loadLinks(1, currentSearch, (e.target as HTMLSelectElement).value);
    });
}

if (pageType === 'logs') {
    let logsPage = 1;
    function loadLogs(page: number = 1, eventType: string = 'all') {
        const evt = eventType !== 'all' ? `&event=${eventType}` : '';
        fetch(`/api/logs?page=${page}&limit=10${evt}`)
            .then(res => res.json())
            .then(data => {
                logsPage = page;
                (document.getElementById('metricVisited') as HTMLElement).textContent = data.metrics.visited;
                (document.getElementById('metricCreated') as HTMLElement).textContent = data.metrics.created;
                (document.getElementById('metricBlocked') as HTMLElement).textContent = data.metrics.blocked;
                (document.getElementById('metricTotal') as HTMLElement).textContent = data.total;

                const tbody = document.getElementById('logsBody');
                if(!tbody) return;
                tbody.innerHTML = '';
                if(data.logs.length === 0) {
                     tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">기록이 없습니다.</td></tr>';
                } else {
                    data.logs.forEach((log: any) => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td style="color:var(--text-secondary)">${new Date(log.timestamp).toLocaleString()}</td>
                            <td><span class="badge ${log.event === 'visited' ? 'badge-active' : (log.event==='created'?'badge-created':'badge-inactive')}">${log.event}</span></td>
                            <td>${escapeHtml(log.code || '-')}</td>
                            <td class="text-trunc" title="${escapeHtml(log.ip)} · ${escapeHtml(log.userAgent)}">${escapeHtml(log.ip)}</td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
                renderPagination(data.total, page, 10, (p) => loadLogs(p, eventType), 'logsPagination');
            });
    }

    function renderAnalytics() {
        fetch('/api/analytics')
           .then(res => res.json())
           .then(data => {
                const visitChart = document.getElementById('visitChart');
                if(visitChart) {
                    visitChart.innerHTML = '';
                    const maxV = Math.max(...data.dailyVisits.map((d:any)=>d.count), 1);
                    data.dailyVisits.forEach((d:any) => {
                        const h = Math.max((d.count / maxV) * 100, 5);
                        visitChart.innerHTML += `
                            <div class="chart-col">
                              <div class="chart-bar" style="height: ${h}%;" title="${d.date}: ${d.count}명"></div>
                              <span class="chart-label">${d.date.split('-')[2]}일</span>
                            </div>
                        `;
                    });
                }

                const devChart = document.getElementById('deviceChart');
                if(devChart) {
                    devChart.innerHTML = '';
                    let maxD = Math.max(...(Object.values(data.devices) as number[]), 1);
                    for(const [dev, count] of Object.entries(data.devices)) {
                        const pct = ((count as number) / maxD) * 100;
                        devChart.innerHTML += `
                            <div class="h-bar-container">
                                <div class="h-bar-info"><span>${dev}</span><span>${count}</span></div>
                                <div class="h-bar-bg"><div class="h-bar-fill" style="width: ${pct}%"></div></div>
                            </div>
                        `;
                    }
                }
           });
    }

    loadLogs();
    renderAnalytics();
    
    document.getElementById('logFilter')?.addEventListener('change', (e) => {
        loadLogs(1, (e.target as HTMLSelectElement).value);
    });
}

if (pageType === 'detail') {
    const code = document.body.dataset.detailCode;
    let currentDetail: any = null;
    
    function loadDetail() {
        if (!code) return;
        fetch(`/api/links/${code}`)
            .then(res => {
                if(!res.ok) { showToast('링크를 찾을 수 없습니다.', 'error'); return; }
                return res.json();
            })
            .then(data => {
                currentDetail = data;
                const shortUrl = data.shortUrl || `${window.location.origin}/s/${data.code}`;
                (document.getElementById('detailShortUrl') as HTMLAnchorElement).href = shortUrl;
                (document.getElementById('detailShortUrl') as HTMLElement).textContent = data.shortUrls?.join('\n') || shortUrl;
                (document.getElementById('detailTargetUrl') as HTMLElement).innerHTML = `<a href="${escapeHtml(data.targetUrl)}" target="_blank" style="color:var(--text-secondary);">${escapeHtml(data.targetUrl)}</a>`;
                (document.getElementById('detailExpiry') as HTMLElement).textContent = data.expiresAt ? new Date(data.expiresAt).toLocaleString() : '무기한';
                (document.getElementById('detailStatus') as HTMLElement).outerHTML = renderLinkStatus(data);
                
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shortUrl)}`;
                (document.getElementById('detailQr') as HTMLImageElement).src = qrUrl;

                (document.querySelector('[data-copy]') as HTMLElement).onclick = () => {
                    navigator.clipboard.writeText(shortUrl);
                    showToast('복사되었습니다.');
                };
                
                (document.querySelector('[data-download-qr]') as HTMLElement).onclick = () => {
                    const dl = `/api/qr?data=${encodeURIComponent(shortUrl)}&size=800x800&format=png`;
                    window.open(dl, '_blank');
                };

                const toggleBtn = document.getElementById('detailToggleButton');
                if (toggleBtn) {
                     toggleBtn.textContent = data.active !== false ? '사용 중지' : '활성화';
                     toggleBtn.onclick = async () => {
                         await fetch(`/api/links/${code}`, {
                             method: 'PUT',
                             headers: {'Content-Type':'application/json'},
                             body: JSON.stringify({ active: data.active === false })
                         });
                         loadDetail();
                     };
                }

                (document.querySelector('[data-edit]') as HTMLElement).onclick = () => {
                    (document.getElementById('editUrlInput') as HTMLInputElement).value = data.targetUrl;
                    (document.getElementById('editExpiresAtInput') as HTMLInputElement).value = data.expiresAt ? data.expiresAt.substring(0,10) : '';
                    fetchDomainSettings()
                        .then((settings) => renderDomainPicker(
                            document.getElementById('editDomainPicker') as HTMLElement,
                            settings.domains || [],
                            data.domains || [],
                            settings.defaultDomain
                        ))
                        .catch(() => showToast('도메인 목록을 불러오지 못했습니다.', 'error'));
                    (document.getElementById('editModal') as HTMLElement).classList.add('show');
                };

                (document.querySelector('[data-delete]') as HTMLElement).onclick = async () => {
                    if(confirm('정말 이 링크를 삭제하시겠습니까? 관련 통계가 모두 삭제됩니다.')) {
                        await fetch(`/api/links/${code}`, { method: 'DELETE' });
                        window.location.href = '/links';
                    }
                };
            });
            
        fetch(`/api/logs?code=${code}&limit=50`)
            .then(res => res.json())
            .then(data => {
                const tbody = document.getElementById('detailLogsBody');
                if(!tbody) return;
                tbody.innerHTML = '';
                if(data.logs.length === 0) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">기록이 없습니다.</td></tr>';
                data.logs.forEach((log:any) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="color:var(--text-secondary)">${new Date(log.timestamp).toLocaleString()}</td>
                        <td><span class="badge ${log.event === 'visited' ? 'badge-active' : 'badge-inactive'}">${log.event}</span></td>
                        <td>${escapeHtml(log.ip)}</td>
                        <td class="text-trunc" title="${escapeHtml(log.userAgent)}">${escapeHtml(log.userAgent) || '-'}</td>
                    `;
                    tbody.appendChild(tr);
                });
            });
    }

    loadDetail();

    const editModal = document.getElementById('editModal');
    const closeEdit = () => editModal?.classList.remove('show');
    document.getElementById('closeModalButton')?.addEventListener('click', closeEdit);
    document.getElementById('cancelModalButton')?.addEventListener('click', closeEdit);
    document.getElementById('editForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            url: (document.getElementById('editUrlInput') as HTMLInputElement).value,
            expiresAt: (document.getElementById('editExpiresAtInput') as HTMLInputElement).value || null,
            domains: selectedDomainsFrom(document.getElementById('editDomainPicker') as HTMLElement)
        };
        const res = await fetch(`/api/links/${code}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            showToast('수정되었습니다.');
            closeEdit();
            loadDetail();
        } else {
            showToast('수정 실패', 'error');
        }
    });
}

// SETUP SETTINGS
if (pageType === 'settings') {
    const themeSelect = document.getElementById('settingTheme') as HTMLSelectElement;
    const animToggle = document.getElementById('settingAnimation') as HTMLInputElement;
    const cacheBtn = document.getElementById('settingClearCache') as HTMLButtonElement;
    const domainForm = document.getElementById('domainForm') as HTMLFormElement;
    const domainInput = document.getElementById('domainInput') as HTMLInputElement;
    const domainList = document.getElementById('domainList') as HTMLElement;
    
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

    async function loadDomainSettings() {
        if (!domainList) return;
        try {
            const data = await fetchDomainSettings();
            const domains = data.domains || [];
            const usage = data.usage || {};
            const defaultDomain = data.defaultDomain;
            domainList.innerHTML = domains.map((domain: string, index: number) => `
                <div class="domain-row">
                  <div class="domain-meta">
                    <span>${escapeHtml(domain)}</span>
                    <small>${usage[domain] || 0}개 링크 사용 중</small>
                  </div>
                  <div class="domain-actions">
                    ${domain === defaultDomain ? '<span class="badge badge-active">기본</span>' : `<button type="button" class="btn btn-secondary btn-sm" data-default-domain="${escapeHtml(domain)}">기본값</button>`}
                    ${index === 0
                      ? '<span class="badge">현재 접속</span>'
                      : `<button type="button" class="btn btn-danger btn-sm" data-delete-domain="${escapeHtml(domain)}" data-usage="${usage[domain] || 0}">삭제</button>`}
                  </div>
                </div>
            `).join('');
        } catch {
            showToast('도메인 설정을 불러오지 못했습니다.', 'error');
        }
    }

    if (domainForm) {
        domainForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const domain = domainInput.value;
            const res = await fetch('/api/domains', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain })
            });
            const data = await res.json();
            if (res.ok) {
                domainInput.value = '';
                showToast('도메인이 추가되었습니다.');
                loadDomainSettings();
            } else {
                showToast(data.error || '도메인 추가 실패', 'error');
            }
        });

        domainList?.addEventListener('click', async (e) => {
            const defaultButton = (e.target as HTMLElement).closest('[data-default-domain]') as HTMLElement;
            if (defaultButton) {
                const domain = defaultButton.dataset.defaultDomain || '';
                const res = await fetch('/api/domains/default', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ domain })
                });
                if (res.ok) {
                    showToast('기본 도메인이 변경되었습니다.');
                    loadDomainSettings();
                } else {
                    const data = await res.json();
                    showToast(data.error || '기본 도메인 변경 실패', 'error');
                }
                return;
            }

            const deleteButton = (e.target as HTMLElement).closest('[data-delete-domain]') as HTMLElement;
            if (!deleteButton) return;
            const domain = deleteButton.dataset.deleteDomain || '';
            const usage = Number(deleteButton.dataset.usage || 0);
            const warning = usage > 0
                ? `${domain} 도메인은 현재 ${usage}개 링크에서 사용 중입니다. 삭제하면 해당 링크는 기본 도메인으로 변경됩니다. 계속 삭제하시겠습니까?`
                : `${domain} 도메인을 삭제하시겠습니까?`;
            if (!confirm(warning)) return;
            const res = await fetch(`/api/domains/${encodeURIComponent(domain)}?force=true`, { method: 'DELETE' });
            if (res.ok) {
                showToast('도메인이 삭제되었습니다.');
                loadDomainSettings();
            } else {
                const data = await res.json();
                showToast(data.error || '도메인 삭제 실패', 'error');
            }
        });

        loadDomainSettings();
    }
}

    // API Key management UI
    const showLoginButton = document.getElementById('showLoginButton') as HTMLButtonElement | null;
    const apiKeysList = document.getElementById('apiKeysList') as HTMLElement | null;
    const apiKeysContainer = document.getElementById('apiKeysContainer') as HTMLElement | null;
    const createApiKeyButton = document.getElementById('createApiKeyButton') as HTMLButtonElement | null;

    async function renderApiKeys() {
        if (!apiKeysContainer || !apiKeysList) return;
        try {
            const res = await fetch('/api/apikeys');
            const apiAuthControls = document.getElementById('apiAuthControls') as HTMLElement;
            const logoutButton = document.getElementById('logoutButton') as HTMLElement | null;
            if (res.status === 401) {
                apiKeysList.style.display = 'none';
                if (apiAuthControls) apiAuthControls.style.display = 'flex';
                if (logoutButton) logoutButton.style.display = 'none';
                return;
            }
            const data = await res.json();
            apiKeysList.style.display = 'block';
            if (apiAuthControls) apiAuthControls.style.display = 'none';
            if (logoutButton) logoutButton.style.display = 'inline-block';
            apiKeysContainer.innerHTML = data.apiKeys.map((k:any) => `
                <div class="api-key-row">
                  <div><strong>${escapeHtml(k.label || k.id)}</strong><div style="font-size:12px;color:var(--text-secondary);">${escapeHtml(k.createdAt)}</div></div>
                  <div><button class="btn btn-danger btn-sm" data-delete-apikey="${escapeHtml(k.id)}">삭제</button></div>
                </div>
            `).join('');
        } catch (err) {
            showToast('API 키 목록을 불러오는 중 오류', 'error');
        }
    }

    const loginModal = document.getElementById('loginModal') as HTMLElement | null;
    const adminLoginForm = document.getElementById('adminLoginForm') as HTMLFormElement | null;
    const adminPasswordInput = document.getElementById('adminPasswordInput') as HTMLInputElement | null;
    const closeLoginModal = document.getElementById('closeLoginModal') as HTMLElement | null;
    const cancelLoginButton = document.getElementById('cancelLoginButton') as HTMLElement | null;
    const logoutButton = document.getElementById('logoutButton') as HTMLElement | null;

    showLoginButton?.addEventListener('click', () => {
        if (loginModal) loginModal.classList.add('show');
        else {
            // fallback to prompt
            (async () => {
                const pw = prompt('관리자 암호를 입력하세요');
                if (!pw) return;
                const res = await fetch('/api/admin/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ password: pw }) });
                if (res.ok) {
                    showToast('로그인 성공');
                    renderApiKeys();
                } else {
                    const d = await res.json().catch(()=>({}));
                    showToast(d.error || '로그인 실패', 'error');
                }
            })();
        }
    });

    adminLoginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pw = adminPasswordInput?.value || '';
        if (!pw) { showToast('비밀번호를 입력하세요', 'error'); return; }
        const res = await fetch('/api/admin/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ password: pw }) });
        if (res.ok) {
            if (loginModal) loginModal.classList.remove('show');
            if (adminPasswordInput) adminPasswordInput.value = '';
            showToast('로그인 성공');
            renderApiKeys();
        } else {
            const d = await res.json().catch(()=>({}));
            showToast(d.error || '로그인 실패', 'error');
        }
    });

    closeLoginModal?.addEventListener('click', () => { if (loginModal) loginModal.classList.remove('show'); });
    cancelLoginButton?.addEventListener('click', () => { if (loginModal) loginModal.classList.remove('show'); });

    logoutButton?.addEventListener('click', async () => {
        const res = await fetch('/api/admin/logout', { method: 'POST' });
        if (res.ok) {
            showToast('로그아웃되었습니다.');
            renderApiKeys();
            if (logoutButton) logoutButton.style.display = 'none';
        } else {
            showToast('로그아웃 실패', 'error');
        }
    });

    createApiKeyButton?.addEventListener('click', async () => {
        const label = prompt('이 API 키의 용도(라벨)를 입력하세요 (선택)') || '';
        const res = await fetch('/api/apikeys', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ label }) });
        const data = await res.json();
        if (res.ok) {
            // show the secret key once
            alert(`발급된 키(한번만 표시됩니다):\n${data.key}`);
            renderApiKeys();
        } else {
            showToast(data.error || '발급 실패', 'error');
        }
    });

    apiKeysContainer?.addEventListener('click', async (e) => {
        const btn = (e.target as HTMLElement).closest('[data-delete-apikey]') as HTMLElement;
        if (!btn) return;
        const id = btn.dataset.deleteApikey || '';
        if (!confirm('정말 삭제하시겠습니까?')) return;
        const res = await fetch(`/api/apikeys/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('삭제되었습니다.');
            renderApiKeys();
        } else {
            const d = await res.json().catch(()=>({}));
            showToast(d.error || '삭제 실패', 'error');
        }
    });

    // initial attempt to render keys (will show login if not authed)
    renderApiKeys();

// Interceptor
document.addEventListener('DOMContentLoaded', () => {
    const isNoAnim = localStorage.getItem('noanim') === 'true';
    if (isNoAnim) document.documentElement.classList.add('no-anim');

    const links = document.querySelectorAll('a');
    links.forEach(link => {
        if (link.hostname === window.location.hostname && !link.target && !link.hasAttribute('download')) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetUrl = link.href;
                if (!document.documentElement.classList.contains('no-anim')) { 
                    const mainElement = document.getElementById('main');
                    if(mainElement) mainElement.classList.add('page-leave');
                }
                const animDuration = document.documentElement.classList.contains('no-anim') ? 0 : 250;
                setTimeout(() => {
                    window.location.href = targetUrl;
                }, animDuration);
            });
        }
    });
});
