const API = '';

/* ─── Doc config ─── */
const DOCS = {
    charter: {
        apiSections: '/api/policy/sections',
        apiSection:  '/api/policy/section',
        urlBase:     '/the-charter',
        label:       'Charter of Global Furry Television',
        navPage:     'charter',
        sidebarTitle:'Charter',
        contentEl:   'section-content',
        breadcrumbEl:'doc-breadcrumb',
        navFooterEl: 'doc-nav-footer',
    },
    news: {
        apiSections: '/api/policy/news/sections',
        apiSection:  '/api/policy/news/section',
        urlBase:     '/news',
        label:       'News Standards',
        navPage:     'news',
        sidebarTitle:'News Standards',
        contentEl:   'news-content',
        breadcrumbEl:'news-breadcrumb',
        navFooterEl: 'news-nav-footer',
    },
    prs: {
        apiSections: '/api/policy/prs/sections',
        apiSection:  '/api/policy/prs/section',
        urlBase:     '/prs',
        label:       'Programme Rating System',
        navPage:     'prs',
        sidebarTitle:'Programme Rating System',
        contentEl:   'prs-content',
        breadcrumbEl:'prs-breadcrumb',
        navFooterEl: 'prs-nav-footer',
    },
    rules: {
        apiSections: '/api/policy/rules/sections',
        apiSection:  '/api/policy/rules/section',
        urlBase:     '/rules',
        label:       'Community Rules',
        navPage:     'rules',
        sidebarTitle:'Community Rules',
        contentEl:   'rules-content',
        breadcrumbEl:'rules-breadcrumb',
        navFooterEl: 'rules-nav-footer',
    },
    join: {
        apiSections: '/api/policy/join/sections',
        apiSection:  '/api/policy/join/section',
        urlBase:     '/join-us',
        label:       'Join GFTV',
        navPage:     'join',
        sidebarTitle:'Join GFTV',
        contentEl:   'join-content',
        breadcrumbEl:'join-breadcrumb',
        navFooterEl: 'join-nav-footer',
        defaultSlug: 'home',
    },
    legal: {
        apiSections: '/api/policy/legal/sections',
        apiSection:  '/api/policy/legal/section',
        urlBase:     '/legal',
        label:       'Legal',
        navPage:     '',
        sidebarTitle:'Legal',
        contentEl:   'legal-content',
        breadcrumbEl:'legal-breadcrumb',
        navFooterEl: 'legal-nav-footer',
    },
};

/* ─── State ─── */
let currentUser = null;
let currentDoc = 'charter'; // active document key
const docSectionsCache = {}; // { charter: [], news: [], ... }
let sections = []; // alias for docSectionsCache[currentDoc]
let currentSection = null; // currently displayed top-level page/article row
let currentSlug = null;

/* ─── Init ─── */
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initRouter();
    await restoreSession();
    await loadSections('charter');
    setupEventListeners();
    handleRoute(location.pathname + location.hash);
});

/* ─── Theme ─── */
function initTheme() {
    const saved = localStorage.getItem('gftv-theme');
    const valid = ['light', 'hello'];
    applyTheme(valid.includes(saved) ? saved : 'light');
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

async function handleRoute(fullPath) {
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

    // Check each doc's urlBase for a match
    for (const [docKey, doc] of Object.entries(DOCS)) {
        const base = doc.urlBase; // e.g. '/the-charter', '/news'
        if (cleanPath === base) {
            await switchDoc(docKey);
            showPage(docKey === 'charter' ? 'charter' : docKey);
            updateActiveNav(doc.navPage);
            if (doc.defaultSlug) {
                loadPage(doc.defaultSlug, null);
            } else {
                await renderDocIndex();
            }
            ensureSidebarOpen();
            return;
        }
        if (cleanPath.startsWith(base + '/')) {
            const slug = cleanPath.slice(base.length + 1);
            await switchDoc(docKey);
            showPage(docKey === 'charter' ? 'charter' : docKey);
            updateActiveNav(doc.navPage);
            loadPage(slug, hash || null);
            ensureSidebarOpen();
            return;
        }
    }

    showPage('home');
    updateActiveNav('home');
}

/* Switch active doc context, loading sections if needed */
async function switchDoc(docKey) {
    if (currentDoc !== docKey) {
        currentDoc = docKey;
        sections = docSectionsCache[docKey] || [];
    }
    if (!docSectionsCache[docKey]) {
        await loadSections(docKey);
    } else {
        sections = docSectionsCache[docKey];
        buildSidebar();
    }
}

function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById(`page-${name}`);
    if (el) el.classList.add('active');
    if (name !== 'charter') window.scrollTo(0, 0);

    if (name === 'home' || name === 'join' || name === 'about' || name === 'admin') {
        buildHomeSidebar();
        if (window.innerWidth >= 900) {
            document.getElementById('sidebar')?.classList.remove('collapsed');
            document.getElementById('main-content')?.classList.remove('sidebar-hidden');
        }
    } else {
        if (window.innerWidth >= 900) {
            document.getElementById('sidebar')?.classList.remove('collapsed');
            document.getElementById('main-content')?.classList.remove('sidebar-hidden');
        }
    }
}

function buildHomeSidebar() {
    const nav = document.getElementById('sidebar-nav');
    const titleEl = document.querySelector('.sidebar-title');
    if (titleEl) titleEl.textContent = 'Site Navigation';
    if (!nav) return;
    nav.innerHTML = '';

    SITE_PAGES.forEach(p => {
        const div = document.createElement('div');
        div.className = 'nav-article';
        const btn = document.createElement('button');
        btn.className = 'nav-article-btn';
        btn.innerHTML = `${p.icon} ${p.label}`;
        btn.addEventListener('click', () => {
            navigate(p.href);
            if (window.innerWidth < 900) closeSidebar();
        });
        const row = document.createElement('div');
        row.className = 'nav-article-row';
        row.appendChild(btn);
        div.appendChild(row);
        nav.appendChild(div);
    });
}

function updateActiveNav(page) {
    document.querySelectorAll('.nav-link').forEach(l =>
        l.classList.toggle('active', l.dataset.page === page));
}

/* ─── Sections Data ─── */
async function loadSections(docKey = 'charter', { force = false } = {}) {
    if (!force && docSectionsCache[docKey]) {
        sections = docSectionsCache[docKey];
        buildSidebar();
        if (docKey === 'charter') buildArticleCards();
        return;
    }
    try {
        const doc = DOCS[docKey];
        const res = await apiFetch(doc.apiSections);
        if (res.ok) {
            docSectionsCache[docKey] = res.sections || [];
            sections = docSectionsCache[docKey];
            buildSidebar();
            if (docKey === 'charter') await buildArticleCards();
        }
    } catch (e) {
        console.error('Failed to load sections for', docKey, e);
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
    const titleEl = document.querySelector('.sidebar-title');
    if (titleEl) titleEl.textContent = DOCS[currentDoc].sidebarTitle;

    nav.innerHTML = '';
    if (!sections.length) {
        nav.innerHTML = '<div class="sidebar-loading">No sections found.</div>';
    }

    const urlBase = DOCS[currentDoc].urlBase;
    const pages = topLevelPages();
    pages.forEach(page => {
        const children = subsectionsOf(page.id);
        const div = document.createElement('div');
        div.className = 'nav-article';
        div.dataset.id = page.id;
        div.dataset.slug = page.slug;

        if (children.length) {
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
                navigate(`${urlBase}/${page.slug}`);
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
                    navigate(`${urlBase}/${slug}${anchor ? '#' + anchor : ''}`);
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
                navigate(`${urlBase}/${page.slug}`);
                if (window.innerWidth < 900) closeSidebar();
            });
        }
        nav.appendChild(div);
    });

    if (currentUser?.is_admin) {
        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-sm btn-ghost sidebar-add-btn';
        addBtn.textContent = '+ Add Section';
        addBtn.addEventListener('click', () => openAddSectionModal(null));
        nav.appendChild(addBtn);
    }

    nav.appendChild(buildSiteNavSection());
}

const SITE_PAGES = [
    { label: 'Charter', href: '/the-charter', icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" stroke-width="2"/><polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2"/></svg>` },
    { label: 'News Standards', href: '/news', icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
    { label: 'Programme Rating System', href: '/prs', icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="23 7 16 12 23 17 23 7" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><rect x="1" y="5" width="15" height="14" rx="2" stroke="currentColor" stroke-width="2"/></svg>` },
    { label: 'Community Rules', href: '/rules', icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>` },
    { label: 'Join Us', href: '/join-us', icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/></svg>` },
    { label: 'About PolicySpot', href: '/about', icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>` },
];

function buildSiteNavSection() {
    const wrapper = document.createElement('div');
    wrapper.className = 'site-nav-section';

    const header = document.createElement('button');
    header.className = 'site-nav-header';
    header.setAttribute('aria-expanded', 'false');
    header.innerHTML = `
        <span>Site Navigation</span>
        <svg class="nav-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>`;

    const list = document.createElement('div');
    list.className = 'site-nav-list';
    list.hidden = true;

    const currentHref = DOCS[currentDoc]?.urlBase;
    SITE_PAGES.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'nav-sub-btn site-nav-link' + (p.href === currentHref ? ' active' : '');
        btn.innerHTML = `${p.icon} ${p.label}`;
        btn.addEventListener('click', () => {
            navigate(p.href);
            if (window.innerWidth < 900) closeSidebar();
        });
        list.appendChild(btn);
    });

    header.addEventListener('click', () => {
        const open = !list.hidden;
        list.hidden = open;
        header.setAttribute('aria-expanded', String(!open));
        header.querySelector('.nav-chevron').style.transform = open ? '' : 'rotate(90deg)';
    });

    wrapper.appendChild(header);
    wrapper.appendChild(list);
    return wrapper;
}

async function buildArticleCards() {
    const grid = document.getElementById('article-cards');
    if (!grid) return;
    const pages = topLevelPages();
    if (!pages.length) return;
    const urlBase = DOCS['charter'].urlBase;

    let viewCounts = {};
    try {
        const res = await apiFetch('/api/policy/section-views?doc=charter');
        if (res.ok) viewCounts = res.views || {};
    } catch {}

    const pagesWithViews = pages.map(p => {
        const subs = subsectionsOf(p.id);
        const allIds = [p.id, ...subs.map(s => s.id)];
        const total = allIds.reduce((sum, id) => sum + (viewCounts[id] || 0), 0);
        return { ...p, totalViews: total };
    });

    const hasAnyViews = pagesWithViews.some(p => p.totalViews > 0);
    if (hasAnyViews) {
        pagesWithViews.sort((a, b) => {
            if (b.totalViews !== a.totalViews) return b.totalViews - a.totalViews;
            return a.order_index - b.order_index;
        });
    }

    grid.innerHTML = pagesWithViews.map(p => `
    <div class="glass-card article-card" data-slug="${p.slug}" tabindex="0" role="button">
      ${p.number ? `<div class="card-num">${p.number}</div>` : ''}
      <div class="card-title">${p.title}</div>
      ${p.totalViews > 0 ? `<div class="card-views">${Number(p.totalViews).toLocaleString()} view${p.totalViews === 1 ? '' : 's'}</div>` : ''}
    </div>`).join('');
    grid.querySelectorAll('.article-card').forEach(card => {
        const fn = () => navigate(`${urlBase}/${card.dataset.slug}`);
        card.addEventListener('click', fn);
        card.addEventListener('keydown', e => e.key === 'Enter' && fn());
    });
}

/* ─── Doc Index (charter index generalised for all docs) ─── */
async function renderDocIndex() {
    const doc = DOCS[currentDoc];
    updateBreadcrumb(null);
    updateDocNavFooter(null);
    updateSidebarActive(null, null);

    if (currentDoc === 'charter') {
        const indexView = document.getElementById('charter-index-view');
        const articleView = document.getElementById('charter-article-view');
        if (indexView) indexView.style.display = '';
        if (articleView) articleView.style.display = 'none';
        await buildArticleCards();
        return;
    }

    const contentEl = document.getElementById(doc.contentEl);
    if (!contentEl) return;
    const urlBase = doc.urlBase;
    const pages = topLevelPages();

    contentEl.innerHTML = `
    <div class="section-content-inner">
      <div class="section-header">
        ${currentUser && (currentUser.is_admin || currentUser.is_editor) ? '<div class="section-type-badge">Document</div>' : ''}
        <h1 class="section-heading">${doc.label}</h1>
      </div>
      <section class="section-grid">
        <h2 class="section-title">Most Viewed Pages</h2>
        <div class="card-grid" id="doc-index-cards">
          ${pages.map(() => '<div class="glass-card article-card skeleton"></div>').join('')}
        </div>
      </section>
      <div class="section-body">
        <h2>Table of Contents</h2>
        <div class="toc-card-list">
          ${pages.map(p => {
            const children = subsectionsOf(p.id);
            return `
              <a href="${urlBase}/${p.slug}" class="toc-card-btn" data-href="${urlBase}/${p.slug}">
                <div class="toc-card-title">${p.number ? `<span class="card-num">${p.number} — </span>` : ''}${p.title}</div>
                ${children.length ? `<div class="toc-card-subs">${children.map(c => `<span class="toc-sub-item">${c.title}</span>`).join('')}</div>` : ''}
              </a>`;
          }).join('')}
        </div>
      </div>
    </div>`;

    contentEl.querySelectorAll('.toc-card-btn').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            navigate(a.dataset.href);
        });
    });

    let viewCounts = {};
    try {
        const res = await apiFetch(`/api/policy/section-views?doc=${currentDoc}`);
        if (res.ok) viewCounts = res.views || {};
    } catch {}

    const pagesWithViews = pages.map(p => {
        const subs = subsectionsOf(p.id);
        const allIds = [p.id, ...subs.map(s => s.id)];
        const total = allIds.reduce((sum, id) => sum + (viewCounts[id] || 0), 0);
        return { ...p, totalViews: total };
    });

    const hasAnyViews = pagesWithViews.some(p => p.totalViews > 0);
    if (hasAnyViews) {
        pagesWithViews.sort((a, b) => {
            if (b.totalViews !== a.totalViews) return b.totalViews - a.totalViews;
            return a.order_index - b.order_index;
        });
    }

    const cardGrid = contentEl.querySelector('#doc-index-cards');
    if (cardGrid) {
        cardGrid.innerHTML = pagesWithViews.map(p => `
            <div class="glass-card article-card" data-href="${urlBase}/${p.slug}" tabindex="0" role="button">
              ${p.number ? `<div class="card-num">${p.number}</div>` : ''}
              <div class="card-title">${p.title}</div>
              ${p.totalViews > 0 ? `<div class="card-views">${Number(p.totalViews).toLocaleString()} view${p.totalViews === 1 ? '' : 's'}</div>` : ''}
            </div>`).join('');
        cardGrid.querySelectorAll('.article-card').forEach(card => {
            const fn = () => navigate(card.dataset.href);
            card.addEventListener('click', fn);
            card.addEventListener('keydown', e => e.key === 'Enter' && fn());
        });
    }
}

/* ─── Page Loading ─── */
async function loadPage(slug, anchor) {
    const doc = DOCS[currentDoc];

    if (currentDoc === 'charter') {
        const indexView = document.getElementById('charter-index-view');
        const articleView = document.getElementById('charter-article-view');
        if (indexView) indexView.style.display = 'none';
        if (articleView) articleView.style.display = '';
    }

    const contentEl = document.getElementById(doc.contentEl);
    if (!contentEl) return;
    contentEl.innerHTML = '<div class="section-loading"><span class="spinner large"></span><p>Loading...</p></div>';
    updateBreadcrumb(null);
    updateDocNavFooter(null);

    let section = sections.find(s => s.slug === slug && s.type !== 'subsection');

    if (!section) {
        try {
            const res = await apiFetch(`${doc.apiSection}?slug=${encodeURIComponent(slug)}`);
            if (!res.ok) throw new Error(res.error || 'Not found');
            section = res.section;
            if (section.type === 'article' || section.type === 'page') {
                const allRes = await apiFetch(doc.apiSections);
                if (allRes.ok) {
                    docSectionsCache[currentDoc] = allRes.sections;
                    sections = docSectionsCache[currentDoc];
                }
            }
        } catch (e) {
            contentEl.innerHTML = `<div class="section-content-inner">
        <h1 class="section-heading">Not Found</h1>
        <p>The section <code>${slug}</code> could not be loaded.</p>
        <a href="${doc.urlBase}" style="color:var(--brand-dark)">Back to ${doc.label}</a>
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
    trackPageViews(section);

    if (anchor) {
        setTimeout(() => {
            const el = document.getElementById(anchor);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
    } else {
        window.scrollTo(0, 0);
    }
}

/* Renders an article page: intro block + all subsections inline with anchor ids */
function renderArticlePage(article, activeAnchor) {
    const doc = DOCS[currentDoc];
    const contentEl = document.getElementById(doc.contentEl);
    if (!contentEl) return;
    const subs = subsectionsOf(article.id);
    const canEditSlug = currentDoc === 'charter' && currentUser && (currentUser.is_admin || currentUser.is_editor);
    const canEditContent = currentUser && currentUser.is_admin;
    const urlBase = doc.urlBase;

    let html = `<div class="section-content-inner">
    <div class="section-header">
      ${currentUser && (currentUser.is_admin || currentUser.is_editor) ? '<div class="section-type-badge">Article</div>' : ''}
      <div class="section-meta">
        ${currentUser ? `<span class="section-slug-display">${urlBase}/${article.slug}</span>` : ''}
        ${canEditSlug ? `<button class="edit-slug-btn" data-id="${article.id}" data-slug="${article.slug}">Edit slug</button>` : ''}
        ${canEditContent ? `<button class="edit-content-btn" data-id="${article.id}">Edit</button>` : ''}
      </div>
      <h1 class="section-heading">${article.number ? `${article.number} — ` : ''}${article.title}</h1>
    </div>`;

    if (article.content) {
        html += `<div class="section-body article-intro">${renderMarkdown(article.content)}</div>`;
    }

    subs.forEach(sub => {
        html += `
      <div class="subsection-block" id="${sub.anchor || sub.slug}">
        <div class="subsection-header">
          <h2 class="subsection-heading">
            <a class="anchor-link" href="${urlBase}/${article.slug}#${sub.anchor || sub.slug}" aria-label="Link to section">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </a>
            ${sub.title}
          </h2>
          ${sub.number ? `<span class="subsection-num">${sub.number}</span>` : ''}
          ${canEditContent ? `<button class="edit-content-btn" data-id="${sub.id}">Edit</button>` : ''}
        </div>
        <div class="section-body subsection-body">${renderMarkdown(sub.content || '')}</div>
      </div>`;
    });

    if (canEditContent) {
        html += `<button class="btn btn-sm btn-ghost add-subsection-btn" data-parent-id="${article.id}">+ Add Subsection</button>`;
    }

    html += `</div>`;
    contentEl.innerHTML = html;
    initBlobMedia(contentEl);

    if (canEditSlug) {
        contentEl.querySelectorAll('.edit-slug-btn').forEach(btn => {
            const sec = sections.find(s => s.id === btn.dataset.id) || article;
            btn.addEventListener('click', () => openSlugModal(sec));
        });
    }

    if (canEditContent) {
        contentEl.querySelectorAll('.edit-content-btn').forEach(btn => {
            const sec = sections.find(s => s.id === btn.dataset.id) || article;
            btn.addEventListener('click', () => openContentModal(sec));
        });
        contentEl.querySelector('.add-subsection-btn')?.addEventListener('click', () => openAddSectionModal(article));
    }

    contentEl.querySelectorAll('.anchor-link').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            history.replaceState({}, '', a.getAttribute('href'));
        });
    });
}

/* Renders a standalone page (Citation, Definitions, First Schedule, etc.) */
function renderStandalonePage(section) {
    const doc = DOCS[currentDoc];
    const contentEl = document.getElementById(doc.contentEl);
    if (!contentEl) return;
    const canEditSlug = currentDoc === 'charter' && currentUser && (currentUser.is_admin || currentUser.is_editor);
    const canEditContent = currentUser && currentUser.is_admin;
    const typeLabel = { page: 'Section', schedule: 'Schedule' }[section.type] || 'Section';
    const urlBase = doc.urlBase;

    contentEl.innerHTML = `
    <div class="section-content-inner">
      <div class="section-header">
        ${currentUser && (currentUser.is_admin || currentUser.is_editor) ? `<div class="section-type-badge">${typeLabel}</div>` : ''}
        <div class="section-meta">
          ${currentUser ? `<span class="section-slug-display">${urlBase}/${section.slug}</span>` : ''}
          ${canEditSlug ? `<button class="edit-slug-btn" data-id="${section.id}" data-slug="${section.slug}">Edit slug</button>` : ''}
          ${canEditContent ? `<button class="edit-content-btn" data-id="${section.id}">Edit</button>` : ''}
        </div>
        <h1 class="section-heading">${section.number ? `${section.number} — ` : ''}${section.title}</h1>
      </div>
      <div class="section-body" id="section-body-content">${renderMarkdown(section.content || '')}</div>
    </div>`;
    initBlobMedia(contentEl);

    if (canEditSlug) {
        contentEl.querySelector('.edit-slug-btn')?.addEventListener('click', () => openSlugModal(section));
    }
    if (canEditContent) {
        contentEl.querySelector('.edit-content-btn')?.addEventListener('click', () => openContentModal(section));
    }
}

/* ─── Markdown Renderer ─── */
function renderMarkdown(md) {
    // Stash is declared first so collapsible blocks (which need recursive
    // renderMarkdown calls on raw content) can be extracted before HTML escaping.
    const stash = [];
    const S = h => { const t = `\x02${stash.length}\x02`; stash.push(h); return t; };

    // Collapsible sections: +++ Title\ncontent\n+++
    md = md.replace(/^\+\+\+ (.+)\n([\s\S]*?)^\+\+\+[ \t]*$/gm, (_, title, content) => {
        const safeTitle = title.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return S(`<details class="md-collapse">
          <summary class="md-collapse-summary"><span class="md-collapse-title">${safeTitle}</span></summary>
          <div class="md-collapse-body">${renderMarkdown(content.trim())}</div>
        </details>`);
    });

    let html = md
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Tables
    const allowedCellTags = new Set(['p','ul','ol','li','mark','strong','em','b','i','u','br','a','code','span','div','h1','h2','h3','h4','h5','h6']);
    const unescapeCell = text => text.replace(/&lt;(\/?\w+.*?)&gt;/g, (match, inner) => {
        const tag = (inner.match(/^\/?([\w]+)/)?.[1] || '').toLowerCase();
        return allowedCellTags.has(tag) ? `<${inner}>` : match;
    });
    html = html.replace(/^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)+)/gm, (_, header, body) => {
        const ths = header.split('|').filter(c => c.trim()).map(c => `<th>${unescapeCell(c.trim())}</th>`).join('');
        const trs = body.trim().split('\n').map(row => {
            const tds = row.split('|').filter(c => c.trim()).map(c => `<td>${unescapeCell(c.trim())}</td>`).join('');
            return `<tr>${tds}</tr>`;
        }).join('');
        return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>\n`;
    });
    // Headings
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    // HR
    html = html.replace(/^---$/gm, '<hr/>');
    // Blockquote
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

    // Embeds: {{embed: url}}
    html = html.replace(/\{\{embed:\s*(https?:\/\/[^}]+)\}\}/g, (_, rawUrl) => {
        const url = rawUrl.trim();
        if (/\.(mp3|aac|m4a|ogg|wav)(\?.*)?$/i.test(url))
            return S(`<audio class="section-audio" controls data-blob-src="${url}"></audio>`);
        if (/\.pdf(\?.*)?$/i.test(url))
            return S(`<iframe class="section-embed section-embed-pdf" src="${url}" loading="lazy"></iframe>`);
        if (url.includes('docs.google.com/document/'))
            return S(`<iframe class="section-embed section-embed-gdoc" src="${url.replace(/\/(edit|view)[^/]*$/, '/preview')}" loading="lazy" allowfullscreen></iframe>`);
        if (url.includes('docs.google.com/spreadsheets/'))
            return S(`<iframe class="section-embed section-embed-gsheet" src="${url.replace(/\/(edit|view)[^/]*$/, '/preview')}" loading="lazy" allowfullscreen></iframe>`);
        if (url.includes('docs.google.com/presentation/'))
            return S(`<iframe class="section-embed section-embed-gslide" src="${url.replace(/\/(edit|view|pub)[^/]*$/, '/embed')}" loading="lazy" allowfullscreen></iframe>`);
        return S(`<iframe class="section-embed" src="${url}" loading="lazy" allowfullscreen></iframe>`);
    });
    // Media: ![alt]{type}(url) — type is img|doc|audio|embed (optional, defaults to img)
    html = html.replace(/!\[([^\]]*)\](?:\{(img|doc|audio|embed)\})?\((https?:\/\/[^)]+)\)/g, (_, alt, type, src) => {
        type = type || 'img';
        if (type === 'img') {
            return S(alt
                ? `<figure class="section-img-figure"><img class="section-img" src="${src}" alt="${alt}"><figcaption class="section-img-caption">${alt}</figcaption></figure>`
                : `<img class="section-img" src="${src}" alt="">`);
        }
        if (type === 'audio')
            return S(`<audio class="section-audio" controls data-blob-src="${src}"></audio>`);
        if (type === 'doc') {
            const filename = alt || src.split('/').pop();
            const ext = filename.split('.').pop().toUpperCase();
            return S(`<div class="doc-card">
              <div class="doc-card-icon">
                <svg width="28" height="34" viewBox="0 0 28 34" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 0h14l11 10v21a3 3 0 01-3 3H3a3 3 0 01-3-3V3a3 3 0 013-3z" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
                  <path d="M17 0l11 10H20a3 3 0 01-3-3V0z" fill="var(--border-hover, var(--border))"/>
                  <line x1="6" y1="16" x2="22" y2="16" stroke="var(--border)" stroke-width="1.5" stroke-linecap="round"/>
                  <line x1="6" y1="21" x2="22" y2="21" stroke="var(--border)" stroke-width="1.5" stroke-linecap="round"/>
                  <line x1="6" y1="26" x2="15" y2="26" stroke="var(--border)" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <span class="doc-card-ext">${ext}</span>
              </div>
              <div class="doc-card-info">
                <span class="doc-card-name">${filename}</span>
                <span class="doc-card-type">${ext}</span>
              </div>
              <div class="doc-card-actions">
                <button class="btn btn-sm btn-ghost doc-card-btn" onclick="downloadAsBlob('${src}','${filename}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</button>
                <button class="btn btn-sm btn-ghost doc-card-btn" onclick="openAsBlob('${src}','${filename}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Open</button>
              </div>
            </div>`);
        }
        if (type === 'embed') {
            if (src.includes('docs.google.com/document/'))
                return S(`<iframe class="section-embed section-embed-gdoc" src="${src.replace(/\/(edit|view)[^/]*$/, '/preview')}" loading="lazy" allowfullscreen></iframe>`);
            if (src.includes('docs.google.com/spreadsheets/'))
                return S(`<iframe class="section-embed section-embed-gsheet" src="${src.replace(/\/(edit|view)[^/]*$/, '/preview')}" loading="lazy" allowfullscreen></iframe>`);
            if (src.includes('docs.google.com/presentation/'))
                return S(`<iframe class="section-embed section-embed-gslide" src="${src.replace(/\/(edit|view|pub)[^/]*$/, '/embed')}" loading="lazy" allowfullscreen></iframe>`);
            return S(`<iframe class="section-embed" src="${src}" loading="lazy" allowfullscreen></iframe>`);
        }
    });

    // Bold / italic / underline — runs after stashing, so media HTML is never touched
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/__(.+?)__/g, '<u>$1</u>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    // Links
    html = html.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)]+)\)/g, (_, text, href) => {
        const external = href.startsWith('http');
        return `<a href="${href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`;
    });
    // Inline code
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    // Unordered lists — supports nesting via leading spaces (2 spaces = 1 level)
    html = html.replace(/((?:^[ ]*- .+\n?)+)/gm, match => {
        const lines = match.trimEnd().split('\n').filter(l => /^\s*- /.test(l));
        let out = '';
        const stack = []; // stack of indent depths, one entry per open <ul>
        for (const line of lines) {
            const m = line.match(/^(\s*)- (.*)$/);
            if (!m) continue;
            const indent = m[1].length;
            const text  = m[2];
            if (stack.length === 0) {
                out += '<ul>';
                stack.push(indent);
                out += `<li>${text}`;
            } else if (indent > stack[stack.length - 1]) {
                out += `<ul><li>${text}`;
                stack.push(indent);
            } else if (indent === stack[stack.length - 1]) {
                out += `</li><li>${text}`;
            } else {
                out += '</li>';
                while (stack.length > 0 && stack[stack.length - 1] > indent) {
                    out += '</ul>';
                    stack.pop();
                    if (stack.length > 0) out += '</li>';
                }
                out += `<li>${text}`;
            }
        }
        out += '</li>';
        while (stack.length > 0) { out += '</ul>'; stack.pop(); }
        return out;
    });
    // Ordered / decimal-outline lists (1., 2.1., 2.1.1., etc.) with optional (a)/(b) sub-items
    html = html.replace(/((?:^(?:(?:\d+\.)+[ \t].+|\([a-zA-Z]\)[ \t].+)\n?)+)/gm, match => {
        let currentDepth = 0;
        const items = match.trim().split('\n').map(line => {
            const dm = line.match(/^((?:\d+\.)+)[ \t](.+)$/);
            if (dm) {
                const numPart = dm[1];
                currentDepth = (numPart.match(/\./g) || []).length - 1;
                return `<li class="ol-depth-${currentDepth}"><strong>${numPart}</strong> ${dm[2]}</li>`;
            }
            const am = line.match(/^(\([a-zA-Z]\))[ \t](.+)$/);
            if (am) {
                return `<li class="ol-depth-${currentDepth + 1}">${am[1]} ${am[2]}</li>`;
            }
            return '';
        }).filter(Boolean).join('');
        return `<ol class="decimal-list">${items}</ol>`;
    });
    // Paragraphs — stash tokens that stand alone are treated as block-level
    html = html.split(/\n\n+/).map(para => {
        const t = para.trim();
        if (!t) return '';
        if (/^<(h[1-6]|ul|ol|table|blockquote|hr)/.test(t)) return t;
        if (/^\x02\d+\x02$/.test(t)) return t;
        return `<p>${t.replace(/\n/g, '<br/>')}</p>`;
    }).join('\n');

    // Restore stashed blocks
    stash.forEach((block, i) => { html = html.replace(`\x02${i}\x02`, () => block); });

    return html;
}

/* ─── Breadcrumb ─── */
function updateBreadcrumb(section) {
    const doc = DOCS[currentDoc];
    const bc = document.getElementById(doc.breadcrumbEl);
    if (!bc) return;
    const sep = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    if (!section) {
        bc.innerHTML = `<a href="/" class="bc-link">Home</a>${sep}<a href="${doc.urlBase}" class="bc-link">${doc.sidebarTitle}</a>`;
    } else {
        bc.innerHTML = `<a href="/" class="bc-link">Home</a>${sep}<a href="${doc.urlBase}" class="bc-link">${doc.sidebarTitle}</a>${sep}<span>${section.title}</span>`;
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
    const doc = DOCS[currentDoc];
    const footer = document.getElementById(doc.navFooterEl);
    if (!footer) return;
    if (!section) {
        footer.innerHTML = '';
        return;
    }

    // Most recent updated_at across the section and all its subsections
    const candidates = [section, ...sections.filter(s => s.parent_id === section.id)]
        .map(s => s.updated_at).filter(Boolean);
    const latestDate = candidates.length
        ? new Date(candidates.reduce((a, b) => (a > b ? a : b)))
        : null;
    const lastUpdated = latestDate
        ? latestDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : null;

    const urlBase = doc.urlBase;
    const pages = topLevelPages();
    const idx = pages.findIndex(s => s.id === section.id);
    const prev = idx > 0 ? pages[idx - 1] : null;
    const next = idx < pages.length - 1 ? pages[idx + 1] : null;
    footer.innerHTML = `
    <div class="doc-page-meta">
      ${lastUpdated ? `<span class="doc-last-updated">Last updated: ${lastUpdated}</span>` : ''}
      <span class="doc-views" id="doc-views-count">
        <svg class="doc-views-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <span class="doc-views-spinner"></span>
      </span>
    </div>
    <div class="doc-nav-buttons">
      ${prev ? `<button class="doc-nav-btn" data-slug="${prev.slug}">
        <span class="doc-nav-label">← Previous</span>
        <span class="doc-nav-title">${prev.number ? prev.number + ' — ' : ''}${prev.title}</span>
      </button>` : '<span></span>'}
      ${next ? `<button class="doc-nav-btn next" data-slug="${next.slug}">
        <span class="doc-nav-label">Next →</span>
        <span class="doc-nav-title">${next.number ? next.number + ' — ' : ''}${next.title}</span>
      </button>` : ''}
    </div>`;
    footer.querySelectorAll('.doc-nav-btn').forEach(btn =>
        btn.addEventListener('click', () => navigate(`${urlBase}/${btn.dataset.slug}`)));
}

/* ─── Page Visit Tracking ─── */
function detectDeviceType() {
    const ua = navigator.userAgent;
    if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'Tablet';
    if (/Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'Mobile';
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'Mobile';
    return 'Desktop';
}

async function trackPageViews(section) {
    const countEl = document.getElementById('doc-views-count');
    const subs    = sections.filter(s => s.parent_id === section.id);
    const allIds  = [section.id, ...subs.map(s => s.id)];

    try {
        const res = await apiFetch('/api/policy/track-visit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                section_id:  section.id,
                doc:         currentDoc,
                slug:        section.slug,
                device_type: detectDeviceType(),
                all_ids:     allIds,
            }),
        });
        if (countEl) {
            const spinner = countEl.querySelector('.doc-views-spinner');
            if (spinner) spinner.remove();
            const label = countEl.querySelector('.doc-views-label') || document.createElement('span');
            label.className = 'doc-views-label';
            label.textContent = res.ok && res.total != null
                ? `${Number(res.total).toLocaleString()} view${res.total === 1 ? '' : 's'}`
                : '';
            if (!countEl.contains(label)) countEl.appendChild(label);
        }
    } catch {
        if (countEl) {
            const spinner = countEl.querySelector('.doc-views-spinner');
            if (spinner) spinner.remove();
        }
    }
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

function toggleSidebar() {
    if (window.innerWidth >= 900) {
        const sidebar = document.getElementById('sidebar');
        const main = document.getElementById('main-content');
        sidebar.classList.toggle('collapsed');
        main.classList.toggle('sidebar-hidden');
    } else {
        const isOpen = document.getElementById('sidebar').classList.contains('open');
        isOpen ? closeSidebar() : openSidebar();
    }
}

/* ─── Session / Auth ─── */
async function restoreSession() {
    const token = localStorage.getItem('gftv-token');
    if (token) {
        try {
            const res = await apiFetch('/api/auth/me', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (res.ok) {
                currentUser = res.user;
            } else {
                localStorage.removeItem('gftv-token');
            }
        } catch (e) {
            localStorage.removeItem('gftv-token');
        }
    }
    updateUserUI();
}

function updateUserUI() {
    const area = document.getElementById('user-area');
    const sidebarArea = document.getElementById('sidebar-user-area');

    if (currentUser) {
        if (area) {
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
            }, { once: true });
        }

        if (sidebarArea) {
            sidebarArea.innerHTML = `
      <div class="user-chip" id="sidebar-user-chip" tabindex="0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="2"/></svg>
        ${currentUser.display_name}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2"/></svg>
        <div class="user-dropdown" id="sidebar-user-dropdown" style="display:none">
          ${currentUser.is_admin ? `<button class="user-dropdown-item" id="sidebar-goto-admin">Admin Panel</button>` : ''}
          <button class="user-dropdown-item danger" id="sidebar-logout-btn">Sign Out</button>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" id="sidebar-search-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        Search
      </button>`;
            const sidebarChip = document.getElementById('sidebar-user-chip');
            sidebarChip.addEventListener('click', e => {
                e.stopPropagation();
                const dd = document.getElementById('sidebar-user-dropdown');
                dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
            });
            document.getElementById('sidebar-logout-btn')?.addEventListener('click', logout);
            document.getElementById('sidebar-goto-admin')?.addEventListener('click', () => navigate('/admin'));
            document.getElementById('sidebar-search-btn')?.addEventListener('click', () => { closeSidebar(); openSearch(); });
            document.addEventListener('click', () => {
                const dd = document.getElementById('sidebar-user-dropdown');
                if (dd) dd.style.display = 'none';
            }, { once: true });
        }
    } else {
        if (area) {
            area.innerHTML = `<button class="btn btn-ghost btn-sm" id="login-btn">Sign In</button>`;
            document.getElementById('login-btn')?.addEventListener('click', () => openModal('auth-modal'));
        }
        if (sidebarArea) {
            sidebarArea.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="sidebar-login-btn">Sign In</button>
      <button class="btn btn-ghost btn-sm" id="sidebar-search-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        Search
      </button>`;
            document.getElementById('sidebar-login-btn')?.addEventListener('click', () => openModal('auth-modal'));
            document.getElementById('sidebar-search-btn')?.addEventListener('click', () => { closeSidebar(); openSearch(); });
        }
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
let _totpChallengeToken = null;

function showTotpStep() {
    document.getElementById('auth-form-login').classList.add('hidden');
    document.getElementById('auth-form-totp').classList.remove('hidden');
    document.getElementById('auth-modal-title').textContent = 'Two-Factor Auth';
    document.getElementById('totp-code').value = '';
    document.getElementById('totp-trust-device').checked = false;
    clearAuthError();
    document.getElementById('totp-code').focus();
}

function showLoginStep() {
    document.getElementById('auth-form-totp').classList.add('hidden');
    document.getElementById('auth-form-login').classList.remove('hidden');
    document.getElementById('auth-modal-title').textContent = 'Sign In';
    _totpChallengeToken = null;
    clearAuthError();
}

function completeLogin(res) {
    localStorage.setItem('gftv-token', res.token);
    if (res.device_token) localStorage.setItem('gftv-device-token', res.device_token);
    currentUser = res.user;
    updateUserUI();
    closeModal('auth-modal');
    showToast('Welcome back, ' + res.user.display_name, 'success');
}

document.getElementById('login-form')?.addEventListener('submit', async () => {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    clearAuthError();
    if (!username || !password) return showAuthError('Please fill in all fields.');
    const device_token = localStorage.getItem('gftv-device-token') || undefined;
    const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, device_token }),
        headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) return showAuthError(res.error || 'Login failed');
    if (res.totp_required) {
        _totpChallengeToken = res.challenge_token;
        showTotpStep();
    } else {
        completeLogin(res);
    }
});

document.getElementById('totp-submit')?.addEventListener('click', async () => {
    const code = document.getElementById('totp-code').value.trim();
    const trust_device = document.getElementById('totp-trust-device').checked;
    clearAuthError();
    if (!code) return showAuthError('Please enter your authentication code.');
    if (!_totpChallengeToken) return showAuthError('Session expired, please log in again.');
    const res = await apiFetch('/api/auth/totp-verify', {
        method: 'POST',
        body: JSON.stringify({ challenge_token: _totpChallengeToken, code, trust_device }),
        headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
        completeLogin(res);
    } else {
        showAuthError(res.error || 'Invalid code');
    }
});

document.getElementById('totp-use-backup')?.addEventListener('click', () => {
    const label = document.getElementById('totp-code-label');
    const input = document.getElementById('totp-code');
    const btn = document.getElementById('totp-use-backup');
    const isBackup = input.getAttribute('data-mode') === 'backup';
    if (isBackup) {
        label.textContent = 'Authentication Code';
        input.placeholder = '000000';
        input.inputMode = 'numeric';
        input.maxLength = 20;
        input.removeAttribute('data-mode');
        btn.textContent = 'Use a backup code instead';
    } else {
        label.textContent = 'Backup Code';
        input.placeholder = 'xxxx-xxxx-xxxx';
        input.inputMode = 'text';
        input.maxLength = 50;
        input.setAttribute('data-mode', 'backup');
        btn.textContent = 'Use authenticator app instead';
    }
    input.value = '';
    clearAuthError();
});

document.getElementById('totp-back')?.addEventListener('click', showLoginStep);
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
    document.addEventListener('click', e => {
        const btn = e.target.closest('.copy-dropdown-btn');
        if (btn) {
            e.stopPropagation();
            const dd = btn.closest('.doc-actions').querySelector('.copy-dropdown');
            const isOpen = !dd.hidden;
            document.querySelectorAll('.copy-dropdown').forEach(d => { d.hidden = true; d.style.right = ''; d.style.left = ''; });
            if (!isOpen) {
                dd.hidden = false;
                const rect = dd.getBoundingClientRect();
                if (rect.left < 8) {
                    dd.style.right = 'auto';
                    dd.style.left = '0';
                }
            }
            return;
        }
        if (!e.target.closest('.copy-dropdown')) {
            document.querySelectorAll('.copy-dropdown').forEach(d => { d.hidden = true; d.style.right = ''; d.style.left = ''; });
        }
    });

    document.addEventListener('click', e => {
        const item = e.target.closest('[data-action]');
        if (!item) return;
        const action = item.dataset.action;
        const dd = item.closest('.copy-dropdown');
        if (dd) dd.hidden = true;

        setTimeout(() => {
        if (action === 'copy-md' || action === 'view-md') {
            if (!currentSection) return showToast('No page loaded', 'error');
            const urlBase = DOCS[currentDoc].urlBase;
            const subs = currentSection.type === 'article' ? subsectionsOf(currentSection.id) : [];
            let md = `# ${currentSection.title}\n\nSource: https://policy.globalfurry.tv${urlBase}/${currentSection.slug}\n\n${currentSection.content || ''}`;
            subs.forEach(s => { md += `\n\n## ${s.title}\n\n${s.content || ''}`; });
            if (action === 'copy-md') {
                navigator.clipboard.writeText(md).then(() => showToast('Copied as Markdown', 'success'));
            } else {
                window.open(URL.createObjectURL(new Blob([md], { type: 'text/plain' })), '_blank');
            }
        } else if (action === 'export-pdf') {
            if (!currentSection) return showToast('No page loaded', 'error');
            const docCfg = DOCS[currentDoc];
            const contentEl = document.getElementById(docCfg.contentEl);
            if (!contentEl) return;
            const title = currentSection.title || 'export';
            const pageUrl = `https://policy.globalfurry.tv${docCfg.urlBase}/${currentSection.slug}`;
            const exportDateTime = new Date().toLocaleString('en-GB', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
            });
            const opt = {
                margin: [22, 14, 24, 14],
                filename: `${title}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: {
                    mode: ['css', 'legacy'],
                    avoid: ['tr', 'td', 'h1', 'h2', 'h3', 'h4', 'h5', 'img', 'figure', 'blockquote', 'li']
                }
            };
            showToast('Generating PDF…', 'info');
            // Inject temporary CSS so html2canvas captures correct break hints
            const pdfPrepStyle = document.createElement('style');
            pdfPrepStyle.id = 'pdf-prep-style';
            pdfPrepStyle.textContent = `
                #${docCfg.contentEl} h1, #${docCfg.contentEl} h2,
                #${docCfg.contentEl} h3, #${docCfg.contentEl} h4 { page-break-after: avoid; }
                #${docCfg.contentEl} tr, #${docCfg.contentEl} img,
                #${docCfg.contentEl} li, #${docCfg.contentEl} blockquote { page-break-inside: avoid; }
            `;
            document.head.appendChild(pdfPrepStyle);
            const loadHtml2pdf = () => new Promise((resolve, reject) => {
                if (window.html2pdf) return resolve(window.html2pdf);
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                s.onload = () => resolve(window.html2pdf);
                s.onerror = reject;
                document.head.appendChild(s);
            });
            const getIp = () => fetch('https://api.ipify.org?format=json')
                .then(r => r.json()).then(d => d.ip).catch(() => 'Unknown');
            const loadLogo = () => new Promise(resolve => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    canvas.getContext('2d').drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = () => resolve(null);
                img.src = '/GHS-main.png';
            });
            const savedTheme = document.body.dataset.theme;
            applyTheme('light');
            // Expand all collapsibles for PDF capture, remember which were already open
            const collapseEls = Array.from(contentEl.querySelectorAll('details.md-collapse'));
            const collapseWasOpen = collapseEls.map(d => d.open);
            collapseEls.forEach(d => { d.open = true; });
            Promise.all([loadHtml2pdf(), getIp(), loadLogo()])
                .then(([h2p, ip, logoDataUrl]) =>
                    h2p().set(opt).from(contentEl).toPdf().get('pdf').then(pdf => {
                        const totalPages = pdf.internal.getNumberOfPages();
                        const pageW = pdf.internal.pageSize.getWidth();
                        const pageH = pdf.internal.pageSize.getHeight();
                        for (let i = 1; i <= totalPages; i++) {
                            pdf.setPage(i);
                            // Header
                            if (logoDataUrl) pdf.addImage(logoDataUrl, 'PNG', 14, 5, 9, 9);
                            const textX = logoDataUrl ? 25 : 14;
                            pdf.setFontSize(12);
                            pdf.setFont('helvetica', 'bold');
                            pdf.setTextColor(30, 30, 50);
                            pdf.text('PolicySpot', textX, 10.5);
                            const badgeX = textX + pdf.getTextWidth('PolicySpot') + 2;
                            pdf.setFillColor(74, 106, 138);
                            pdf.setFontSize(6.5);
                            pdf.roundedRect(badgeX, 6.2, pdf.getTextWidth('GFTV') + 3, 5, 1, 1, 'F');
                            pdf.setTextColor(255, 255, 255);
                            pdf.text('GFTV', badgeX + 1.5, 10.2);
                            pdf.setDrawColor(180, 190, 200);
                            pdf.setLineWidth(0.3);
                            pdf.line(14, 17, pageW - 14, 17);
                            // Footer
                            pdf.line(14, pageH - 18, pageW - 14, pageH - 18);
                            pdf.setFontSize(7.5);
                            pdf.setFont('helvetica', 'normal');
                            pdf.setTextColor(100, 110, 120);
                            pdf.text(pageUrl, 14, pageH - 13.5);
                            pdf.text(`Exported: ${exportDateTime}`, 14, pageH - 9);
                            pdf.text(`Exporting IP: ${ip}`, 14, pageH - 4.5);
                            const pageLabel = `${i} / ${totalPages}`;
                            pdf.text(pageLabel, pageW - 14 - pdf.getTextWidth(pageLabel), pageH - 4.5);
                        }
                        return pdf.output('bloburl');
                    })
                )
                .then(url => {
                    document.getElementById('pdf-prep-style')?.remove();
                    collapseEls.forEach((d, i) => { d.open = collapseWasOpen[i]; });
                    applyTheme(savedTheme);
                    window.open(url, '_blank');
                    showToast('PDF opened in new tab', 'success');
                })
                .catch(() => {
                    document.getElementById('pdf-prep-style')?.remove();
                    collapseEls.forEach((d, i) => { d.open = collapseWasOpen[i]; });
                    applyTheme(savedTheme);
                    showToast('Failed to generate PDF', 'error');
                });
        } else if (action === 'chatgpt' || action === 'claude') {
            const urlBase = DOCS[currentDoc].urlBase;
            const pageUrl = currentSection ?
                encodeURIComponent(`https://policy.globalfurry.tv${urlBase}/${currentSection.slug}`) :
                'https%3A%2F%2Fpolicy.globalfurry.tv';
            if (action === 'chatgpt') {
                window.open(`https://chat.openai.com/?q=Read%20${pageUrl}%20and%20answer%20questions%20about%20the%20content.`, '_blank');
            } else {
                window.open(`https://claude.ai/new?q=Read%20${pageUrl}%20and%20answer%20questions%20about%20the%20content.`, '_blank');
            }
        }
        }, 0);
    });
}

/* ─── Slug Modal ─── */
function openSlugModal(section) {
    document.getElementById('slug-input').value = section.slug;
    document.getElementById('slug-section-id').value = section.id;
    document.getElementById('slug-preview').textContent = `policy.globalfurry.tv${DOCS[currentDoc].urlBase}/${section.slug}`;
    document.getElementById('slug-error').classList.add('hidden');
    openModal('slug-modal');
}
document.getElementById('slug-input')?.addEventListener('input', e => {
    const preview = document.getElementById('slug-preview');
    if (preview) preview.textContent = `policy.globalfurry.tv${DOCS[currentDoc].urlBase}/${e.target.value}`;
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
        navigate(`${DOCS[currentDoc].urlBase}/${slug}`);
        buildSidebar();
    } else {
        errEl.textContent = res.error || 'Update failed';
        errEl.classList.remove('hidden');
    }
});

/* ─── Content Edit Modal ─── */
function openContentModal(section) {
    document.getElementById('content-edit-id').value = section.id;
    document.getElementById('content-edit-table').value = currentDoc;
    document.getElementById('content-edit-title').value = section.title || '';
    document.getElementById('content-edit-slug').value = section.slug || '';
    document.getElementById('content-edit-number').value = section.number || '';
    document.getElementById('content-edit-anchor').value = section.anchor || '';
    document.getElementById('content-edit-content').value = section.content || '';
    document.getElementById('content-edit-mode').value = 'edit';
    document.getElementById('content-edit-parent-id').value = section.parent_id || '';

    const anchorGroup = document.getElementById('content-edit-anchor-group');
    if (anchorGroup) anchorGroup.style.display = section.type === 'subsection' ? '' : 'none';
    document.getElementById('content-edit-type-group').style.display = 'none';

    document.getElementById('content-modal-title').textContent = 'Edit Section';

    const siblings = section.type === 'subsection'
        ? subsectionsOf(section.parent_id)
        : topLevelPages();
    const idx = siblings.findIndex(s => s.id === section.id);
    document.getElementById('content-edit-move-up').style.display = idx > 0 ? '' : 'none';
    document.getElementById('content-edit-move-down').style.display = (idx >= 0 && idx < siblings.length - 1) ? '' : 'none';
    document.getElementById('content-edit-delete').style.display = '';

    document.getElementById('content-edit-error').classList.add('hidden');
    openModal('content-modal');
    editorInitHistory(document.getElementById('content-edit-content'));
}

function openAddSectionModal(parentSection) {
    document.getElementById('content-edit-id').value = '';
    document.getElementById('content-edit-table').value = currentDoc;
    document.getElementById('content-edit-title').value = '';
    document.getElementById('content-edit-slug').value = '';
    document.getElementById('content-edit-number').value = '';
    document.getElementById('content-edit-anchor').value = '';
    document.getElementById('content-edit-content').value = '';
    document.getElementById('content-edit-mode').value = 'add';
    document.getElementById('content-edit-parent-id').value = parentSection ? parentSection.id : '';

    const isSubsection = !!parentSection;
    document.getElementById('content-edit-anchor-group').style.display = isSubsection ? '' : 'none';
    document.getElementById('content-edit-type-group').style.display = isSubsection ? 'none' : '';

    document.getElementById('content-modal-title').textContent = isSubsection ? 'Add Subsection' : 'Add Section';
    document.getElementById('content-edit-move-up').style.display = 'none';
    document.getElementById('content-edit-move-down').style.display = 'none';
    document.getElementById('content-edit-delete').style.display = 'none';

    document.getElementById('content-edit-error').classList.add('hidden');
    openModal('content-modal');
    editorInitHistory(document.getElementById('content-edit-content'));
}

/* ─── Markdown Editor History (undo/redo) ─── */
const editorHistory = { stack: [], pos: -1, debounceTimer: null };

function editorSaveState(ta) {
    editorHistory.stack = editorHistory.stack.slice(0, editorHistory.pos + 1);
    editorHistory.stack.push({ value: ta.value, ss: ta.selectionStart, se: ta.selectionEnd });
    if (editorHistory.stack.length > 200) editorHistory.stack.shift();
    editorHistory.pos = editorHistory.stack.length - 1;
}

function editorInitHistory(ta) {
    clearTimeout(editorHistory.debounceTimer);
    editorHistory.stack = [{ value: ta.value, ss: 0, se: 0 }];
    editorHistory.pos = 0;
}

function editorUndo(ta) {
    if (editorHistory.pos > 0) {
        editorHistory.pos--;
        const s = editorHistory.stack[editorHistory.pos];
        ta.value = s.value;
        ta.selectionStart = s.ss;
        ta.selectionEnd   = s.se;
    }
}

function editorRedo(ta) {
    if (editorHistory.pos < editorHistory.stack.length - 1) {
        editorHistory.pos++;
        const s = editorHistory.stack[editorHistory.pos];
        ta.value = s.value;
        ta.selectionStart = s.ss;
        ta.selectionEnd   = s.se;
    }
}

// Debounced history push on regular typing (groups keystrokes ~600ms apart)
document.getElementById('content-edit-content')?.addEventListener('input', e => {
    clearTimeout(editorHistory.debounceTimer);
    editorHistory.debounceTimer = setTimeout(() => editorSaveState(e.target), 600);
});

/* ─── Markdown Editor Keyboard Shortcuts ─── */
function applyMarkdownFormat(ta, open, close) {
    editorSaveState(ta);
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const val   = ta.value;
    const sel   = val.substring(start, end);

    // Toggle off if selection is already wrapped
    const charsBefore = val.substring(Math.max(0, start - open.length), start);
    const charsAfter  = val.substring(end, end + close.length);
    if (charsBefore === open && charsAfter === close) {
        ta.value = val.substring(0, start - open.length) + sel + val.substring(end + close.length);
        ta.selectionStart = start - open.length;
        ta.selectionEnd   = end - open.length;
        return;
    }
    if (sel.startsWith(open) && sel.endsWith(close) && sel.length > open.length + close.length) {
        const inner = sel.slice(open.length, sel.length - close.length);
        ta.value = val.substring(0, start) + inner + val.substring(end);
        ta.selectionStart = start;
        ta.selectionEnd   = start + inner.length;
        return;
    }

    const placeholder = sel || 'text';
    ta.value = val.substring(0, start) + open + placeholder + close + val.substring(end);
    ta.selectionStart = start + open.length;
    ta.selectionEnd   = start + open.length + placeholder.length;
}

document.getElementById('content-edit-content')?.addEventListener('keydown', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    const ta = e.target;
    switch (e.key.toLowerCase()) {
        case 'z':
            e.preventDefault();
            if (e.shiftKey) editorRedo(ta); else editorUndo(ta);
            break;
        case 'y':
            e.preventDefault();
            editorRedo(ta);
            break;
        case 'b':
            e.preventDefault();
            applyMarkdownFormat(ta, '**', '**');
            break;
        case 'i':
            e.preventDefault();
            if (e.shiftKey) {
                editorSaveState(ta);
                const _start = ta.selectionStart;
                const _sel   = ta.value.substring(_start, ta.selectionEnd);
                const _alt   = _sel || 'alt';
                const _md    = `![${_alt}]{img}(url)`;
                ta.value = ta.value.substring(0, _start) + _md + ta.value.substring(ta.selectionEnd);
                const _urlStart = _start + `![${_alt}]{img}(`.length;
                ta.selectionStart = _urlStart;
                ta.selectionEnd   = _urlStart + 3;
                ta.focus();
            } else {
                applyMarkdownFormat(ta, '*', '*');
            }
            break;
        case 'u':
            e.preventDefault();
            applyMarkdownFormat(ta, '__', '__');
            break;
        case 'k': {
            e.preventDefault();
            editorSaveState(ta);
            const start = ta.selectionStart;
            const sel   = ta.value.substring(start, ta.selectionEnd);
            if (sel) {
                ta.value = ta.value.substring(0, start) + '[' + sel + '](url)' + ta.value.substring(ta.selectionEnd);
                ta.selectionStart = start + sel.length + 3;
                ta.selectionEnd   = start + sel.length + 6;
            } else {
                ta.value = ta.value.substring(0, start) + '[link text](url)' + ta.value.substring(start);
                ta.selectionStart = start + 1;
                ta.selectionEnd   = start + 10;
            }
            break;
        }
        case '`':
            e.preventDefault();
            applyMarkdownFormat(ta, '`', '`');
            break;
        case 's':
            e.preventDefault();
            document.getElementById('content-edit-save')?.click();
            break;
    }
});

/* ─── Image Picker (Ctrl+Shift+I) ─── */
const imgPicker = {
    ta: null, cursorPos: 0,
    selectedUrl: null, compressed: null, originalFile: null,
    docFile: null, selectedDocUrl: null, selectedDocName: null,
    sndFile: null, selectedSndUrl: null, selectedSndName: null,
};

// Client-side compression via Canvas. Returns { base64, mime, width, height, size }.
function compressImage(file, maxWidth = 1920, quality = 0.82) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objUrl = URL.createObjectURL(file);
        img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('Failed to load image')); };
        img.onload = () => {
            URL.revokeObjectURL(objUrl);
            let w = img.naturalWidth, h = img.naturalHeight;
            if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            // GIF stays GIF; small PNGs stay PNG; everything else → WebP
            const outMime = file.type === 'image/gif'  ? 'image/gif'
                          : file.type === 'image/png' && file.size < 100_000 ? 'image/png'
                          : 'image/webp';
            canvas.toBlob(blob => {
                const reader = new FileReader();
                reader.onload = () => resolve({
                    base64: reader.result.split(',')[1],
                    mime: blob.type, width: w, height: h, size: blob.size,
                });
                reader.readAsDataURL(blob);
            }, outMime, quality);
        };
        img.src = objUrl;
    });
}

function openImagePicker(ta) {
    imgPicker.ta        = ta;
    imgPicker.cursorPos = ta.selectionStart;
    imgPicker.selectedUrl  = null;
    imgPicker.compressed   = null;
    imgPicker.originalFile = null;

    imgPicker.docFile = null; imgPicker.selectedDocUrl = null; imgPicker.selectedDocName = null;
    imgPicker.sndFile = null; imgPicker.selectedSndUrl = null; imgPicker.selectedSndName = null;

    // Reset upload pane
    document.getElementById('img-drop-zone').hidden    = false;
    document.getElementById('img-preview-wrap').hidden = true;
    document.getElementById('img-alt-upload').value    = '';
    document.getElementById('img-insert-btn').disabled = true;

    // Reset doc/snd/embed panes
    const _docDrop  = document.getElementById('doc-drop-zone');
    const _docReady = document.getElementById('doc-file-ready');
    const _sndDrop  = document.getElementById('snd-drop-zone');
    const _sndReady = document.getElementById('snd-file-ready');
    const _embedIn  = document.getElementById('embed-url-input');
    const _embedBdg = document.getElementById('embed-type-badge');
    if (_docDrop)  _docDrop.hidden  = false;
    if (_docReady) _docReady.hidden = true;
    if (_sndDrop)  _sndDrop.hidden  = false;
    if (_sndReady) _sndReady.hidden = true;
    if (_embedIn)  _embedIn.value   = '';
    if (_embedBdg) _embedBdg.hidden = true;

    switchImgTab('upload');
    openModal('image-picker-modal');
}

function switchImgTab(tab) {
    document.querySelectorAll('.img-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.img-tab-pane').forEach(p => p.classList.toggle('hidden', p.id !== `img-pane-${tab}`));
    if (tab === 'library')   loadImageLibrary();
    if (tab === 'documents') loadDocumentLibrary();
    if (tab === 'sounds')    loadSoundLibrary();
}

let libraryLoaded = false;
async function loadImageLibrary() {
    const grid = document.getElementById('img-library-grid');
    if (libraryLoaded) return; // already populated this session
    grid.innerHTML = '<p class="img-library-empty">Loading&hellip;</p>';

    const res = await apiFetch('/api/policy/images');
    libraryLoaded = true;
    if (!res.ok || !res.images?.length) {
        grid.innerHTML = '<p class="img-library-empty">No images uploaded yet.</p>';
        return;
    }

    grid.innerHTML = '';
    res.images.forEach(img => {
        const tile = document.createElement('div');
        tile.className   = 'img-library-tile';
        tile.dataset.url = img.public_url;
        const kb  = Math.round(img.file_size / 1024);
        const dim = img.width ? `${img.width}×${img.height}` : '';
        tile.innerHTML = `
            <img src="${img.public_url}" alt="${img.filename}" loading="lazy">
            <span class="img-tile-name" title="${img.filename}">${img.filename}</span>
            <span class="img-tile-meta">${dim}${dim && kb ? ' · ' : ''}${kb ? kb + ' KB' : ''}</span>`;
        tile.addEventListener('click', () => {
            document.querySelectorAll('.img-library-tile').forEach(t => t.classList.remove('selected'));
            tile.classList.add('selected');
            imgPicker.selectedUrl = img.public_url;
            const defaultAlt = img.filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
            document.getElementById('img-alt-library').value = defaultAlt;
            document.getElementById('img-alt-library-group').style.display = '';
            document.getElementById('img-insert-btn').disabled = false;
        });
        grid.appendChild(tile);
    });
}

let docsLoaded = false;
async function loadDocumentLibrary() {
    const list = document.getElementById('doc-library-list');
    if (docsLoaded) return;
    list.innerHTML = '<p class="media-library-empty">Loading&hellip;</p>';
    const res = await apiFetch('/api/policy/documents');
    docsLoaded = true;
    if (!res.ok || !res.documents?.length) {
        list.innerHTML = '<p class="media-library-empty">No documents uploaded yet.</p>';
        return;
    }
    list.innerHTML = '';
    res.documents.forEach(doc => {
        const row = document.createElement('div');
        row.className = 'media-file-row';
        const kb  = Math.round(doc.file_size / 1024);
        const ext = doc.filename.split('.').pop().toUpperCase();
        row.innerHTML = `
            <span class="media-file-ext">${ext}</span>
            <span class="media-file-row-name" title="${doc.filename}">${doc.filename}</span>
            <span class="media-file-row-size">${kb} KB</span>`;
        row.addEventListener('click', () => {
            document.querySelectorAll('#doc-library-list .media-file-row').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');
            imgPicker.selectedDocUrl  = doc.public_url;
            imgPicker.selectedDocName = doc.filename;
            imgPicker.docFile = null;
            document.getElementById('doc-drop-zone').hidden  = false;
            document.getElementById('doc-file-ready').hidden = true;
            document.getElementById('img-insert-btn').disabled = false;
        });
        list.appendChild(row);
    });
}

let soundsLoaded = false;
async function loadSoundLibrary() {
    const list = document.getElementById('snd-library-list');
    if (soundsLoaded) return;
    list.innerHTML = '<p class="media-library-empty">Loading&hellip;</p>';
    const res = await apiFetch('/api/policy/sounds');
    soundsLoaded = true;
    if (!res.ok || !res.sounds?.length) {
        list.innerHTML = '<p class="media-library-empty">No audio files uploaded yet.</p>';
        return;
    }
    list.innerHTML = '';
    res.sounds.forEach(snd => {
        const row = document.createElement('div');
        row.className = 'media-file-row';
        const kb  = Math.round(snd.file_size / 1024);
        const ext = snd.filename.split('.').pop().toUpperCase();
        row.innerHTML = `
            <span class="media-file-ext">${ext}</span>
            <span class="media-file-row-name" title="${snd.filename}">${snd.filename}</span>
            <span class="media-file-row-size">${kb} KB</span>`;
        row.addEventListener('click', () => {
            document.querySelectorAll('#snd-library-list .media-file-row').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');
            imgPicker.selectedSndUrl  = snd.public_url;
            imgPicker.selectedSndName = snd.filename;
            imgPicker.sndFile = null;
            document.getElementById('snd-drop-zone').hidden  = false;
            document.getElementById('snd-file-ready').hidden = true;
            document.getElementById('img-insert-btn').disabled = false;
        });
        list.appendChild(row);
    });
}

function handleDocFileSelected(file) {
    if (!file) return;
    imgPicker.docFile = file;
    imgPicker.selectedDocUrl = null;
    imgPicker.selectedDocName = null;
    document.querySelectorAll('#doc-library-list .media-file-row').forEach(r => r.classList.remove('selected'));
    document.getElementById('doc-drop-zone').hidden  = true;
    document.getElementById('doc-file-ready').hidden = false;
    document.getElementById('doc-file-name').textContent = file.name;
    document.getElementById('doc-file-size').textContent = `${Math.round(file.size / 1024)} KB`;
    document.getElementById('img-insert-btn').disabled = false;
}

function handleSndFileSelected(file) {
    if (!file) return;
    imgPicker.sndFile = file;
    imgPicker.selectedSndUrl = null;
    imgPicker.selectedSndName = null;
    document.querySelectorAll('#snd-library-list .media-file-row').forEach(r => r.classList.remove('selected'));
    document.getElementById('snd-drop-zone').hidden  = true;
    document.getElementById('snd-file-ready').hidden = false;
    document.getElementById('snd-file-name').textContent = file.name;
    document.getElementById('snd-file-size').textContent = `${Math.round(file.size / 1024)} KB`;
    document.getElementById('img-insert-btn').disabled = false;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function getEmbedType(url) {
    if (/\.(mp3|aac|m4a|ogg|wav)(\?.*)?$/i.test(url))      return 'Audio Player';
    if (/\.pdf(\?.*)?$/i.test(url))                          return 'PDF Viewer';
    if (url.includes('docs.google.com/document/'))           return 'Google Doc';
    if (url.includes('docs.google.com/spreadsheets/'))       return 'Google Sheet';
    if (url.includes('docs.google.com/presentation/'))       return 'Google Slides';
    return 'Embedded Frame';
}

async function handleImgFileSelected(file) {
    if (!file) return;
    document.getElementById('img-drop-zone').hidden    = false;
    document.getElementById('img-preview-wrap').hidden = true;
    document.getElementById('img-insert-btn').disabled = true;
    document.getElementById('img-compress-info').textContent = 'Compressing…';
    document.getElementById('img-drop-zone').hidden    = true;
    document.getElementById('img-preview-wrap').hidden = false;

    try {
        const c = await compressImage(file);
        imgPicker.compressed   = c;
        imgPicker.originalFile = file;
        document.getElementById('img-preview').src = `data:${c.mime};base64,${c.base64}`;
        document.getElementById('img-alt-upload').value =
            file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
        const savings = file.size > 0 ? Math.round((1 - c.size / file.size) * 100) : 0;
        document.getElementById('img-compress-info').textContent =
            `${c.width}×${c.height} · ${Math.round(c.size / 1024)} KB` +
            (savings > 5 ? ` (${savings}% smaller than original)` : '');
        document.getElementById('img-insert-btn').disabled = false;
    } catch {
        document.getElementById('img-compress-info').textContent = 'Could not process image.';
    }
}

function insertMediaMarkdown(url, alt, type) {
    const ta = imgPicker.ta;
    if (!ta) return;
    editorSaveState(ta);
    const md  = `![${alt || ''}]{${type}}(${url})`;
    const pos = imgPicker.cursorPos;
    ta.value          = ta.value.substring(0, pos) + md + ta.value.substring(pos);
    ta.selectionStart = pos + md.length;
    ta.selectionEnd   = pos + md.length;
    ta.focus();
}

// Tab switching
document.querySelectorAll('.img-tab-btn').forEach(btn =>
    btn.addEventListener('click', () => switchImgTab(btn.dataset.tab)));

// Browse button & file input
document.getElementById('img-browse-btn')?.addEventListener('click', () =>
    document.getElementById('img-file-input').click());

document.getElementById('img-file-input')?.addEventListener('change', e => {
    handleImgFileSelected(e.target.files?.[0]);
    e.target.value = '';
});

// Drag and drop
const dropZone = document.getElementById('img-drop-zone');
dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone?.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) handleImgFileSelected(file);
});

// Document browse, drop, clear
document.getElementById('doc-browse-btn')?.addEventListener('click', () =>
    document.getElementById('doc-file-input').click());
document.getElementById('doc-file-input')?.addEventListener('change', e => {
    handleDocFileSelected(e.target.files?.[0]);
    e.target.value = '';
});
document.getElementById('doc-file-clear')?.addEventListener('click', () => {
    imgPicker.docFile = null;
    document.getElementById('doc-drop-zone').hidden  = false;
    document.getElementById('doc-file-ready').hidden = true;
    if (!imgPicker.selectedDocUrl) document.getElementById('img-insert-btn').disabled = true;
});
const docDropZone = document.getElementById('doc-drop-zone');
docDropZone?.addEventListener('dragover', e => { e.preventDefault(); docDropZone.classList.add('drag-over'); });
docDropZone?.addEventListener('dragleave', () => docDropZone.classList.remove('drag-over'));
docDropZone?.addEventListener('drop', e => {
    e.preventDefault();
    docDropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files?.[0];
    if (file) handleDocFileSelected(file);
});

// Embed URL input
document.getElementById('embed-url-input')?.addEventListener('input', e => {
    const url   = e.target.value.trim();
    const badge = document.getElementById('embed-type-badge');
    document.getElementById('img-insert-btn').disabled = !url;
    if (url) { badge.hidden = false; badge.textContent = getEmbedType(url); }
    else     { badge.hidden = true; }
});

// Sound browse, drop, clear
document.getElementById('snd-browse-btn')?.addEventListener('click', () =>
    document.getElementById('snd-file-input').click());
document.getElementById('snd-file-input')?.addEventListener('change', e => {
    handleSndFileSelected(e.target.files?.[0]);
    e.target.value = '';
});
document.getElementById('snd-file-clear')?.addEventListener('click', () => {
    imgPicker.sndFile = null;
    document.getElementById('snd-drop-zone').hidden  = false;
    document.getElementById('snd-file-ready').hidden = true;
    if (!imgPicker.selectedSndUrl) document.getElementById('img-insert-btn').disabled = true;
});
const sndDropZone = document.getElementById('snd-drop-zone');
sndDropZone?.addEventListener('dragover', e => { e.preventDefault(); sndDropZone.classList.add('drag-over'); });
sndDropZone?.addEventListener('dragleave', () => sndDropZone.classList.remove('drag-over'));
sndDropZone?.addEventListener('drop', e => {
    e.preventDefault();
    sndDropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files?.[0];
    if (file) handleSndFileSelected(file);
});

// Insert button
document.getElementById('img-insert-btn')?.addEventListener('click', async () => {
    const activeTab = document.querySelector('.img-tab-btn.active')?.dataset.tab;
    const btn = document.getElementById('img-insert-btn');

    if (activeTab === 'library') {
        if (!imgPicker.selectedUrl) return;
        const alt = document.getElementById('img-alt-library').value.trim();
        insertMediaMarkdown(imgPicker.selectedUrl, alt, 'img');
        closeModal('image-picker-modal');
        return;
    }

    if (activeTab === 'documents') {
        if (imgPicker.selectedDocUrl) {
            insertMediaMarkdown(imgPicker.selectedDocUrl, imgPicker.selectedDocName, 'doc');
            closeModal('image-picker-modal');
            return;
        }
        if (!imgPicker.docFile) return;
        btn.disabled = true; btn.textContent = 'Uploading…';
        try {
            const file   = imgPicker.docFile;
            const data   = await fileToBase64(file);
            const res    = await apiFetch('/api/policy/upload-document', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: file.name, mime_type: file.type, data }),
            });
            if (!res.ok) { showToast(res.error || 'Upload failed', 'error'); return; }
            docsLoaded = false;
            insertMediaMarkdown(res.url, file.name, 'doc');
            closeModal('image-picker-modal');
            showToast('Document uploaded and inserted', 'success');
        } catch (e) { showToast('Upload error: ' + (e?.message || 'Unknown'), 'error'); }
        finally { btn.disabled = false; btn.textContent = 'Insert'; }
        return;
    }

    if (activeTab === 'sounds') {
        if (imgPicker.selectedSndUrl) {
            insertMediaMarkdown(imgPicker.selectedSndUrl, imgPicker.selectedSndName, 'audio');
            closeModal('image-picker-modal');
            return;
        }
        if (!imgPicker.sndFile) return;
        btn.disabled = true; btn.textContent = 'Uploading…';
        try {
            const file   = imgPicker.sndFile;
            const data   = await fileToBase64(file);
            const res    = await apiFetch('/api/policy/upload-sound', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: file.name, mime_type: file.type, data }),
            });
            if (!res.ok) { showToast(res.error || 'Upload failed', 'error'); return; }
            soundsLoaded = false;
            insertMediaMarkdown(res.url, file.name, 'audio');
            closeModal('image-picker-modal');
            showToast('Audio uploaded and inserted', 'success');
        } catch (e) { showToast('Upload error: ' + (e?.message || 'Unknown'), 'error'); }
        finally { btn.disabled = false; btn.textContent = 'Insert'; }
        return;
    }

    if (activeTab === 'embeds') {
        const url = document.getElementById('embed-url-input').value.trim();
        if (!url) return;
        insertMediaMarkdown(url, '', 'embed');
        closeModal('image-picker-modal');
        return;
    }

    // Upload tab
    if (!imgPicker.compressed) return;
    btn.disabled    = true;
    btn.textContent = 'Uploading…';

    try {
        const c    = imgPicker.compressed;
        const file = imgPicker.originalFile;
        const ext  = c.mime === 'image/webp' ? 'webp' : c.mime === 'image/png' ? 'png'
                   : c.mime === 'image/gif'  ? 'gif'  : 'jpg';
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const res = await apiFetch('/api/policy/upload-image', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename:  `${baseName}.${ext}`,
                mime_type: c.mime,
                data:      c.base64,
                width:     c.width,
                height:    c.height,
            }),
        });

        if (!res.ok) { showToast(res.error || 'Upload failed', 'error'); return; }

        // Prepend new image to the library grid so it's visible immediately
        libraryLoaded = false; // force reload next time library tab opens

        const alt = document.getElementById('img-alt-upload').value.trim()
                 || baseName.replace(/[_-]/g, ' ');
        insertMediaMarkdown(res.url, alt, 'img');
        closeModal('image-picker-modal');
        showToast('Image uploaded and inserted', 'success');
    } catch (e) {
        showToast('Upload error: ' + (e?.message || 'Unknown'), 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Insert';
    }
});

document.getElementById('content-edit-save')?.addEventListener('click', async () => {
    const id       = document.getElementById('content-edit-id').value;
    const table    = document.getElementById('content-edit-table').value;
    const title    = document.getElementById('content-edit-title').value.trim();
    const slug     = document.getElementById('content-edit-slug').value.trim();
    const number   = document.getElementById('content-edit-number').value.trim();
    const anchor   = document.getElementById('content-edit-anchor').value.trim();
    const content  = document.getElementById('content-edit-content').value;
    const mode     = document.getElementById('content-edit-mode').value;
    const parentId = document.getElementById('content-edit-parent-id').value;
    const errEl    = document.getElementById('content-edit-error');
    errEl.classList.add('hidden');

    if (!title) { errEl.textContent = 'Title cannot be empty'; errEl.classList.remove('hidden'); return; }
    if (!slug)  { errEl.textContent = 'Slug cannot be empty';  errEl.classList.remove('hidden'); return; }

    const token = localStorage.getItem('gftv-token');

    if (mode === 'add') {
        const type = parentId
            ? 'subsection'
            : (document.getElementById('content-edit-type')?.value || 'article');
        const res = await apiFetch('/api/policy/add-section', {
            method: 'POST',
            body: JSON.stringify({ table, title, slug, content, type, parent_id: parentId || null, number: number || null, anchor: anchor || null }),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
            closeModal('content-modal');
            showToast('Section created', 'success');
            docSectionsCache[currentDoc] = null;
            await loadSections(currentDoc, { force: true });
            navigate(`${DOCS[currentDoc].urlBase}/${res.section.slug}`);
        } else {
            errEl.textContent = res.error || 'Create failed';
            errEl.classList.remove('hidden');
        }
    } else {
        const res = await apiFetch('/api/policy/update-section', {
            method: 'PUT',
            body: JSON.stringify({ id, table, title, slug, content, anchor: anchor || null, number: number || null }),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
            closeModal('content-modal');
            showToast('Section updated', 'success');
            const sec = sections.find(s => s.id === id);
            if (sec) Object.assign(sec, res.section);
            buildSidebar();
            navigate(`${DOCS[currentDoc].urlBase}/${res.section?.slug || slug}${location.hash}`, { replace: true });
        } else {
            errEl.textContent = res.error || 'Update failed';
            errEl.classList.remove('hidden');
        }
    }
});

/* ─── Move Up / Down ─── */
async function moveSection(direction) {
    const id    = document.getElementById('content-edit-id').value;
    const table = document.getElementById('content-edit-table').value;
    const errEl = document.getElementById('content-edit-error');
    const token = localStorage.getItem('gftv-token');
    const res = await apiFetch('/api/policy/reorder-section', {
        method: 'PUT',
        body: JSON.stringify({ id, table, direction }),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
        closeModal('content-modal');
        showToast('Reordered', 'success');
        docSectionsCache[currentDoc] = null;
        await loadSections(currentDoc, { force: true });
        navigate(location.pathname + location.hash, { replace: true });
    } else {
        errEl.textContent = res.error || 'Reorder failed';
        errEl.classList.remove('hidden');
    }
}

document.getElementById('content-edit-move-up')?.addEventListener('click', () => moveSection('up'));
document.getElementById('content-edit-move-down')?.addEventListener('click', () => moveSection('down'));

/* ─── Delete Section ─── */
let _pendingDeleteId = null;
let _pendingDeleteTable = null;
let _pendingDeleteParent = null;

document.getElementById('content-edit-delete')?.addEventListener('click', () => {
    _pendingDeleteId = document.getElementById('content-edit-id').value;
    _pendingDeleteTable = document.getElementById('content-edit-table').value;
    _pendingDeleteParent = document.getElementById('content-edit-parent-id').value || null;
    const title = document.getElementById('content-edit-title').value;
    document.getElementById('delete-confirm-message').textContent =
        `Are you sure you want to delete "${title}"? This cannot be undone.`;
    document.getElementById('delete-confirm-error').classList.add('hidden');
    closeModal('content-modal');
    openModal('delete-confirm-modal');
});

document.getElementById('delete-confirm-btn')?.addEventListener('click', async () => {
    if (!_pendingDeleteId || !_pendingDeleteTable) return;
    const token = localStorage.getItem('gftv-token');
    const res = await apiFetch('/api/policy/delete-section', {
        method: 'DELETE',
        body: JSON.stringify({ id: _pendingDeleteId, table: _pendingDeleteTable }),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
        closeModal('delete-confirm-modal');
        showToast('Section deleted', 'success');
        docSectionsCache[currentDoc] = null;
        await loadSections(currentDoc, { force: true });
        if (_pendingDeleteParent) {
            // Navigate back to the parent article
            const parent = sections.find(s => s.id === _pendingDeleteParent);
            if (parent) navigate(`${DOCS[currentDoc].urlBase}/${parent.slug}`);
            else navigate(DOCS[currentDoc].urlBase);
        } else {
            navigate(DOCS[currentDoc].urlBase);
        }
        _pendingDeleteId = null;
        _pendingDeleteTable = null;
        _pendingDeleteParent = null;
    } else {
        document.getElementById('delete-confirm-error').textContent = res.error || 'Delete failed';
        document.getElementById('delete-confirm-error').classList.remove('hidden');
    }
});

/* ─── Admin ─── */
async function loadAdmin() {
    if (!currentUser || !currentUser.is_admin) {
        showPage('home');
        showToast('Admin access required', 'error');
        return;
    }
    loadAdminUsers();
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`)?.classList.remove('hidden');
            if (btn.dataset.tab === 'images')    loadAdminImages();
            if (btn.dataset.tab === 'documents') loadAdminDocuments();
            if (btn.dataset.tab === 'sounds')    loadAdminSounds();
        });
    });
}

async function loadAdminUsers() {
    const token = localStorage.getItem('gftv-token');
    const res = await apiFetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
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
}

let adminImagesLoaded = false;
async function loadAdminImages(force = false) {
    if (adminImagesLoaded && !force) return;
    const listEl = document.getElementById('admin-images-list');
    if (!listEl) return;
    listEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">Loading images…</p>';
    const token = localStorage.getItem('gftv-token');
    const res = await apiFetch('/api/policy/images', {
        headers: { Authorization: `Bearer ${token}` }
    });
    adminImagesLoaded = true;
    if (!res.ok) {
        listEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">Failed to load images.</p>';
        return;
    }
    const images = res.images || [];
    if (!images.length) {
        listEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">No images uploaded yet.</p>';
        return;
    }
    listEl.innerHTML = `<div class="admin-images-wrap"><table class="admin-images-table">
    <thead><tr><th></th><th>Filename</th><th>Description</th><th>Size</th><th>Uploaded</th><th>Actions</th></tr></thead>
    <tbody>${images.map(adminImgRowHtml).join('')}</tbody></table></div>`;
}

window.copyImageUrl = function(url) {
    navigator.clipboard.writeText(url).then(() => showToast('URL copied to clipboard', 'success'));
};

window.openAsBlob = async function(url, filename) {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
    } catch {
        window.open(url, '_blank');
    }
};

window.downloadAsBlob = async function(url, filename) {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
};

function initBlobMedia(container) {
    container.querySelectorAll('audio[data-blob-src]').forEach(async el => {
        try {
            const url = el.dataset.blobSrc;
            const res = await fetch(url);
            const blob = await res.blob();
            el.src = URL.createObjectURL(blob);
        } catch {
            el.src = el.dataset.blobSrc;
        }
    });
}

/* ─── Delete Image Modal ─── */
{
    let pendingDeleteId  = null;
    let pendingDeleteBtn = null;

    window.deleteAdminImage = function(id, btn) {
        const row = btn.closest('tr');
        const filename = row?.querySelector('.admin-img-filename')?.textContent || 'this image';
        document.getElementById('delete-image-filename').textContent = filename;
        pendingDeleteId  = id;
        pendingDeleteBtn = btn;
        openModal('delete-image-modal');
    };

    document.getElementById('delete-image-confirm')?.addEventListener('click', async () => {
        if (!pendingDeleteId) return;
        const id  = pendingDeleteId;
        const btn = pendingDeleteBtn;
        pendingDeleteId  = null;
        pendingDeleteBtn = null;
        closeModal('delete-image-modal');
        btn.disabled = true;
        const token = localStorage.getItem('gftv-token');
        const res = await apiFetch(`/api/policy/manage-image?id=${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
            document.querySelector(`tr[data-img-id="${id}"]`)?.remove();
            showToast('Image deleted', 'success');
        } else {
            btn.disabled = false;
            showToast(res.error || 'Failed to delete', 'error');
        }
    });
}

window.editImageDesc = function(el) {
    if (el.querySelector('input')) return;
    const id = el.dataset.id;
    const current = el.dataset.desc || '';
    el.innerHTML = `<input class="admin-img-desc-input" type="text" value="${current.replace(/"/g, '&quot;')}" placeholder="Add description…">`;
    const input = el.querySelector('input');
    input.focus();
    input.select();
    let cancelled = false;

    async function save() {
        if (cancelled) return;
        const val = input.value.trim();
        el.dataset.desc = val;
        el.innerHTML = val || '<em style="color:var(--text-muted);font-style:normal">—</em>';
        const token = localStorage.getItem('gftv-token');
        const res = await apiFetch(`/api/policy/manage-image?id=${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ description: val || null }),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        if (!res.ok) showToast('Failed to save description', 'error');
    }

    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') {
            cancelled = true;
            el.innerHTML = el.dataset.desc || '<em style="color:var(--text-muted);font-style:normal">—</em>';
        }
    });
};

/* ─── Admin Documents ─── */
function adminDocRowHtml(d) {
    const kb   = Math.round(d.file_size / 1024);
    const ext  = d.filename.split('.').pop().toUpperCase();
    const date = new Date(d.uploaded_at).toLocaleDateString();
    return `<tr data-doc-id="${d.id}">
      <td class="admin-img-filename">${d.filename}</td>
      <td style="color:var(--text-muted);font-size:0.8rem">${ext}</td>
      <td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap">${kb} KB</td>
      <td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap">${date}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm btn-ghost" onclick="copyImageUrl('${d.public_url}')">Copy URL</button>
        <button class="btn btn-sm btn-danger" onclick="deleteAdminDocument('${d.id}', this)">Delete</button>
      </td>
    </tr>`;
}

let adminDocsLoaded = false;
async function loadAdminDocuments(force = false) {
    if (adminDocsLoaded && !force) return;
    const listEl = document.getElementById('admin-documents-list');
    if (!listEl) return;
    listEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">Loading documents…</p>';
    const res = await apiFetch('/api/policy/documents');
    adminDocsLoaded = true;
    if (!res.ok) { listEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">Failed to load documents.</p>'; return; }
    const docs = res.documents || [];
    if (!docs.length) { listEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">No documents uploaded yet.</p>'; return; }
    listEl.innerHTML = `<div class="admin-images-wrap"><table class="admin-images-table">
    <thead><tr><th>Filename</th><th>Type</th><th>Size</th><th>Uploaded</th><th>Actions</th></tr></thead>
    <tbody>${docs.map(adminDocRowHtml).join('')}</tbody></table></div>`;
}

/* ─── Delete Document Modal ─── */
{
    let pendingDocId  = null;
    let pendingDocBtn = null;

    window.deleteAdminDocument = function(id, btn) {
        const row = btn.closest('tr');
        const filename = row?.querySelector('.admin-img-filename')?.textContent || 'this document';
        document.getElementById('delete-document-filename').textContent = filename;
        pendingDocId  = id;
        pendingDocBtn = btn;
        openModal('delete-document-modal');
    };

    document.getElementById('delete-document-confirm')?.addEventListener('click', async () => {
        if (!pendingDocId) return;
        const id  = pendingDocId;
        const btn = pendingDocBtn;
        pendingDocId  = null;
        pendingDocBtn = null;
        closeModal('delete-document-modal');
        btn.disabled = true;
        const res = await apiFetch(`/api/policy/manage-document?id=${id}`, { method: 'DELETE' });
        if (res.ok) { document.querySelector(`tr[data-doc-id="${id}"]`)?.remove(); showToast('Document deleted', 'success'); }
        else { btn.disabled = false; showToast(res.error || 'Failed to delete', 'error'); }
    });
}

/* ─── Admin Document Upload ─── */
{
    const fileInput = document.getElementById('admin-doc-file-input');
    const uploadBtn = document.getElementById('admin-doc-upload-btn');

    uploadBtn?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', async e => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading…';
        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            const token = localStorage.getItem('gftv-token');
            const res = await apiFetch('/api/policy/upload-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ filename: file.name, mime_type: file.type, data: base64 }),
            });
            if (!res.ok) { showToast(res.error || 'Upload failed', 'error'); return; }
            showToast('Document uploaded', 'success');
            const listEl = document.getElementById('admin-documents-list');
            const tbody = listEl?.querySelector('tbody');
            if (tbody && res.document) {
                tbody.insertAdjacentHTML('afterbegin', adminDocRowHtml(res.document));
            } else {
                adminDocsLoaded = false;
                loadAdminDocuments();
            }
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload Document';
        }
    });
}

/* ─── Admin Sounds ─── */
function adminSndRowHtml(s) {
    const kb   = Math.round(s.file_size / 1024);
    const ext  = s.filename.split('.').pop().toUpperCase();
    const date = new Date(s.uploaded_at).toLocaleDateString();
    return `<tr data-snd-id="${s.id}">
      <td class="admin-img-filename">${s.filename}</td>
      <td style="color:var(--text-muted);font-size:0.8rem">${ext}</td>
      <td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap">${kb} KB</td>
      <td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap">${date}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm btn-ghost" onclick="copyImageUrl('${s.public_url}')">Copy URL</button>
        <button class="btn btn-sm btn-danger" onclick="deleteAdminSound('${s.id}', this)">Delete</button>
      </td>
    </tr>`;
}

let adminSoundsLoaded = false;
async function loadAdminSounds(force = false) {
    if (adminSoundsLoaded && !force) return;
    const listEl = document.getElementById('admin-sounds-list');
    if (!listEl) return;
    listEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">Loading audio files…</p>';
    const res = await apiFetch('/api/policy/sounds');
    adminSoundsLoaded = true;
    if (!res.ok) { listEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">Failed to load sounds.</p>'; return; }
    const sounds = res.sounds || [];
    if (!sounds.length) { listEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">No audio files uploaded yet.</p>'; return; }
    listEl.innerHTML = `<div class="admin-images-wrap"><table class="admin-images-table">
    <thead><tr><th>Filename</th><th>Type</th><th>Size</th><th>Uploaded</th><th>Actions</th></tr></thead>
    <tbody>${sounds.map(adminSndRowHtml).join('')}</tbody></table></div>`;
}

/* ─── Delete Sound Modal ─── */
{
    let pendingSndId  = null;
    let pendingSndBtn = null;

    window.deleteAdminSound = function(id, btn) {
        const row = btn.closest('tr');
        const filename = row?.querySelector('.admin-img-filename')?.textContent || 'this audio file';
        document.getElementById('delete-sound-filename').textContent = filename;
        pendingSndId  = id;
        pendingSndBtn = btn;
        openModal('delete-sound-modal');
    };

    document.getElementById('delete-sound-confirm')?.addEventListener('click', async () => {
        if (!pendingSndId) return;
        const id  = pendingSndId;
        const btn = pendingSndBtn;
        pendingSndId  = null;
        pendingSndBtn = null;
        closeModal('delete-sound-modal');
        btn.disabled = true;
        const res = await apiFetch(`/api/policy/manage-sound?id=${id}`, { method: 'DELETE' });
        if (res.ok) { document.querySelector(`tr[data-snd-id="${id}"]`)?.remove(); showToast('Audio deleted', 'success'); }
        else { btn.disabled = false; showToast(res.error || 'Failed to delete', 'error'); }
    });
}

/* ─── Admin Sound Upload ─── */
{
    const fileInput = document.getElementById('admin-snd-file-input');
    const uploadBtn = document.getElementById('admin-snd-upload-btn');

    uploadBtn?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', async e => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading…';
        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            const token = localStorage.getItem('gftv-token');
            const res = await apiFetch('/api/policy/upload-sound', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ filename: file.name, mime_type: file.type, data: base64 }),
            });
            if (!res.ok) { showToast(res.error || 'Upload failed', 'error'); return; }
            showToast('Sound uploaded', 'success');
            const listEl = document.getElementById('admin-sounds-list');
            const tbody = listEl?.querySelector('tbody');
            if (tbody && res.sound) {
                tbody.insertAdjacentHTML('afterbegin', adminSndRowHtml(res.sound));
            } else {
                adminSoundsLoaded = false;
                loadAdminSounds();
            }
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload Sound';
        }
    });
}

/* ─── Admin Image Upload ─── */
function adminImgRowHtml(img) {
    const kb  = Math.round(img.file_size / 1024);
    const dim = img.width ? `${img.width}×${img.height}` : '';
    const date = new Date(img.uploaded_at).toLocaleDateString();
    const desc = (img.description || '').replace(/"/g, '&quot;');
    return `<tr data-img-id="${img.id}">
      <td><img class="admin-img-thumb" src="${img.public_url}" alt="" loading="lazy"></td>
      <td class="admin-img-filename">${img.filename}</td>
      <td><span class="admin-img-desc" data-id="${img.id}" data-desc="${desc}" onclick="editImageDesc(this)">${img.description || '<em style="color:var(--text-muted);font-style:normal">—</em>'}</span></td>
      <td style="color:var(--text-muted);white-space:nowrap;font-size:0.8rem">${dim ? dim + '<br>' : ''}${kb} KB</td>
      <td style="color:var(--text-muted);white-space:nowrap;font-size:0.8rem">${date}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm btn-ghost" onclick="copyImageUrl('${img.public_url}')">Copy URL</button>
        <button class="btn btn-sm btn-danger" onclick="deleteAdminImage('${img.id}', this)">Delete</button>
      </td>
    </tr>`;
}

{
    let adminStagedCompressed = null;
    let adminStagedFile = null;

    const fileInput  = document.getElementById('admin-img-file-input');
    const uploadBtn  = document.getElementById('admin-img-upload-btn');
    const stagingEl  = document.getElementById('admin-img-staging');

    uploadBtn?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', async e => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        adminStagedCompressed = null;
        adminStagedFile = file;
        stagingEl.className = 'admin-img-staging';
        stagingEl.innerHTML = `
            <div class="admin-img-staging-thumb"></div>
            <div class="admin-img-staging-info">
                <span class="admin-img-staging-name">${file.name}</span>
                <span class="admin-img-staging-meta">Compressing…</span>
            </div>
            <button class="btn btn-sm btn-primary" id="admin-img-staging-go" disabled>Upload</button>
            <button class="btn btn-sm btn-ghost" id="admin-img-staging-cancel">Cancel</button>`;

        document.getElementById('admin-img-staging-cancel').addEventListener('click', () => {
            stagingEl.className = 'admin-img-staging hidden';
            stagingEl.innerHTML = '';
            adminStagedCompressed = null;
            adminStagedFile = null;
        });

        try {
            const c = await compressImage(file);
            adminStagedCompressed = c;
            const thumb = stagingEl.querySelector('.admin-img-staging-thumb');
            thumb.innerHTML = `<img src="data:${c.mime};base64,${c.base64}" alt="">`;
            const savings = file.size > 0 ? Math.round((1 - c.size / file.size) * 100) : 0;
            stagingEl.querySelector('.admin-img-staging-meta').textContent =
                `${c.width}×${c.height} · ${Math.round(c.size / 1024)} KB` +
                (savings > 5 ? ` (${savings}% smaller)` : '');
            const goBtn = document.getElementById('admin-img-staging-go');
            goBtn.disabled = false;
            goBtn.addEventListener('click', async () => {
                goBtn.disabled = true;
                goBtn.textContent = 'Uploading…';
                const ext = c.mime === 'image/webp' ? 'webp' : c.mime === 'image/png' ? 'png'
                          : c.mime === 'image/gif'  ? 'gif'  : 'jpg';
                const baseName = file.name.replace(/\.[^.]+$/, '');
                const token = localStorage.getItem('gftv-token');
                const res = await apiFetch('/api/policy/upload-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                        filename:  `${baseName}.${ext}`,
                        mime_type: c.mime,
                        data:      c.base64,
                        width:     c.width,
                        height:    c.height,
                    }),
                });
                if (!res.ok) {
                    showToast(res.error || 'Upload failed', 'error');
                    goBtn.disabled = false;
                    goBtn.textContent = 'Upload';
                    return;
                }
                showToast('Image uploaded', 'success');
                stagingEl.className = 'admin-img-staging hidden';
                stagingEl.innerHTML = '';
                adminStagedCompressed = null;
                adminStagedFile = null;
                libraryLoaded = false; // invalidate image picker library cache

                // Prepend row to admin table, or rebuild if table doesn't exist yet
                const listEl = document.getElementById('admin-images-list');
                const tbody = listEl?.querySelector('tbody');
                if (tbody && res.image) {
                    tbody.insertAdjacentHTML('afterbegin', adminImgRowHtml(res.image));
                } else {
                    adminImagesLoaded = false;
                    loadAdminImages();
                }
            });
        } catch {
            stagingEl.querySelector('.admin-img-staging-meta').textContent = 'Could not process image.';
        }
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
    if (id === 'auth-modal') showLoginStep();
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

/* ─── Image click → open as blob in new tab (hides storage URL) ─── */
document.addEventListener('click', async e => {
    const el = e.target.closest('.section-img, .section-img-figure img');
    if (!el) return;
    try {
        const res    = await fetch(el.src);
        const blob   = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
        window.open(el.src, '_blank');
    }
});

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
/* ─── Search ─── */
async function prefetchSections(docKey) {
    if (docSectionsCache[docKey]) return;
    try {
        const res = await apiFetch(DOCS[docKey].apiSections);
        if (res.ok) docSectionsCache[docKey] = res.sections || [];
    } catch (e) { /* silent */ }
}

async function openSearch() {
    openModal('search-modal');
    const input = document.getElementById('search-input');
    if (input) {
        input.value = '';
        renderSearchResults('');
        input.focus();
    }
    await Promise.all(Object.keys(DOCS).map(prefetchSections));
    const currentQuery = document.getElementById('search-input')?.value || '';
    renderSearchResults(currentQuery);
}

function closeSearch() {
    closeModal('search-modal');
}

function stripMarkdown(md) {
    return md
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/#{1,6}\s/g, '')
        .replace(/[*_~`>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractSnippet(text, query, maxLen = 140) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text.slice(0, maxLen) + (text.length > maxLen ? '…' : '');
    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + query.length + 100);
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

function getSearchIndex() {
    const items = [
        { title: 'Home', sub: 'PolicySpot', href: '/', type: 'page', content: '' },
        ...SITE_PAGES.map(p => ({ title: p.label, sub: 'Page', href: p.href, type: 'page', content: '' })),
    ];
    for (const [docKey, docSections] of Object.entries(docSectionsCache)) {
        const doc = DOCS[docKey];
        docSections.forEach(s => {
            if (s.type === 'subsection') {
                const parent = docSections.find(p => p.id === s.parent_id);
                const parentSlug = parent?.slug || '';
                items.push({ title: s.title, sub: doc.label, href: `${doc.urlBase}/${parentSlug}#${s.slug || s.id}`, type: 'section', content: s.content || '' });
            } else {
                items.push({ title: s.title, sub: doc.label, href: `${doc.urlBase}/${s.slug}`, type: 'section', content: s.content || '' });
            }
        });
    }
    return items;
}

const PAGE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" stroke-width="2"/><polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2"/></svg>`;
const SECTION_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><line x1="8" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="3" y1="6" x2="3.01" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="3" y1="12" x2="3.01" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="3" y1="18" x2="3.01" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

function buildResultItem(item, index, query) {
    const btn = document.createElement('button');
    btn.className = 'search-result-item';
    btn.dataset.index = index;
    let snippet = '';
    if (query && item.content) {
        const plain = stripMarkdown(item.content);
        if (plain.toLowerCase().includes(query.toLowerCase())) {
            snippet = extractSnippet(plain, query);
        }
    }
    btn.innerHTML = `
        <span class="search-result-icon">${item.type === 'page' ? PAGE_ICON : SECTION_ICON}</span>
        <span class="search-result-text">
            <span class="search-result-title">${item.title}</span>
            <span class="search-result-sub">${item.sub}</span>
            ${snippet ? `<span class="search-result-snippet">${snippet}</span>` : ''}
        </span>`;
    btn.addEventListener('click', () => { closeSearch(); navigate(item.href); });
    return btn;
}

function renderSearchResults(query) {
    const container = document.getElementById('search-results');
    if (!container) return;
    const q = query.trim().toLowerCase();
    const index = getSearchIndex();
    const results = q
        ? index.filter(i =>
            i.title.toLowerCase().includes(q) ||
            i.sub.toLowerCase().includes(q) ||
            (i.content && stripMarkdown(i.content).toLowerCase().includes(q))
          ).slice(0, 12)
        : index.filter(i => i.type === 'page');
    container.innerHTML = '';
    if (q && !results.length) {
        container.innerHTML = `<div class="search-empty">No results for "<strong>${query}</strong>"</div>`;
        return;
    }
    results.forEach((item, i) => container.appendChild(buildResultItem(item, i, query.trim())));
}

function setupEventListeners() {
    document.getElementById('theme-btn')?.addEventListener('click', () => openModal('theme-modal'));
    document.getElementById('search-btn')?.addEventListener('click', openSearch);
    document.getElementById('sidebar-search-btn')?.addEventListener('click', () => { closeSidebar(); openSearch(); });
    document.getElementById('menu-btn')?.addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-close')?.addEventListener('click', closeSidebar);
    document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
    document.getElementById('login-btn')?.addEventListener('click', () => openModal('auth-modal'));

    document.getElementById('search-input')?.addEventListener('input', e => renderSearchResults(e.target.value));
    document.getElementById('search-input')?.addEventListener('keydown', e => {
        const items = document.querySelectorAll('.search-result-item');
        const focused = document.querySelector('.search-result-item.focused');
        let idx = focused ? parseInt(focused.dataset.index) : -1;
        if (e.key === 'Escape') { closeSearch(); return; }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            idx = Math.min(idx + 1, items.length - 1);
            items.forEach((item, i) => item.classList.toggle('focused', i === idx));
            items[idx]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            idx = Math.max(idx - 1, 0);
            items.forEach((item, i) => item.classList.toggle('focused', i === idx));
            items[idx]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            document.querySelector('.search-result-item.focused')?.click();
        }
    });

    document.querySelectorAll('.nav-link').forEach(l => {
        l.addEventListener('click', e => {
            e.preventDefault();
            const p = l.dataset.page;
            if (p === 'home') navigate('/');
            else if (p === 'charter') navigate('/the-charter');
            else if (p === 'news') navigate('/news');
            else if (p === 'prs') navigate('/prs');
            else if (p === 'rules') navigate('/rules');
            else if (p === 'join') navigate('/join-us');
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

    // Home page document cards
    document.querySelectorAll('.home-doc-card').forEach(card => {
        const fn = () => navigate(card.dataset.href);
        card.addEventListener('click', fn);
        card.addEventListener('keydown', e => e.key === 'Enter' && fn());
    });

    setupCopyDropdown();
}

/* ─── PWA ─── */
// SW is registered and the controllerchange reload listener is set up in index.html.