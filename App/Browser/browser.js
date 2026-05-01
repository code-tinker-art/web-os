(() => {
    const currentScript = document.currentScript;
    const container = currentScript.parentElement;
    const $ = (sel) => container.querySelector(sel);

    const brRoot = $('.br-root');
    const tabStrip = $('#br-tab-strip');
    const pagesEl = $('#br-pages');
    const addressBar = $('#br-address-bar');
    const addrScheme = $('#br-address-scheme');
    const backBtn = $('#br-back');
    const fwdBtn = $('#br-forward');
    const reloadBtn = $('#br-reload');
    const bmBtn = $('#br-bookmark-btn');
    const bmIcon = $('#br-bm-icon');
    const iconBtn = $('#br-icon-btn');
    const sidebar = $('#br-sidebar');
    const sideToggle = $('#br-sidebar-toggle');
    const bmList = $('#br-bm-list');
    const histList = $('#br-hist-list');
    const clearBm = $('#br-clear-bm');
    const clearHist = $('#br-clear-hist');
    const iconModal = $('#br-icon-modal');
    const iconInput = $('#br-icon-input');
    const iconCancel = $('#br-icon-cancel');
    const iconConfirm = $('#br-icon-confirm');

    const fs = () => window.WebOS?.fs;

    // ── Window controls ────────────────────────────────────────────────────────
    let isMaximized = false;
    let prevState = {};
    $('.br-btn-close').onclick = () => container.remove();
    $('.br-btn-max').onclick = () => toggleMax();
    $('.br-btn-min').onclick = () => restore();

    function maximize() {
        if (isMaximized) return;
        prevState = { width: container.style.width, height: container.style.height, top: container.style.top, left: container.style.left };
        const screen = container.parentElement;
        container.style.width = screen.offsetWidth + 'px';
        container.style.height = screen.offsetHeight + 'px';
        container.style.top = '0'; container.style.left = '0';
        brRoot.style.borderRadius = '0';
        isMaximized = true;
    }
    function restore() {
        if (!isMaximized) return;
        container.style.width = prevState.width;
        container.style.height = prevState.height;
        container.style.top = prevState.top;
        container.style.left = prevState.left;
        brRoot.style.borderRadius = '';
        isMaximized = false;
    }
    function toggleMax() { isMaximized ? restore() : maximize(); }

    // ── State ──────────────────────────────────────────────────────────────────
    let tabs = [];
    let activeTab = null;
    let tabIdSeq = 0;

    // Persisted data
    let bookmarks = JSON.parse(localStorage.getItem('webos:browser_bookmarks') || '[]');
    let history = JSON.parse(localStorage.getItem('webos:browser_history') || '[]');

    function saveBm() { localStorage.setItem('webos:browser_bookmarks', JSON.stringify(bookmarks)); }
    function saveHist() { localStorage.setItem('webos:browser_history', JSON.stringify(history)); }

    // ── Tab model ──────────────────────────────────────────────────────────────
    // Each tab: { id, title, icon, url, pageEl, navStack, navIdx, isLoading }
    // pageEl is either a .br-newtab div, a .br-errpage div, or an <iframe>

    function createTab(url = null) {
        const tab = {
            id: tabIdSeq++,
            title: 'New Tab',
            icon: '🌐',
            url: null,
            pageEl: null,
            navStack: [],
            navIdx: -1,
            isLoading: false,
        };
        tabs.push(tab);
        tab.pageEl = buildNewTabPage(tab);
        pagesEl.appendChild(tab.pageEl);

        renderTabs();
        activateTab(tab);

        if (url) navigate(tab, url);
        return tab;
    }

    function closeTab(tab) {
        const idx = tabs.indexOf(tab);
        if (idx === -1) return;
        tab.pageEl.remove();
        tabs.splice(idx, 1);
        if (tabs.length === 0) { createTab(); return; }
        activateTab(tabs[Math.min(idx, tabs.length - 1)]);
    }

    function activateTab(tab) {
        activeTab = tab;
        tabs.forEach(t => t.pageEl.classList.toggle('active', t === tab));
        renderTabs();
        updateToolbar();
    }

    // ── Tab strip rendering ────────────────────────────────────────────────────
    function renderTabs() {
        tabStrip.innerHTML = '';
        tabs.forEach(tab => {
            const el = document.createElement('div');
            el.className = 'br-tab' + (tab === activeTab ? ' active' : '');

            const favicon = document.createElement('span');
            favicon.className = 'br-tab-favicon';

            if (tab.isLoading) {
                const spin = document.createElement('div');
                spin.className = 'br-tab-loading';
                favicon.appendChild(spin);
            } else {
                favicon.textContent = tab.icon || '🌐';
            }

            const title = document.createElement('span');
            title.className = 'br-tab-title';
            title.textContent = tab.title;

            const cls = document.createElement('span');
            cls.className = 'br-tab-close';
            cls.textContent = '×';
            cls.title = 'Close tab';
            cls.addEventListener('click', (e) => { e.stopPropagation(); closeTab(tab); });

            el.append(favicon, title, cls);
            el.addEventListener('click', () => activateTab(tab));
            tabStrip.appendChild(el);
        });
    }

    function updateToolbar() {
        const tab = activeTab;
        if (!tab) return;
        addressBar.value = tab.url || '';
        if (!tab.url) {
            addrScheme.textContent = '';
        } else if (isExternalUrl(tab.url)) {
            addrScheme.textContent = '🌐';
        } else {
            addrScheme.textContent = 'fs://';
        }
        updateNavBtns();
        updateBookmarkBtn();
    }

    function updateNavBtns() {
        const tab = activeTab;
        if (!tab) return;
        backBtn.disabled = tab.navIdx <= 0;
        fwdBtn.disabled = tab.navIdx >= tab.navStack.length - 1;
    }

    function updateBookmarkBtn() {
        const tab = activeTab;
        if (!tab || !tab.url) { bmIcon.style.fill = 'none'; return; }
        const saved = bookmarks.some(b => b.url === tab.url);
        bmIcon.setAttribute('fill', saved ? '#f5c842' : 'none');
        bmIcon.setAttribute('stroke', saved ? '#f5c842' : 'currentColor');
    }

    // ── New tab page ───────────────────────────────────────────────────────────
    function buildNewTabPage(tab) {
        const el = document.createElement('div');
        el.className = 'br-newtab';

        const clockEl = document.createElement('div');
        clockEl.className = 'br-newtab-clock';
        const dateEl = document.createElement('div');
        dateEl.className = 'br-newtab-date';

        function tick() {
            const now = new Date();
            clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
        }
        tick();
        const ticker = setInterval(tick, 10000);
        el._ticker = ticker;

        const searchWrap = document.createElement('div');
        searchWrap.className = 'br-newtab-search';
        const searchIcon = document.createElement('span');
        searchIcon.textContent = '🔍';
        const searchInput = document.createElement('input');
        searchInput.className = 'br-newtab-input';
        searchInput.placeholder = 'Enter URL or FS path (e.g. google.com, Sites/index.html)';
        searchInput.autocomplete = 'off';
        searchInput.spellcheck = false;
        const goBtn = document.createElement('button');
        goBtn.className = 'br-newtab-go';
        goBtn.textContent = '→';
        searchWrap.append(searchIcon, searchInput, goBtn);

        function doSearch() {
            const val = searchInput.value.trim();
            if (val) navigate(tab, val);
        }
        goBtn.onclick = doSearch;
        searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

        // Quick-access shortcuts from bookmarks
        const shortcuts = document.createElement('div');
        shortcuts.className = 'br-newtab-shortcuts';
        shortcuts.id = 'br-shortcuts-' + tab.id;

        el.append(clockEl, dateEl, searchWrap, shortcuts);
        refreshShortcuts(el, tab);
        return el;
    }

    function refreshShortcuts(ntEl, tab) {
        const sc = ntEl.querySelector('.br-newtab-shortcuts');
        if (!sc) return;
        sc.innerHTML = '';
        const items = bookmarks.slice(0, 8);
        if (!items.length) {
            sc.innerHTML = `<div style="font-size:11px;color:var(--br-text3)">Bookmarked pages will appear here</div>`;
            return;
        }
        items.forEach(bm => {
            const btn = document.createElement('div');
            btn.className = 'br-shortcut';
            btn.innerHTML = `<div class="br-shortcut-icon">${bm.icon || '📄'}</div>
                <div class="br-shortcut-label">${bm.title}</div>`;
            btn.onclick = () => navigate(tab, bm.url);
            sc.appendChild(btn);
        });
    }

    // ── URL helpers ────────────────────────────────────────────────────────────
    function isExternalUrl(url) {
        return /^https?:\/\//i.test(url) ||
            /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/|$)/.test(url);
    }

    function normaliseExternal(url) {
        if (/^https?:\/\//i.test(url)) return url;
        return 'https://' + url;
    }

    // ── Navigation ─────────────────────────────────────────────────────────────
    function navigate(tab, rawUrl) {
        const trimmed = rawUrl.trim().replace(/^fs:\/\//, '');
        if (!trimmed || trimmed === 'newtab' || trimmed === 'webos://newtab') {
            showNewTab(tab);
            return;
        }

        const url = isExternalUrl(trimmed) ? normaliseExternal(trimmed) : trimmed;

        tab.navStack = tab.navStack.slice(0, tab.navIdx + 1);
        tab.navStack.push(url);
        tab.navIdx = tab.navStack.length - 1;

        loadUrl(tab, url);
    }

    function navBack(tab) {
        if (tab.navIdx <= 0) return;
        tab.navIdx--;
        loadUrl(tab, tab.navStack[tab.navIdx], true);
    }

    function navForward(tab) {
        if (tab.navIdx >= tab.navStack.length - 1) return;
        tab.navIdx++;
        loadUrl(tab, tab.navStack[tab.navIdx], true);
    }

    function loadUrl(tab, url, noStack = false) {
        tab.isLoading = true;
        tab.url = url;
        if (tab === activeTab) updateToolbar();
        renderTabs();

        if (isExternalUrl(url)) {
            // External site — use iframe src directly, no processing needed
            showExternalPage(tab, url);
            addHistory(url, tab.icon, tab.title);
            tab.isLoading = false;
            if (tab === activeTab) updateToolbar();
            renderTabs();
        } else {
            // FS file — resolve and render via srcdoc
            setTimeout(() => {
                const result = resolveAndRender(url);
                if (result.error) {
                    showError(tab, result.error, url);
                } else {
                    showPage(tab, result.srcdoc, url);
                    addHistory(url, tab.icon, tab.title);
                }
                tab.isLoading = false;
                if (tab === activeTab) updateToolbar();
                renderTabs();
            }, 80);
        }
    }

    // ── FS path resolution ─────────────────────────────────────────────────────
    function resolvePath(baseDir, rel) {
        if (!rel) return null;
        if (rel.startsWith('http') || rel.startsWith('data:') || rel.startsWith('//')) return null;
        // Strip leading ./
        rel = rel.replace(/^\.\//, '');
        const stack = baseDir ? baseDir.split('/') : [];
        for (const seg of rel.split('/')) {
            if (seg === '..') stack.pop();
            else if (seg !== '.') stack.push(seg);
        }
        return stack.join('/') || '';
    }

    // Extract an attribute value from a tag string regardless of attribute order
    function getAttr(tag, attr) {
        const m = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'));
        return m ? m[1] : null;
    }

    function resolveAndRender(filePath) {
        const f = fs();
        if (!f) return { error: 'Filesystem not available' };

        const file = f.getFile(filePath);
        if (!file) return { error: `File not found: ${filePath}` };
        if (file.extName !== 'html') return { error: `Cannot render .${file.extName} — only .html files are supported` };
        if (!file.content) return { error: 'File is empty' };

        // Base directory = everything before the filename
        const pathParts = filePath.split('/');
        pathParts.pop();
        const baseDir = pathParts.join('/');

        let html = file.content;

        // ── <link ...> — handles any attribute order ───────────────────────────
        html = html.replace(/<link\b[^>]*>/gi, (tag) => {
            const rel = getAttr(tag, 'rel');
            const href = getAttr(tag, 'href');
            if (!rel || rel.toLowerCase() !== 'stylesheet') return tag;
            if (!href || href.startsWith('http') || href.startsWith('data:') || href.startsWith('//')) return tag;
            const resolved = resolvePath(baseDir, href);
            if (!resolved) return tag;
            const cssFile = f.getFile(resolved);
            if (!cssFile) return `<!-- [browser] CSS not found: ${resolved} -->`;
            return `<style>\n${cssFile.content || ''}\n</style>`;
        });

        // ── <script src="..."></script> — handles any attribute order ──────────
        html = html.replace(/<script\b([^>]*)><\/script>/gi, (tag, attrs) => {
            const src = getAttr(tag, 'src');
            if (!src || src.startsWith('http') || src.startsWith('data:') || src.startsWith('//')) return tag;
            const resolved = resolvePath(baseDir, src);
            if (!resolved) return tag;
            const jsFile = f.getFile(resolved);
            if (!jsFile) return `<!-- [browser] JS not found: ${resolved} -->`;
            // Strip the src attribute, keep everything else (type, defer, async, etc.)
            const cleanAttrs = attrs.replace(/\s*src=["'][^"']*["']/i, '').trim();
            return `<script${cleanAttrs ? ' ' + cleanAttrs : ''}>\n${jsFile.content || ''}\n<\/script>`;
        });

        // ── <img src="..."> ────────────────────────────────────────────────────
        html = html.replace(/<img\b([^>]*)>/gi, (tag, attrs) => {
            const src = getAttr(tag, 'src');
            if (!src || src.startsWith('http') || src.startsWith('data:') || src.startsWith('//')) return tag;
            const resolved = resolvePath(baseDir, src);
            if (!resolved) return tag;
            const imgFile = f.getFile(resolved);
            if (!imgFile || !imgFile.content) return tag;
            const dataUri = imgFile.content.startsWith('data:')
                ? imgFile.content
                : `data:image/${imgFile.extName};base64,${imgFile.content}`;
            return tag.replace(/src=["'][^"']*["']/i, `src="${dataUri}"`);
        });

        // ── Fullscreen reset + WebOS bridge ────────────────────────────────────
        const inject = `<meta charset="utf-8">
<style>*,html,body{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;}</style>
<script>
window.WebOS   = window.parent?.WebOS ?? null;
window.navigate = (url) => window.parent?.postMessage({ type: 'br-navigate', url }, '*');
<\/script>`;

        if (/<html\b/i.test(html)) {
            // Inject after <head> if present, otherwise after <html>
            if (/<head\b/i.test(html)) {
                html = html.replace(/<head\b[^>]*>/i, (m) => m + '\n' + inject);
            } else {
                html = html.replace(/<html\b[^>]*>/i, (m) => m + '\n<head>' + inject + '</head>');
            }
        } else {
            html = `<!DOCTYPE html><html><head>${inject}</head><body>${html}</body></html>`;
        }

        return { srcdoc: html };
    }

    // ── Page display ───────────────────────────────────────────────────────────
    function showPage(tab, srcdoc, url) {
        if (tab._iframe) { tab._iframe.remove(); tab._iframe = null; }
        hideTabContent(tab);

        const iframe = document.createElement('iframe');
        iframe.className = 'br-page';
        iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;display:block;';
        iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-modals allow-popups';

        pagesEl.appendChild(iframe);
        tab._iframe = iframe;
        tab.pageEl.classList.remove('active');

        iframe.addEventListener('load', () => {
            try {
                const title = iframe.contentDocument?.title;
                if (title) { tab.title = title; renderTabs(); }
            } catch (_) { }
        });

        // Set srcdoc after appending so the iframe is in the DOM
        iframe.srcdoc = srcdoc;

        const titleMatch = srcdoc.match(/<title>([^<]*)<\/title>/i);
        tab.title = (titleMatch?.[1]) || url.split('/').pop() || url;

        if (tab === activeTab) iframe.classList.add('active');
        renderTabs();
    }

    function showExternalPage(tab, url) {
        if (tab._iframe) { tab._iframe.remove(); tab._iframe = null; }
        if (tab._errEl) { tab._errEl.remove(); tab._errEl = null; }
        hideTabContent(tab);

        const iframe = document.createElement('iframe');
        iframe.className = 'br-page';
        iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;display:block;';
        iframe.allow = 'autoplay; fullscreen; picture-in-picture';
        iframe.referrerPolicy = 'no-referrer';

        // Set title from hostname while loading
        try { tab.title = new URL(url).hostname; } catch (_) { tab.title = url; }
        tab.isLoading = true;

        iframe.addEventListener('load', () => {
            tab.isLoading = false;
            // Try to read title (works for same-origin only)
            try {
                const t = iframe.contentDocument?.title;
                if (t) tab.title = t;
            } catch (_) { }
            renderTabs();
            if (tab === activeTab) updateToolbar();
        });

        // Detect refused connections — browser fires 'error' on the iframe
        // when X-Frame-Options blocks it or network fails
        iframe.addEventListener('error', () => {
            tab.isLoading = false;
            showFrameBlockedError(tab, url);
        });

        pagesEl.appendChild(iframe);
        tab._iframe = iframe;
        tab.pageEl.classList.remove('active');

        // We set src AFTER appending, and wrap in try/catch
        try {
            iframe.src = url;
        } catch (e) {
            showFrameBlockedError(tab, url);
            return;
        }

        if (tab === activeTab) iframe.classList.add('active');
        renderTabs();

        // Heuristic: if the iframe stays blank after 5s it's likely blocked
        // We check if contentDocument is accessible — if it throws it loaded cross-origin (which means it worked)
        // If it's accessible but empty, it was likely blocked
        setTimeout(() => {
            if (!tab._iframe) return;
            try {
                const doc = iframe.contentDocument;
                if (doc && doc.body && doc.body.childElementCount === 0 && doc.title === '') {
                    showFrameBlockedError(tab, url);
                }
            } catch (_) {
                // Cross-origin load — this is actually SUCCESS, do nothing
            }
        }, 5000);
    }

    function showFrameBlockedError(tab, url) {
        if (tab._iframe) { tab._iframe.remove(); tab._iframe = null; }
        hideTabContent(tab);
        tab.title = 'Blocked';
        tab.icon = '🚫';

        let hostname = url;
        try { hostname = new URL(url).hostname; } catch (_) { }

        const errEl = document.createElement('div');
        errEl.className = 'br-errpage active';
        errEl.innerHTML = `
            <div class="br-errpage-code" style="font-size:48px">🚫</div>
            <div class="br-errpage-msg">This site can't be embedded</div>
            <div class="br-errpage-sub">
                <strong>${hostname}</strong> has blocked iframe embedding<br>
                via <code style="font-size:10px;color:var(--br-text3)">X-Frame-Options</code> or
                <code style="font-size:10px;color:var(--br-text3)">Content-Security-Policy</code>.<br><br>
                This is a browser security restriction — it cannot be bypassed.<br>
                Sites like Google, YouTube, and Twitter all block embedding.<br><br>
                <a href="${url}" target="_blank"
                   style="color:var(--br-accent);text-decoration:none;font-size:12px">
                   ↗ Open in a real browser tab instead
                </a>
            </div>`;

        if (tab._errEl) tab._errEl.remove();
        pagesEl.appendChild(errEl);
        tab._errEl = errEl;
        tab.pageEl.classList.remove('active');
        if (tab === activeTab) errEl.classList.add('active');
        renderTabs();
        if (tab === activeTab) updateToolbar();
    }

    function showNewTab(tab) {
        if (tab._iframe) { tab._iframe.remove(); tab._iframe = null; }
        hideTabContent(tab);
        tab.url = null;
        tab.title = 'New Tab';
        tab.icon = '🌐';
        tab.pageEl.classList.add('active');
        refreshShortcuts(tab.pageEl, tab);
        if (tab === activeTab) updateToolbar();
        renderTabs();
    }

    function showError(tab, msg, url) {
        if (tab._iframe) { tab._iframe.remove(); tab._iframe = null; }
        hideTabContent(tab);
        tab.title = 'Error';
        tab.icon = '⚠️';

        const errEl = document.createElement('div');
        errEl.className = 'br-errpage active';
        errEl.innerHTML = `
            <div class="br-errpage-code">404</div>
            <div class="br-errpage-msg">Page not found</div>
            <div class="br-errpage-sub">${msg}<br><br><code style="font-size:10px;color:var(--br-text3)">${url}</code></div>`;

        if (tab._errEl) tab._errEl.remove();
        pagesEl.appendChild(errEl);
        tab._errEl = errEl;
        tab.pageEl.classList.remove('active');
        if (tab === activeTab) { errEl.classList.add('active'); }
        renderTabs();
    }

    function hideTabContent(tab) {
        if (tab._errEl) { tab._errEl.remove(); tab._errEl = null; }
        tab.pageEl.classList.remove('active');
        if (tab._iframe) tab._iframe.classList.remove('active');
    }

    // Show/hide right page when switching tabs
    function showTabContent(tab) {
        tabs.forEach(t => {
            if (t._iframe) t._iframe.classList.toggle('active', t === tab);
            if (t._errEl) t._errEl.classList.toggle('active', t === tab);
            t.pageEl.classList.toggle('active', t === tab && !t._iframe && !t._errEl);
        });
    }

    // Override activateTab to also show/hide page content
    const _activateTab = activateTab;
    activateTab = function (tab) {
        activeTab = tab;
        showTabContent(tab);
        renderTabs();
        updateToolbar();
    };

    // ── Bookmarks ──────────────────────────────────────────────────────────────
    function addHistory(url, icon, title) {
        history = history.filter(h => h.url !== url);
        history.unshift({ url, icon: icon || '📄', title: title || url });
        if (history.length > 50) history = history.slice(0, 50);
        saveHist();
        renderSidebar();
    }

    function toggleBookmark() {
        const tab = activeTab;
        if (!tab || !tab.url) return;
        const idx = bookmarks.findIndex(b => b.url === tab.url);
        if (idx >= 0) {
            bookmarks.splice(idx, 1);
        } else {
            bookmarks.unshift({ url: tab.url, icon: tab.icon || '📄', title: tab.title || tab.url });
            if (bookmarks.length > 50) bookmarks.length = 50;
        }
        saveBm();
        updateBookmarkBtn();
        renderSidebar();
    }

    function renderSidebar() {
        // Bookmarks
        bmList.innerHTML = '';
        if (!bookmarks.length) {
            bmList.innerHTML = '<div class="br-sidebar-empty">No bookmarks</div>';
        } else {
            bookmarks.forEach((bm, i) => {
                bmList.appendChild(sideItem(bm.icon, bm.title || bm.url, bm.url, () => {
                    bookmarks.splice(i, 1); saveBm(); updateBookmarkBtn(); renderSidebar();
                }));
            });
        }
        // History
        histList.innerHTML = '';
        if (!history.length) {
            histList.innerHTML = '<div class="br-sidebar-empty">No history</div>';
        } else {
            history.slice(0, 20).forEach((h, i) => {
                histList.appendChild(sideItem(h.icon, h.title || h.url, h.url, () => {
                    history.splice(i, 1); saveHist(); renderSidebar();
                }));
            });
        }
    }

    function sideItem(icon, label, url, onDel) {
        const el = document.createElement('div');
        el.className = 'br-sidebar-item';
        el.title = url;
        const ic = document.createElement('span');
        ic.className = 'br-sidebar-item-icon';
        ic.textContent = icon || '📄';
        const tx = document.createElement('span');
        tx.className = 'br-sidebar-item-text';
        tx.textContent = label;
        const dl = document.createElement('span');
        dl.className = 'br-sidebar-item-del';
        dl.textContent = '✕';
        dl.title = 'Remove';
        dl.addEventListener('click', (e) => { e.stopPropagation(); onDel(); });
        el.append(ic, tx, dl);
        el.addEventListener('click', () => { if (activeTab) navigate(activeTab, url); });
        return el;
    }

    // ── Sidebar toggle ─────────────────────────────────────────────────────────
    let sidebarVisible = true;
    sideToggle.addEventListener('click', () => {
        sidebarVisible = !sidebarVisible;
        sidebar.classList.toggle('hidden-side', !sidebarVisible);
    });

    clearBm.addEventListener('click', () => { bookmarks = []; saveBm(); renderSidebar(); });
    clearHist.addEventListener('click', () => { history = []; saveHist(); renderSidebar(); });

    // ── Address bar ────────────────────────────────────────────────────────────
    addressBar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = addressBar.value.trim();
            if (val && activeTab) navigate(activeTab, val);
        }
        if (e.key === 'Escape') { addressBar.blur(); }
    });
    addressBar.addEventListener('focus', () => { addressBar.select(); });

    backBtn.addEventListener('click', () => { if (activeTab) navBack(activeTab); });
    fwdBtn.addEventListener('click', () => { if (activeTab) navForward(activeTab); });
    reloadBtn.addEventListener('click', () => {
        const tab = activeTab;
        if (!tab || !tab.url) return;
        loadUrl(tab, tab.url, true);
    });
    bmBtn.addEventListener('click', toggleBookmark);

    // ── Icon setter ────────────────────────────────────────────────────────────
    iconBtn.addEventListener('click', () => {
        iconInput.value = activeTab?.icon || '';
        iconModal.classList.remove('hidden');
        setTimeout(() => iconInput.focus(), 30);
    });
    iconCancel.addEventListener('click', () => iconModal.classList.add('hidden'));
    iconConfirm.addEventListener('click', () => {
        const val = iconInput.value.trim();
        if (val && activeTab) {
            activeTab.icon = val;
            renderTabs();
            updateBookmarkBtn();
        }
        iconModal.classList.add('hidden');
    });
    iconInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') iconConfirm.click();
        if (e.key === 'Escape') iconModal.classList.add('hidden');
    });

    // ── New tab button ─────────────────────────────────────────────────────────
    $('#br-new-tab-btn').addEventListener('click', () => createTab());

    // ── Keyboard shortcuts ─────────────────────────────────────────────────────
    container.addEventListener('keydown', (e) => {
        const mod = e.ctrlKey || e.metaKey;
        if (mod && e.key === 't') { e.preventDefault(); createTab(); }
        if (mod && e.key === 'w') { e.preventDefault(); if (activeTab) closeTab(activeTab); }
        if (mod && e.key === 'r') { e.preventDefault(); if (activeTab?.url) loadUrl(activeTab, activeTab.url, true); }
        if (mod && e.key === 'l') { e.preventDefault(); addressBar.focus(); addressBar.select(); }
        if (mod && e.key === 'Tab') {
            e.preventDefault();
            const idx = tabs.indexOf(activeTab);
            activateTab(tabs[(idx + 1) % tabs.length]);
        }
        if (e.altKey && e.key === 'ArrowLeft') { if (activeTab) navBack(activeTab); }
        if (e.altKey && e.key === 'ArrowRight') { if (activeTab) navForward(activeTab); }
    });

    // ── Cross-frame navigation messages ───────────────────────────────────────
    window.addEventListener('message', (e) => {
        if (e.data?.type === 'br-navigate' && activeTab) {
            navigate(activeTab, e.data.url);
        }
    });

    // ── Init ───────────────────────────────────────────────────────────────────
    function init() {
        renderSidebar();
        const ctx = window.WebOS?.openContext;
        if (ctx?.url) {
            createTab(ctx.url);
        } else {
            createTab();
        }
    }

    if (window.WebOS) init();
    else {
        const poll = setInterval(() => { if (window.WebOS) { clearInterval(poll); init(); } }, 100);
    }
})();