function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, 3e3);
}
function renderLinkStatus(link) {
  if (link.status === "expired") return '<span class="badge badge-inactive">\uB9CC\uB8CC\uB428</span>';
  if (link.status === "inactive" || link.active === false || link.isActive === false) return '<span class="badge badge-inactive">\uBE44\uD65C\uC131</span>';
  return '<span class="badge badge-active">\uD65C\uC131</span>';
}
async function fetchDomains() {
  const res = await fetch("/api/domains");
  const data = await res.json();
  return data.domains || [];
}
async function fetchDomainSettings() {
  const res = await fetch("/api/domains");
  return res.json();
}
function renderDomainPicker(container, domains, selectedDomains = [], defaultDomain) {
  if (!container) return;
  const selected = new Set(selectedDomains.length ? selectedDomains : [defaultDomain || domains[0]].filter(Boolean));
  container.innerHTML = domains.map((domain) => `
            <label class="domain-option">
              <input type="checkbox" name="domains" value="${escapeHtml(domain)}" ${selected.has(domain) ? "checked" : ""}>
              <span class="domain-check"></span>
              <span class="domain-option-text">${escapeHtml(domain)}</span>
              ${domain === defaultDomain ? '<span class="domain-default-mark">\uAE30\uBCF8</span>' : ""}
            </label>
        `).join("");
}
function selectedDomainsFrom(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('input[name="domains"]:checked')).map((input) => input.value);
}
function renderLinks(links) {
  const tbody = document.getElementById("linksBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (links.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 40px; color: var(--text-secondary);">\uB4F1\uB85D\uB41C \uB9C1\uD06C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';
    return;
  }
  links.forEach((link) => {
    const shortUrl = link.shortUrl || `${window.location.origin}/s/${link.code}`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>
              <a href="/links/${link.code}" style="font-weight:600; color:var(--primary-color);">${escapeHtml(shortUrl)}</a>
              ${link.shortUrls?.length > 1 ? `<div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">\uB3C4\uBA54\uC778 ${link.shortUrls.length}\uAC1C</div>` : ""}
            </td>
            <td>
              <a href="${escapeHtml(link.targetUrl)}" target="_blank" class="text-trunc" style="color:var(--text-secondary);" title="${escapeHtml(link.targetUrl)}">${escapeHtml(link.targetUrl)}</a>
            </td>
            <td>${renderLinkStatus(link)}</td>
            <td>
              <div class="flex-gap">
                <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${escapeHtml(shortUrl)}'); showToast('\uBCF5\uC0AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.')">\uBCF5\uC0AC</button>
                <a href="/links/${link.code}" class="btn btn-secondary btn-sm">\uAD00\uB9AC</a>
              </div>
            </td>
        `;
    tbody.appendChild(tr);
  });
}
function renderPagination(total, page, limit, onPageClick, containerId = "pagination") {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return;
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.className = `btn btn-sm ${i === page ? "btn-primary" : "btn-secondary"}`;
    btn.textContent = String(i);
    btn.onclick = () => onPageClick(i);
    container.appendChild(btn);
  }
}
const createForm = document.getElementById("createForm");
if (createForm) {
  let selectedCreateDomains = function() {
    return selectedDomainsFrom(domainPicker);
  }, resetCreateDomains = function() {
    fetchDomainSettings().then((data) => renderDomainPicker(domainPicker, data.domains || [], [], data.defaultDomain)).catch(() => {
    });
  };
  const domainPicker = document.getElementById("domainPicker");
  const expiresAtInput = document.getElementById("expiresAtInput");
  fetchDomainSettings().then((data) => renderDomainPicker(domainPicker, data.domains || [], [], data.defaultDomain)).catch(() => showToast("\uB3C4\uBA54\uC778 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error"));
  if (expiresAtInput) {
    expiresAtInput.addEventListener("focus", () => {
      expiresAtInput.type = "date";
    });
    expiresAtInput.addEventListener("blur", () => {
      if (!expiresAtInput.value) {
        expiresAtInput.type = "text";
      }
    });
  }
  createForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const selectedDomains = selectedCreateDomains();
    const payload = {
      url: document.getElementById("urlInput").value,
      customCode: document.getElementById("customCodeInput").value || void 0,
      expiresAt: document.getElementById("expiresAtInput").value || void 0,
      domains: selectedDomains
    };
    try {
      const res = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        const shortUrls = data.shortUrls?.length ? data.shortUrls : [data.shortUrl];
        const primaryUrl = shortUrls[0];
        document.getElementById("result").style.display = "flex";
        const resultLinks = document.getElementById("resultLinks");
        resultLinks.innerHTML = shortUrls.map((shortUrl) => `<a href="${escapeHtml(shortUrl)}" target="_blank" class="short-link-display">${escapeHtml(shortUrl)}</a>`).join("");
        document.getElementById("copyButton").onclick = (btnE) => {
          btnE.preventDefault();
          navigator.clipboard.writeText(shortUrls.join("\n"));
          showToast("\uD074\uB9BD\uBCF4\uB4DC\uC5D0 \uBCF5\uC0AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
        };
        showToast("\uB9C1\uD06C\uAC00 \uC0DD\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
        createForm.reset();
        if (primaryUrl) resetCreateDomains();
      } else {
        showToast(data.error || "\uC0DD\uC131 \uC2E4\uD328", "error");
      }
    } catch (err) {
      showToast("\uC11C\uBC84 \uD1B5\uC2E0 \uC624\uB958", "error");
    }
  });
}
const pageType = document.body.dataset.page;
if (pageType === "links") {
  let loadLinks = function(page = 1, searchQuery = currentSearch, domain = currentDomain) {
    currentSearch = searchQuery;
    currentDomain = domain;
    const q = searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : "";
    const d = domain ? `&domain=${encodeURIComponent(domain)}` : "";
    fetch(`/api/links?page=${page}&limit=10${q}${d}`).then((res) => res.json()).then((data) => {
      currentPage = page;
      document.getElementById("linkCount").textContent = data.total;
      renderLinks(data.links);
      renderPagination(data.total, page, 10, (p) => loadLinks(p, searchQuery, domain));
    });
  };
  let currentPage = 1;
  let currentSearch = "";
  let currentDomain = "";
  fetchDomains().then((domains) => {
    const filter = document.getElementById("domainFilter");
    if (!filter) return;
    filter.innerHTML = '<option value="">\uC804\uCCB4 \uB3C4\uBA54\uC778</option>' + domains.map((domain) => `<option value="${escapeHtml(domain)}">${escapeHtml(domain)}</option>`).join("");
  }).catch(() => {
  });
  loadLinks();
  document.getElementById("linkSearchInput")?.addEventListener("input", (e) => {
    loadLinks(1, e.target.value, currentDomain);
  });
  document.getElementById("domainFilter")?.addEventListener("change", (e) => {
    loadLinks(1, currentSearch, e.target.value);
  });
}
if (pageType === "logs") {
  let loadLogs = function(page = 1, eventType = "all") {
    const evt = eventType !== "all" ? `&event=${eventType}` : "";
    fetch(`/api/logs?page=${page}&limit=10${evt}`).then((res) => res.json()).then((data) => {
      logsPage = page;
      document.getElementById("metricVisited").textContent = data.metrics.visited;
      document.getElementById("metricCreated").textContent = data.metrics.created;
      document.getElementById("metricBlocked").textContent = data.metrics.blocked;
      document.getElementById("metricTotal").textContent = data.total;
      const tbody = document.getElementById("logsBody");
      if (!tbody) return;
      tbody.innerHTML = "";
      if (data.logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">\uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';
      } else {
        data.logs.forEach((log) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
                            <td style="color:var(--text-secondary)">${new Date(log.timestamp).toLocaleString()}</td>
                            <td><span class="badge ${log.event === "visited" ? "badge-active" : log.event === "created" ? "badge-created" : "badge-inactive"}">${log.event}</span></td>
                            <td>${escapeHtml(log.code || "-")}</td>
                            <td class="text-trunc" title="${escapeHtml(log.ip)} \xB7 ${escapeHtml(log.userAgent)}">${escapeHtml(log.ip)}</td>
                        `;
          tbody.appendChild(tr);
        });
      }
      renderPagination(data.total, page, 10, (p) => loadLogs(p, eventType), "logsPagination");
    });
  }, renderAnalytics = function() {
    fetch("/api/analytics").then((res) => res.json()).then((data) => {
      const visitChart = document.getElementById("visitChart");
      if (visitChart) {
        visitChart.innerHTML = "";
        const maxV = Math.max(...data.dailyVisits.map((d) => d.count), 1);
        data.dailyVisits.forEach((d) => {
          const h = Math.max(d.count / maxV * 100, 5);
          visitChart.innerHTML += `
                            <div class="chart-col">
                              <div class="chart-bar" style="height: ${h}%;" title="${d.date}: ${d.count}\uBA85"></div>
                              <span class="chart-label">${d.date.split("-")[2]}\uC77C</span>
                            </div>
                        `;
        });
      }
      const devChart = document.getElementById("deviceChart");
      if (devChart) {
        devChart.innerHTML = "";
        let maxD = Math.max(...Object.values(data.devices), 1);
        for (const [dev, count] of Object.entries(data.devices)) {
          const pct = count / maxD * 100;
          devChart.innerHTML += `
                            <div class="h-bar-container">
                                <div class="h-bar-info"><span>${dev}</span><span>${count}</span></div>
                                <div class="h-bar-bg"><div class="h-bar-fill" style="width: ${pct}%"></div></div>
                            </div>
                        `;
        }
      }
    });
  };
  let logsPage = 1;
  loadLogs();
  renderAnalytics();
  document.getElementById("logFilter")?.addEventListener("change", (e) => {
    loadLogs(1, e.target.value);
  });
}
if (pageType === "detail") {
  let loadDetail = function() {
    if (!code) return;
    fetch(`/api/links/${code}`).then((res) => {
      if (!res.ok) {
        showToast("\uB9C1\uD06C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", "error");
        return;
      }
      return res.json();
    }).then((data) => {
      currentDetail = data;
      const shortUrl = data.shortUrl || `${window.location.origin}/s/${data.code}`;
      document.getElementById("detailShortUrl").href = shortUrl;
      document.getElementById("detailShortUrl").textContent = data.shortUrls?.join("\n") || shortUrl;
      document.getElementById("detailTargetUrl").innerHTML = `<a href="${escapeHtml(data.targetUrl)}" target="_blank" style="color:var(--text-secondary);">${escapeHtml(data.targetUrl)}</a>`;
      document.getElementById("detailExpiry").textContent = data.expiresAt ? new Date(data.expiresAt).toLocaleString() : "\uBB34\uAE30\uD55C";
      document.getElementById("detailStatus").outerHTML = renderLinkStatus(data);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shortUrl)}`;
      document.getElementById("detailQr").src = qrUrl;
      document.querySelector("[data-copy]").onclick = () => {
        navigator.clipboard.writeText(shortUrl);
        showToast("\uBCF5\uC0AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
      };
      document.querySelector("[data-download-qr]").onclick = () => {
        const dl = `/api/qr?data=${encodeURIComponent(shortUrl)}&size=800x800&format=png`;
        window.open(dl, "_blank");
      };
      const toggleBtn = document.getElementById("detailToggleButton");
      if (toggleBtn) {
        toggleBtn.textContent = data.active !== false ? "\uC0AC\uC6A9 \uC911\uC9C0" : "\uD65C\uC131\uD654";
        toggleBtn.onclick = async () => {
          await fetch(`/api/links/${code}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: data.active === false })
          });
          loadDetail();
        };
      }
      document.querySelector("[data-edit]").onclick = () => {
        document.getElementById("editUrlInput").value = data.targetUrl;
        document.getElementById("editExpiresAtInput").value = data.expiresAt ? data.expiresAt.substring(0, 10) : "";
        fetchDomainSettings().then((settings) => renderDomainPicker(
          document.getElementById("editDomainPicker"),
          settings.domains || [],
          data.domains || [],
          settings.defaultDomain
        )).catch(() => showToast("\uB3C4\uBA54\uC778 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error"));
        document.getElementById("editModal").classList.add("show");
      };
      document.querySelector("[data-delete]").onclick = async () => {
        if (confirm("\uC815\uB9D0 \uC774 \uB9C1\uD06C\uB97C \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C? \uAD00\uB828 \uD1B5\uACC4\uAC00 \uBAA8\uB450 \uC0AD\uC81C\uB429\uB2C8\uB2E4.")) {
          await fetch(`/api/links/${code}`, { method: "DELETE" });
          window.location.href = "/links";
        }
      };
    });
    fetch(`/api/logs?code=${code}&limit=50`).then((res) => res.json()).then((data) => {
      const tbody = document.getElementById("detailLogsBody");
      if (!tbody) return;
      tbody.innerHTML = "";
      if (data.logs.length === 0) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">\uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';
      data.logs.forEach((log) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
                        <td style="color:var(--text-secondary)">${new Date(log.timestamp).toLocaleString()}</td>
                        <td><span class="badge ${log.event === "visited" ? "badge-active" : "badge-inactive"}">${log.event}</span></td>
                        <td>${escapeHtml(log.ip)}</td>
                        <td class="text-trunc" title="${escapeHtml(log.userAgent)}">${escapeHtml(log.userAgent) || "-"}</td>
                    `;
        tbody.appendChild(tr);
      });
    });
  };
  const code = document.body.dataset.detailCode;
  let currentDetail = null;
  loadDetail();
  const editModal = document.getElementById("editModal");
  const closeEdit = () => editModal?.classList.remove("show");
  document.getElementById("closeModalButton")?.addEventListener("click", closeEdit);
  document.getElementById("cancelModalButton")?.addEventListener("click", closeEdit);
  document.getElementById("editForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      url: document.getElementById("editUrlInput").value,
      expiresAt: document.getElementById("editExpiresAtInput").value || null,
      domains: selectedDomainsFrom(document.getElementById("editDomainPicker"))
    };
    const res = await fetch(`/api/links/${code}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast("\uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
      closeEdit();
      loadDetail();
    } else {
      showToast("\uC218\uC815 \uC2E4\uD328", "error");
    }
  });
}
if (pageType === "settings") {
  const themeSelect = document.getElementById("settingTheme");
  const animToggle = document.getElementById("settingAnimation");
  const cacheBtn = document.getElementById("settingClearCache");
  const domainForm = document.getElementById("domainForm");
  const domainInput = document.getElementById("domainInput");
  const domainList = document.getElementById("domainList");
  if (themeSelect) {
    themeSelect.value = localStorage.getItem("theme") || "system";
    themeSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val === "system") {
        localStorage.removeItem("theme");
        document.documentElement.dataset.theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } else {
        localStorage.setItem("theme", val);
        document.documentElement.dataset.theme = val;
      }
      showToast("\uD14C\uB9C8 \uC124\uC815\uC774 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    });
  }
  if (animToggle) {
    animToggle.checked = localStorage.getItem("noanim") !== "true";
    animToggle.addEventListener("change", (e) => {
      const checked = e.target.checked;
      if (checked) {
        localStorage.removeItem("noanim");
        document.documentElement.classList.remove("no-anim");
      } else {
        localStorage.setItem("noanim", "true");
        document.documentElement.classList.add("no-anim");
      }
      showToast("\uC560\uB2C8\uBA54\uC774\uC158 \uC124\uC815\uC774 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    });
  }
  if (cacheBtn) {
    cacheBtn.addEventListener("click", () => {
      if (confirm("\uB85C\uCEEC \uBE0C\uB77C\uC6B0\uC800 \uC124\uC815\uC744 \uBAA8\uB450 \uC9C0\uC6B0\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) {
        localStorage.clear();
        showToast("\uCD08\uAE30\uD654\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uD398\uC774\uC9C0\uB97C \uC0C8\uB85C\uACE0\uCE68\uD569\uB2C8\uB2E4.");
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
      domainList.innerHTML = domains.map((domain, index) => `
                <div class="domain-row">
                  <div class="domain-meta">
                    <span>${escapeHtml(domain)}</span>
                    <small>${usage[domain] || 0}\uAC1C \uB9C1\uD06C \uC0AC\uC6A9 \uC911</small>
                  </div>
                  <div class="domain-actions">
                    ${domain === defaultDomain ? '<span class="badge badge-active">\uAE30\uBCF8</span>' : `<button type="button" class="btn btn-secondary btn-sm" data-default-domain="${escapeHtml(domain)}">\uAE30\uBCF8\uAC12</button>`}
                    ${index === 0 ? '<span class="badge">\uD604\uC7AC \uC811\uC18D</span>' : `<button type="button" class="btn btn-danger btn-sm" data-delete-domain="${escapeHtml(domain)}" data-usage="${usage[domain] || 0}">\uC0AD\uC81C</button>`}
                  </div>
                </div>
            `).join("");
    } catch {
      showToast("\uB3C4\uBA54\uC778 \uC124\uC815\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  }
  if (domainForm) {
    domainForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const domain = domainInput.value;
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain })
      });
      const data = await res.json();
      if (res.ok) {
        domainInput.value = "";
        showToast("\uB3C4\uBA54\uC778\uC774 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
        loadDomainSettings();
      } else {
        showToast(data.error || "\uB3C4\uBA54\uC778 \uCD94\uAC00 \uC2E4\uD328", "error");
      }
    });
    domainList?.addEventListener("click", async (e) => {
      const defaultButton = e.target.closest("[data-default-domain]");
      if (defaultButton) {
        const domain2 = defaultButton.dataset.defaultDomain || "";
        const res2 = await fetch("/api/domains/default", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: domain2 })
        });
        if (res2.ok) {
          showToast("\uAE30\uBCF8 \uB3C4\uBA54\uC778\uC774 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
          loadDomainSettings();
        } else {
          const data = await res2.json();
          showToast(data.error || "\uAE30\uBCF8 \uB3C4\uBA54\uC778 \uBCC0\uACBD \uC2E4\uD328", "error");
        }
        return;
      }
      const deleteButton = e.target.closest("[data-delete-domain]");
      if (!deleteButton) return;
      const domain = deleteButton.dataset.deleteDomain || "";
      const usage = Number(deleteButton.dataset.usage || 0);
      const warning = usage > 0 ? `${domain} \uB3C4\uBA54\uC778\uC740 \uD604\uC7AC ${usage}\uAC1C \uB9C1\uD06C\uC5D0\uC11C \uC0AC\uC6A9 \uC911\uC785\uB2C8\uB2E4. \uC0AD\uC81C\uD558\uBA74 \uD574\uB2F9 \uB9C1\uD06C\uB294 \uAE30\uBCF8 \uB3C4\uBA54\uC778\uC73C\uB85C \uBCC0\uACBD\uB429\uB2C8\uB2E4. \uACC4\uC18D \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?` : `${domain} \uB3C4\uBA54\uC778\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`;
      if (!confirm(warning)) return;
      const res = await fetch(`/api/domains/${encodeURIComponent(domain)}?force=true`, { method: "DELETE" });
      if (res.ok) {
        showToast("\uB3C4\uBA54\uC778\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
        loadDomainSettings();
      } else {
        const data = await res.json();
        showToast(data.error || "\uB3C4\uBA54\uC778 \uC0AD\uC81C \uC2E4\uD328", "error");
      }
    });
    loadDomainSettings();
  }
}
const showLoginButton = document.getElementById("showLoginButton");
const apiKeysList = document.getElementById("apiKeysList");
const apiKeysContainer = document.getElementById("apiKeysContainer");
const createApiKeyButton = document.getElementById("createApiKeyButton");
async function renderApiKeys() {
  if (!apiKeysContainer || !apiKeysList) return;
  try {
    const res = await fetch("/api/apikeys");
    const apiAuthControls = document.getElementById("apiAuthControls");
    const logoutButton2 = document.getElementById("logoutButton");
    if (res.status === 401) {
      apiKeysList.style.display = "none";
      if (apiAuthControls) apiAuthControls.style.display = "flex";
      if (logoutButton2) logoutButton2.style.display = "none";
      return;
    }
    const data = await res.json();
    apiKeysList.style.display = "block";
    if (apiAuthControls) apiAuthControls.style.display = "none";
    if (logoutButton2) logoutButton2.style.display = "inline-block";
    apiKeysContainer.innerHTML = data.apiKeys.map((k) => `
                <div class="api-key-row">
                  <div><strong>${escapeHtml(k.label || k.id)}</strong><div style="font-size:12px;color:var(--text-secondary);">${escapeHtml(k.createdAt)}</div></div>
                  <div><button class="btn btn-danger btn-sm" data-delete-apikey="${escapeHtml(k.id)}">\uC0AD\uC81C</button></div>
                </div>
            `).join("");
  } catch (err) {
    showToast("API \uD0A4 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958", "error");
  }
}
const loginModal = document.getElementById("loginModal");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminPasswordInput = document.getElementById("adminPasswordInput");
const closeLoginModal = document.getElementById("closeLoginModal");
const cancelLoginButton = document.getElementById("cancelLoginButton");
const logoutButton = document.getElementById("logoutButton");
showLoginButton?.addEventListener("click", () => {
  if (loginModal) loginModal.classList.add("show");
  else {
    (async () => {
      const pw = prompt("\uAD00\uB9AC\uC790 \uC554\uD638\uB97C \uC785\uB825\uD558\uC138\uC694");
      if (!pw) return;
      const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
      if (res.ok) {
        showToast("\uB85C\uADF8\uC778 \uC131\uACF5");
        renderApiKeys();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || "\uB85C\uADF8\uC778 \uC2E4\uD328", "error");
      }
    })();
  }
});
adminLoginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pw = adminPasswordInput?.value || "";
  if (!pw) {
    showToast("\uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD558\uC138\uC694", "error");
    return;
  }
  const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
  if (res.ok) {
    if (loginModal) loginModal.classList.remove("show");
    if (adminPasswordInput) adminPasswordInput.value = "";
    showToast("\uB85C\uADF8\uC778 \uC131\uACF5");
    renderApiKeys();
  } else {
    const d = await res.json().catch(() => ({}));
    showToast(d.error || "\uB85C\uADF8\uC778 \uC2E4\uD328", "error");
  }
});
closeLoginModal?.addEventListener("click", () => {
  if (loginModal) loginModal.classList.remove("show");
});
cancelLoginButton?.addEventListener("click", () => {
  if (loginModal) loginModal.classList.remove("show");
});
logoutButton?.addEventListener("click", async () => {
  const res = await fetch("/api/admin/logout", { method: "POST" });
  if (res.ok) {
    showToast("\uB85C\uADF8\uC544\uC6C3\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    renderApiKeys();
    if (logoutButton) logoutButton.style.display = "none";
  } else {
    showToast("\uB85C\uADF8\uC544\uC6C3 \uC2E4\uD328", "error");
  }
});
createApiKeyButton?.addEventListener("click", async () => {
  const label = prompt("\uC774 API \uD0A4\uC758 \uC6A9\uB3C4(\uB77C\uBCA8)\uB97C \uC785\uB825\uD558\uC138\uC694 (\uC120\uD0DD)") || "";
  const res = await fetch("/api/apikeys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }) });
  const data = await res.json();
  if (res.ok) {
    alert(`\uBC1C\uAE09\uB41C \uD0A4(\uD55C\uBC88\uB9CC \uD45C\uC2DC\uB429\uB2C8\uB2E4):
${data.key}`);
    renderApiKeys();
  } else {
    showToast(data.error || "\uBC1C\uAE09 \uC2E4\uD328", "error");
  }
});
apiKeysContainer?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-delete-apikey]");
  if (!btn) return;
  const id = btn.dataset.deleteApikey || "";
  if (!confirm("\uC815\uB9D0 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) return;
  const res = await fetch(`/api/apikeys/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (res.ok) {
    showToast("\uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    renderApiKeys();
  } else {
    const d = await res.json().catch(() => ({}));
    showToast(d.error || "\uC0AD\uC81C \uC2E4\uD328", "error");
  }
});
renderApiKeys();
document.addEventListener("DOMContentLoaded", () => {
  const isNoAnim = localStorage.getItem("noanim") === "true";
  if (isNoAnim) document.documentElement.classList.add("no-anim");
  const links = document.querySelectorAll("a");
  links.forEach((link) => {
    if (link.hostname === window.location.hostname && !link.target && !link.hasAttribute("download")) {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const targetUrl = link.href;
        if (!document.documentElement.classList.contains("no-anim")) {
          const mainElement = document.getElementById("main");
          if (mainElement) mainElement.classList.add("page-leave");
        }
        const animDuration = document.documentElement.classList.contains("no-anim") ? 0 : 250;
        setTimeout(() => {
          window.location.href = targetUrl;
        }, animDuration);
      });
    }
  });
});
