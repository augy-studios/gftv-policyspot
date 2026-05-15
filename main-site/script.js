const API = '';

/* ─── State ─── */
let currentUser = null;
let sections = []; // all rows from DB
let currentSection = null; // currently displayed top-level page/article row
let currentSlug = null;

/* ─── Init ─── */
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initRouter();
    await restoreSession();
    await loadSections();
    setupEventListeners();
    handleRoute(location.pathname + location.hash);
});

/* ─── Theme ─── */
function initTheme() {
    applyTheme(localStorage.getItem('gftv-theme') || 'classic');
}

function applyTheme(theme) {
    document.body.dataset.theme = theme;
    localStorage.setItem('gftv-theme', theme);
    document.querySelectorAll('.theme-swatch').forEach(s =>
        s.classList.toggle('active', s.dataset.theme === theme));
}
document.querySelectorAll('.theme-swatch').forEach(s =>
    s.addEventListener('click', () => {
        applyTheme(s.dataset.theme);
        closeModal('theme-modal');
    }));

/* ─── Router ─── */
function initRouter() {
    window.addEventListener('popstate', () => handleRoute(location.pathname + location.hash));
}

function navigate(path, {
    replace = false
} = {}) {
    if (replace) history.replaceState({}, '', path);
    else history.pushState({}, '', path);
    handleRoute(path);
}

function handleRoute(fullPath) {
    const [path, hash] = fullPath.split('#');
    const cleanPath = path.replace(/\/$/, '') || '/';

    if (cleanPath === '/' || cleanPath === '') {
        showPage('home');
        updateActiveNav('home');
        return;
    }
    if (cleanPath === '/about') {
        showPage('about');
        updateActiveNav('about');
        return;
    }
    if (cleanPath === '/admin') {
        showPage('admin');
        updateActiveNav('');
        loadAdmin();
        return;
    }

    if (cleanPath === '/the-charter') {
        showPage('charter');
        updateActiveNav('charter');
        renderCharterIndex();
        ensureSidebarOpen();
        return;
    }
    if (cleanPath.startsWith('/the-charter/')) {
        const slug = cleanPath.slice('/the-charter/'.length);
        showPage('charter');
        updateActiveNav('charter');
        loadPage(slug, hash || null);
        ensureSidebarOpen();
        return;
    }
    showPage('home');
    updateActiveNav('home');
}

function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById(`page-${name}`);
    if (el) el.classList.add('active');
    if (name !== 'charter') window.scrollTo(0, 0);
}

function updateActiveNav(page) {
    document.querySelectorAll('.nav-link').forEach(l =>
        l.classList.toggle('active', l.dataset.page === page));
}

/* ─── Sections Data ─── */
async function loadSections() {
    try {
        const res = await apiFetch('/api/policy/sections');
        if (res.ok) {
            sections = res.sections || [];
            buildSidebar();
            buildArticleCards();
        }
    } catch (e) {
        console.error('Failed to load sections', e);
    }
}

// Top-level navigable pages: articles, standalone pages, schedules (not subsections)
function topLevelPages() {
    return sections.filter(s => s.type !== 'subsection').sort((a, b) => a.order_index - b.order_index);
}
// Subsections belonging to an article
function subsectionsOf(articleId) {
    return sections.filter(s => s.parent_id === articleId && s.type === 'subsection')
        .sort((a, b) => a.order_index - b.order_index);
}

/* ─── Sidebar ─── */
function buildSidebar() {
    const nav = document.getElementById('sidebar-nav');
    if (!sections.length) {
        nav.innerHTML = '<div class="sidebar-loading">No sections found.</div>';
        return;
    }
    nav.innerHTML = '';

    const pages = topLevelPages();
    pages.forEach(page => {
        const children = subsectionsOf(page.id);
        const div = document.createElement('div');
        div.className = 'nav-article';
        div.dataset.id = page.id;
        div.dataset.slug = page.slug;

        if (children.length) {
            // Article with sub-sections: clicking the article title navigates to the page,
            // chevron toggles the sub-list
            div.innerHTML = `
        <div class="nav-article-row">
          <button class="nav-article-btn" data-slug="${page.slug}">
            ${page.number ? `<span class="nav-number">${page.number}</span> ` : ''}${page.title}
          </button>
          <button class="nav-chevron-btn" aria-label="Toggle subsections">
            <svg class="nav-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="nav-subsections" style="display:none">
          ${children.map(c => `
            <button class="nav-sub-btn" data-slug="${page.slug}" data-anchor="${c.anchor || ''}">
              ${c.title}
            </button>`).join('')}
        </div>`;

            div.querySelector('.nav-article-btn').addEventListener('click', () => {
                navigate(`/the-charter/${page.slug}`);
                if (window.innerWidth < 900) closeSidebar();
            });
            div.querySelector('.nav-chevron-btn').addEventListener('click', () => {
                const sub = div.querySelector('.nav-subsections');
                const open = sub.style.display !== 'none';
                sub.style.display = open ? 'none' : 'block';
                div.classList.toggle('expanded', !open);
            });
            div.querySelectorAll('.nav-sub-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const slug = btn.dataset.slug;
                    const anchor = btn.dataset.anchor;
                    navigate(`/the-charter/${slug}${anchor ? '#' + anchor : ''}`);
                    if (window.innerWidth < 900) closeSidebar();
                });
            });
        } else {
            div.innerHTML = `
        <div class="nav-article-row">
          <button class="nav-article-btn" data-slug="${page.slug}">
            ${page.number ? `<span class="nav-number">${page.number}</span> ` : ''}${page.title}
          </button>
        </div>`;
            div.querySelector('.nav-article-btn').addEventListener('click', () => {
                navigate(`/the-charter/${page.slug}`);
                if (window.innerWidth < 900) closeSidebar();
            });
        }
        nav.appendChild(div);
    });
}

function buildArticleCards() {
    const grid = document.getElementById('article-cards');
    if (!grid) return;
    const pages = topLevelPages();
    if (!pages.length) return;
    grid.innerHTML = pages.map(p => `
    <div class="glass-card article-card" data-slug="${p.slug}" tabindex="0" role="button">
      ${p.number ? `<div class="card-num">${p.number}</div>` : ''}
      <div class="card-title">${p.title}</div>
    </div>`).join('');
    grid.querySelectorAll('.article-card').forEach(card => {
        const fn = () => navigate(`/the-charter/${card.dataset.slug}`);
        card.addEventListener('click', fn);
        card.addEventListener('keydown', e => e.key === 'Enter' && fn());
    });
}

/* ─── Charter Index ─── */
function renderCharterIndex() {
    const contentEl = document.getElementById('section-content');
    updateBreadcrumb(null);
    updateDocNavFooter(null);
    contentEl.innerHTML = `
    <div class="section-content-inner">
      <div class="section-header">
        <div class="section-type-badge">Document</div>
        <h1 class="section-heading">Charter of Global Furry Television</h1>
        <p style="color:var(--text-muted);margin-top:0.5rem">Edition 2024 — Policy, Action and Leadership (PAL) Division</p>
      </div>
      <div class="section-body">
        <p>The Charter of Global Furry Television is the supreme governing framework of GFTV, establishing its ethical and operational principles. Select a section from the sidebar, or use the table of contents below.</p>
        <h2>Table of Contents</h2>
        ${topLevelPages().map(p => {
          const children = subsectionsOf(p.id);
          return `<div style="margin-bottom:1rem">
            <a href="/the-charter/${p.slug}" class="toc-link" style="font-size:1rem;color:var(--brand-dark);display:block;margin-bottom:0.3rem">
              ${p.number ? `${p.number} — ` : ''}${p.title}
            </a>
            ${children.length ? `<ul style="margin:0 0 0 1.2rem;list-style:none;padding:0">
              ${children.map(c => `<li><a href="/the-charter/${p.slug}#${c.anchor}" class="toc-link" style="font-size:0.85rem;color:var(--text-muted)">${c.title}</a></li>`).join('')}
            </ul>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;

    // Wire up ToC links
    contentEl.querySelectorAll('.toc-link').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            navigate(a.getAttribute('href'));
        });
    });

    updateSidebarActive(null, null);
}

/* ─── Page Loading ─── */
async function loadPage(slug, anchor) {
    const contentEl = document.getElementById('section-content');
    contentEl.innerHTML = '<div class="section-loading"><span class="spinner large"></span><p>Loading...</p></div>';
    updateBreadcrumb(null);
    updateDocNavFooter(null);

    // Look up in local cache first for instant feel
    let section = sections.find(s => s.slug === slug && s.type !== 'subsection');

    if (!section) {
        // Try fetching from API (handles custom slugs)
        try {
            const res = await apiFetch(`/api/policy/section?slug=${encodeURIComponent(slug)}`);
            if (!res.ok) throw new Error(res.error || 'Not found');
            section = res.section;
            // Also pull subsections if this is an article
            if (section.type === 'article' || section.type === 'page') {
                const allRes = await apiFetch('/api/policy/sections');
                if (allRes.ok) sections = allRes.sections;
            }
        } catch (e) {
            contentEl.innerHTML = `<div class="section-content-inner">
        <h1 class="section-heading">Not Found</h1>
        <p>The section <code>${slug}</code> could not be loaded.</p>
        <a href="/the-charter" style="color:var(--brand-dark)">Back to Charter</a>
      </div>`;
            return;
        }
    }

    currentSection = section;
    currentSlug = slug;

    if (section.type === 'article') {
        renderArticlePage(section, anchor);
    } else {
        renderStandalonePage(section);
    }

    updateBreadcrumb(section);
    updateDocNavFooter(section);
    updateSidebarActive(slug, anchor);

    // Scroll to anchor after render
    if (anchor) {
        setTimeout(() => {
            const el = document.getElementById(anchor);
            if (el) el.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 80);
    } else {
        window.scrollTo(0, 0);
    }
}

/* Renders an article page: intro block + all subsections inline with anchor ids */
function renderArticlePage(article, activeAnchor) {
    const contentEl = document.getElementById('section-content');
    const subs = subsectionsOf(article.id);
    const canEdit = currentUser && (currentUser.is_admin || currentUser.is_editor);

    let html = `<div class="section-content-inner">
    <div class="section-header">
      <div class="section-type-badge">Article</div>
      <div class="section-meta">
        <span class="section-slug-display">/the-charter/${article.slug}</span>
        ${canEdit ? `<button class="edit-slug-btn" data-id="${article.id}" data-slug="${article.slug}">Edit slug</button>` : ''}
      </div>
      <h1 class="section-heading">${article.number ? `${article.number} — ` : ''}${article.title}</h1>
    </div>`;

    if (article.content) {
        html += `<div class="section-body article-intro">${renderMarkdown(article.content)}</div>`;
    }

    // Render subsections inline
    subs.forEach(sub => {
        html += `
      <div class="subsection-block" id="${sub.anchor || sub.slug}">
        <div class="subsection-header">
          <h2 class="subsection-heading">
            <a class="anchor-link" href="/the-charter/${article.slug}#${sub.anchor || sub.slug}" aria-label="Link to section">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </a>
            ${sub.title}
          </h2>
          ${sub.number ? `<span class="subsection-num">${sub.number}</span>` : ''}
        </div>
        <div class="section-body subsection-body">${renderMarkdown(sub.content || '')}</div>
      </div>`;
    });

    html += `</div>`;
    contentEl.innerHTML = html;

    // Wire edit-slug buttons
    if (canEdit) {
        contentEl.querySelectorAll('.edit-slug-btn').forEach(btn => {
            const sec = sections.find(s => s.id === btn.dataset.id) || article;
            btn.addEventListener('click', () => openSlugModal(sec));
        });
    }

    // Wire anchor links — update URL without full reload
    contentEl.querySelectorAll('.anchor-link').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            const href = a.getAttribute('href');
            history.replaceState({}, '', href);
        });
    });
}

/* Renders a standalone page (Citation, Definitions, First Schedule) */
function renderStandalonePage(section) {
    const contentEl = document.getElementById('section-content');
    const canEdit = currentUser && (currentUser.is_admin || currentUser.is_editor);
    const typeLabel = {
        page: 'Section',
        schedule: 'Schedule'
    } [section.type] || 'Section';

    contentEl.innerHTML = `
    <div class="section-content-inner">
      <div class="section-header">
        <div class="section-type-badge">${typeLabel}</div>
        <div class="section-meta">
          <span class="section-slug-display">/the-charter/${section.slug}</span>
          ${canEdit ? `<button class="edit-slug-btn" data-id="${section.id}" data-slug="${section.slug}">Edit slug</button>` : ''}
        </div>
        <h1 class="section-heading">${section.number ? `${section.number} — ` : ''}${section.title}</h1>
      </div>
      <div class="section-body" id="section-body-content">${renderMarkdown(section.content || '')}</div>
    </div>`;

    if (canEdit) {
        contentEl.querySelector('.edit-slug-btn')?.addEventListener('click', () => openSlugModal(section));
    }
}

/* ─── Markdown Renderer ─── */
function renderMarkdown(md) {
    let html = md
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Tables
    html = html.replace(/^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)+)/gm, (_, header, body) => {
        const ths = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
        const trs = body.trim().split('\n').map(row => {
            const tds = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
            return `<tr>${tds}</tr>`;
        }).join('');
        return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
    });
    // Headings
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    // HR
    html = html.replace(/^---$/gm, '<hr/>');
    // Blockquote
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    // Bold / italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    // Inline code
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    // Unordered lists
    html = html.replace(/((?:^- .+\n?)+)/gm, match => {
        const items = match.trim().split('\n').map(l => `<li>${l.replace(/^- /, '')}</li>`).join('');
        return `<ul>${items}</ul>`;
    });
    // Ordered lists
    html = html.replace(/((?:^\d+\. .+\n?)+)/gm, match => {
        const items = match.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
        return `<ol>${items}</ol>`;
    });
    // Paragraphs
    html = html.split(/\n\n+/).map(para => {
        const t = para.trim();
        if (!t) return '';
        if (/^<(h[1-6]|ul|ol|table|blockquote|hr)/.test(t)) return t;
        return `<p>${t.replace(/\n/g, '<br/>')}</p>`;
    }).join('\n');
    return html;
}

/* ─── Breadcrumb ─── */
function updateBreadcrumb(section) {
    const bc = document.getElementById('doc-breadcrumb');
    if (!bc) return;
    const sep = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    if (!section) {
        bc.innerHTML = `<a href="/" class="bc-link">Home</a>${sep}<a href="/the-charter" class="bc-link">Charter</a>`;
    } else {
        bc.innerHTML = `<a href="/" class="bc-link">Home</a>${sep}<a href="/the-charter" class="bc-link">Charter</a>${sep}<span>${section.title}</span>`;
    }
    bc.querySelectorAll('.bc-link').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            navigate(a.getAttribute('href'));
        });
    });
}

/* ─── Prev/Next Footer ─── */
function updateDocNavFooter(section) {
    const footer = document.getElementById('doc-nav-footer');
    if (!footer) return;
    if (!section) {
        footer.innerHTML = '';
        return;
    }
    const pages = topLevelPages();
    const idx = pages.findIndex(s => s.id === section.id);
    const prev = idx > 0 ? pages[idx - 1] : null;
    const next = idx < pages.length - 1 ? pages[idx + 1] : null;
    footer.innerHTML = `
    ${prev ? `<button class="doc-nav-btn" data-slug="${prev.slug}">
      <span class="doc-nav-label">← Previous</span>
      <span class="doc-nav-title">${prev.number ? prev.number + ' — ' : ''}${prev.title}</span>
    </button>` : '<span></span>'}
    ${next ? `<button class="doc-nav-btn next" data-slug="${next.slug}">
      <span class="doc-nav-label">Next →</span>
      <span class="doc-nav-title">${next.number ? next.number + ' — ' : ''}${next.title}</span>
    </button>` : ''}`;
    footer.querySelectorAll('.doc-nav-btn').forEach(btn =>
        btn.addEventListener('click', () => navigate(`/the-charter/${btn.dataset.slug}`)));
}

/* ─── Sidebar Active State ─── */
function updateSidebarActive(slug, anchor) {
    // Clear all active states
    document.querySelectorAll('.nav-article-btn, .nav-sub-btn').forEach(el => el.classList.remove('active'));

    if (!slug) return;

    // Mark the article button active
    document.querySelectorAll(`.nav-article-btn[data-slug="${slug}"]`).forEach(el => el.classList.add('active'));

    if (anchor) {
        // Mark the specific subsection button active
        document.querySelectorAll(`.nav-sub-btn[data-slug="${slug}"][data-anchor="${anchor}"]`)
            .forEach(el => el.classList.add('active'));
    }

    // Expand the parent article
    const articleDiv = document.querySelector(`.nav-article[data-slug="${slug}"]`);
    if (articleDiv) {
        const sub = articleDiv.querySelector('.nav-subsections');
        if (sub) {
            sub.style.display = 'block';
            articleDiv.classList.add('expanded');
        }
    }
}

/* ─── Sidebar Toggle ─── */
function ensureSidebarOpen() {
    if (window.innerWidth >= 900) return; // desktop: always visible
    // Don't auto-open on mobile, let user toggle
}

function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('show');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('show');
}

/* ─── Session / Auth ─── */
async function restoreSession() {
    const token = localStorage.getItem('gftv-token');
    if (!token) return;
    try {
        const res = await apiFetch('/api/auth/me', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        if (res.ok) {
            currentUser = res.user;
            updateUserUI();
        } else localStorage.removeItem('gftv-token');
    } catch (e) {
        localStorage.removeItem('gftv-token');
    }
}

function updateUserUI() {
    const area = document.getElementById('user-area');
    if (!area) return;
    if (currentUser) {
        area.innerHTML = `
      <div class="user-chip" id="user-chip" tabindex="0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="2"/></svg>
        ${currentUser.display_name}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2"/></svg>
        <div class="user-dropdown" id="user-dropdown" style="display:none">
          ${currentUser.is_admin ? `<button class="user-dropdown-item" id="goto-admin">Admin Panel</button>` : ''}
          <button class="user-dropdown-item danger" id="logout-btn">Sign Out</button>
        </div>
      </div>`;
        const chip = document.getElementById('user-chip');
        chip.addEventListener('click', e => {
            e.stopPropagation();
            const dd = document.getElementById('user-dropdown');
            dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
        });
        document.getElementById('logout-btn')?.addEventListener('click', logout);
        document.getElementById('goto-admin')?.addEventListener('click', () => navigate('/admin'));
        document.addEventListener('click', () => {
            const dd = document.getElementById('user-dropdown');
            if (dd) dd.style.display = 'none';
        }, {
            once: true
        });
    } else {
        area.innerHTML = `<button class="btn btn-ghost btn-sm" id="login-btn">Sign In</button>`;
        document.getElementById('login-btn')?.addEventListener('click', () => openModal('auth-modal'));
    }
}
async function logout() {
    const token = localStorage.getItem('gftv-token');
    if (token) await apiFetch('/api/auth/logout', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    localStorage.removeItem('gftv-token');
    currentUser = null;
    updateUserUI();
    showToast('Signed out', 'success');
    if (location.pathname === '/admin') navigate('/');
}

/* ─── Auth Form ─── */
document.getElementById('login-submit')?.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    clearAuthError();
    if (!email || !password) return showAuthError('Please fill in all fields.');
    const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            email,
            password
        }),
        headers: {
            'Content-Type': 'application/json'
        }
    });
    if (res.ok) {
        localStorage.setItem('gftv-token', res.token);
        currentUser = res.user;
        updateUserUI();
        closeModal('auth-modal');
        showToast('Welcome back, ' + res.user.display_name, 'success');
    } else showAuthError(res.error || 'Login failed');
});
document.getElementById('reg-submit')?.addEventListener('click', async () => {
    const display_name = document.getElementById('reg-display').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    clearAuthError();
    if (!display_name || !username || !email || !password) return showAuthError('Please fill in all fields.');
    const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            display_name,
            username,
            email,
            password
        }),
        headers: {
            'Content-Type': 'application/json'
        }
    });
    if (res.ok) {
        closeModal('auth-modal');
        showToast('Account created! Awaiting admin approval.', 'success');
    } else showAuthError(res.error || 'Registration failed');
});
document.getElementById('show-register')?.addEventListener('click', () => {
    document.getElementById('auth-form-login').classList.add('hidden');
    document.getElementById('auth-form-register').classList.remove('hidden');
    document.getElementById('auth-modal-title').textContent = 'Create Account';
    clearAuthError();
});
document.getElementById('show-login')?.addEventListener('click', () => {
    document.getElementById('auth-form-register').classList.add('hidden');
    document.getElementById('auth-form-login').classList.remove('hidden');
    document.getElementById('auth-modal-title').textContent = 'Sign In';
    clearAuthError();
});

function showAuthError(msg) {
    const el = document.getElementById('auth-error');
    if (el) {
        el.textContent = msg;
        el.classList.remove('hidden');
    }
}

function clearAuthError() {
    const el = document.getElementById('auth-error');
    if (el) {
        el.textContent = '';
        el.classList.add('hidden');
    }
}

/* ─── Copy Toolbar ─── */
function setupCopyDropdown() {
    const btn = document.getElementById('copy-dropdown-btn');
    const dd = document.getElementById('copy-dropdown');
    if (!btn || !dd) return;
    btn.addEventListener('click', e => {
        e.stopPropagation();
        dd.hidden = !dd.hidden;
    });
    document.addEventListener('click', () => {
        if (dd) dd.hidden = true;
    });

    document.getElementById('action-copy-md')?.addEventListener('click', () => {
        dd.hidden = true;
        if (!currentSection) return showToast('No page loaded', 'error');
        const subs = currentSection.type === 'article' ? subsectionsOf(currentSection.id) : [];
        let md = `# ${currentSection.title}\n\nSource: https://policy.globalfurry.tv/the-charter/${currentSection.slug}\n\n${currentSection.content || ''}`;
        subs.forEach(s => {
            md += `\n\n## ${s.title}\n\n${s.content || ''}`;
        });
        navigator.clipboard.writeText(md).then(() => showToast('Copied as Markdown', 'success'));
    });

    document.getElementById('action-view-md')?.addEventListener('click', () => {
        dd.hidden = true;
        if (!currentSection) return showToast('No page loaded', 'error');
        const subs = currentSection.type === 'article' ? subsectionsOf(currentSection.id) : [];
        let md = `# ${currentSection.title}\n\nSource: https://policy.globalfurry.tv/the-charter/${currentSection.slug}\n\n${currentSection.content || ''}`;
        subs.forEach(s => {
            md += `\n\n## ${s.title}\n\n${s.content || ''}`;
        });
        const blob = new Blob([md], {
            type: 'text/plain'
        });
        window.open(URL.createObjectURL(blob), '_blank');
    });

    document.getElementById('action-export-pdf')?.addEventListener('click', () => {
        dd.hidden = true;
        window.print();
    });

    document.getElementById('action-chatgpt')?.addEventListener('click', () => {
        dd.hidden = true;
        const pageUrl = currentSection ?
            `https%3A%2F%2Fpolicy.globalfurry.tv%2Fthe-charter%2F${currentSection.slug}` :
            `https%3A%2F%2Fpolicy.globalfurry.tv`;
        window.open(`https://chat.openai.com/?q=Read%20${pageUrl}%20and%20answer%20questions%20about%20the%20content.`, '_blank');
    });

    document.getElementById('action-claude')?.addEventListener('click', () => {
        dd.hidden = true;
        const pageUrl = currentSection ?
            `https%3A%2F%2Fpolicy.globalfurry.tv%2Fthe-charter%2F${currentSection.slug}` :
            `https%3A%2F%2Fpolicy.globalfurry.tv`;
        window.open(`https://claude.ai/new?q=Read%20${pageUrl}%20and%20answer%20questions%20about%20the%20content.`, '_blank');
    });
}

/* ─── Slug Modal ─── */
function openSlugModal(section) {
    document.getElementById('slug-input').value = section.slug;
    document.getElementById('slug-section-id').value = section.id;
    document.getElementById('slug-preview').textContent = `policy.globalfurry.tv/the-charter/${section.slug}`;
    document.getElementById('slug-error').classList.add('hidden');
    openModal('slug-modal');
}
document.getElementById('slug-input')?.addEventListener('input', e => {
    const preview = document.getElementById('slug-preview');
    if (preview) preview.textContent = `policy.globalfurry.tv/the-charter/${e.target.value}`;
});
document.getElementById('slug-save')?.addEventListener('click', async () => {
    const id = document.getElementById('slug-section-id').value;
    const slug = document.getElementById('slug-input').value.trim();
    const errEl = document.getElementById('slug-error');
    errEl.classList.add('hidden');
    if (!slug) {
        errEl.textContent = 'Slug cannot be empty';
        errEl.classList.remove('hidden');
        return;
    }
    const token = localStorage.getItem('gftv-token');
    const res = await apiFetch('/api/policy/update-slug', {
        method: 'PUT',
        body: JSON.stringify({
            id,
            slug
        }),
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        }
    });
    if (res.ok) {
        closeModal('slug-modal');
        showToast('Slug updated', 'success');
        const sec = sections.find(s => s.id === id);
        if (sec) sec.slug = slug;
        navigate(`/the-charter/${slug}`);
        buildSidebar();
    } else {
        errEl.textContent = res.error || 'Update failed';
        errEl.classList.remove('hidden');
    }
});

/* ─── Admin ─── */
async function loadAdmin() {
    if (!currentUser || !currentUser.is_admin) {
        showPage('home');
        showToast('Admin access required', 'error');
        return;
    }
    const token = localStorage.getItem('gftv-token');
    const res = await apiFetch('/api/admin/users', {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    const listEl = document.getElementById('admin-users-list');
    if (!res.ok || !listEl) return;
    const users = res.users || [];
    listEl.innerHTML = `<table class="users-table">
    <thead><tr><th>Display Name</th><th>Username</th><th>Email</th><th>Approved</th><th>Admin</th><th>Editor</th><th>Actions</th></tr></thead>
    <tbody>${users.map(u => `<tr>
      <td>${u.display_name}</td><td>@${u.username}</td><td>${u.email}</td>
      <td><span class="badge ${u.is_approved ? 'badge-green' : 'badge-red'}">${u.is_approved ? 'Yes' : 'No'}</span></td>
      <td><span class="badge ${u.is_admin ? 'badge-green' : 'badge-grey'}">${u.is_admin ? 'Yes' : 'No'}</span></td>
      <td><span class="badge ${u.is_editor ? 'badge-green' : 'badge-grey'}">${u.is_editor ? 'Yes' : 'No'}</span></td>
      <td>
        ${!u.is_approved ? `<button class="btn btn-sm btn-primary" onclick="approveUser('${u.id}')">Approve</button>` : ''}
        ${!u.is_editor ? `<button class="btn btn-sm btn-ghost" onclick="makeEditor('${u.id}')">Make Editor</button>` : ''}
      </td>
    </tr>`).join('')}</tbody></table>`;

    document.getElementById('seed-btn')?.addEventListener('click', runSeed);
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`)?.classList.remove('hidden');
        });
    });
}
window.approveUser = async function (id) {
    const token = localStorage.getItem('gftv-token');
    const res = await apiFetch('/api/admin/users', {
        method: 'PUT',
        body: JSON.stringify({
            id,
            is_approved: true
        }),
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        }
    });
    if (res.ok) {
        showToast('User approved', 'success');
        loadAdmin();
    } else showToast(res.error || 'Failed', 'error');
};
window.makeEditor = async function (id) {
    const token = localStorage.getItem('gftv-token');
    const res = await apiFetch('/api/admin/users', {
        method: 'PUT',
        body: JSON.stringify({
            id,
            is_editor: true
        }),
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        }
    });
    if (res.ok) {
        showToast('Editor role granted', 'success');
        loadAdmin();
    } else showToast(res.error || 'Failed', 'error');
};
async function runSeed() {
    const token = localStorage.getItem('gftv-token');
    const btn = document.getElementById('seed-btn');
    const out = document.getElementById('seed-output');
    btn.disabled = true;
    btn.textContent = 'Seeding...';
    const res = await apiFetch('/api/admin/seed', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    btn.disabled = false;
    btn.textContent = 'Run Seed';
    out.classList.remove('hidden');
    out.textContent = JSON.stringify(res, null, 2);
    if (res.ok) {
        showToast(`Seeded ${res.seeded} sections`, 'success');
        await loadSections();
    } else showToast(res.error || 'Seed failed', 'error');
}

/* ─── Modals ─── */
function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.hidden = false;
        el.removeAttribute('hidden');
    }
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
}
document.querySelectorAll('.modal-close, [data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.close || btn.closest('.modal-overlay')?.id;
        if (target) closeModal(target);
    });
});
document.querySelectorAll('.modal-overlay').forEach(overlay =>
    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeModal(overlay.id);
    }));

/* ─── Toast ─── */
function showToast(msg, type = '') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ?
        '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" stroke-width="2"/><polyline points="22,4 12,14.01 9,11.01" stroke="currentColor" stroke-width="2"/>' :
        '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/>';
    toast.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">${icon}</svg>${msg}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* ─── API Helper ─── */
async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('gftv-token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    if (token && !headers['Authorization']) headers['Authorization'] = `Bearer ${token}`;
    try {
        const res = await fetch(url, {
            ...options,
            headers
        });
        return await res.json();
    } catch (e) {
        return {
            ok: false,
            error: 'Network error'
        };
    }
}

/* ─── Event Listeners ─── */
function setupEventListeners() {
    document.getElementById('theme-btn')?.addEventListener('click', () => openModal('theme-modal'));
    document.getElementById('menu-btn')?.addEventListener('click', openSidebar);
    document.getElementById('sidebar-close')?.addEventListener('click', closeSidebar);
    document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
    document.getElementById('login-btn')?.addEventListener('click', () => openModal('auth-modal'));

    document.querySelectorAll('.nav-link').forEach(l => {
        l.addEventListener('click', e => {
            e.preventDefault();
            const p = l.dataset.page;
            if (p === 'home') navigate('/');
            else if (p === 'charter') navigate('/the-charter');
            else if (p === 'about') navigate('/about');
        });
    });

    // Hero / static links with data-navlink
    document.querySelectorAll('[data-navlink]').forEach(el => {
        el.addEventListener('click', e => {
            const href = el.getAttribute('href');
            if (href && href.startsWith('/')) {
                e.preventDefault();
                navigate(href);
            }
        });
    });

    setupCopyDropdown();
}

/* ─── PWA ─── */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}