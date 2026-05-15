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
                renderDocIndex();
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

    if (name === 'home' || name === 'about' || name === 'admin' || name === 'join') {
        const nav = document.getElementById('sidebar-nav');
        if (name === 'home' && nav) nav.innerHTML = '';
        const titleEl = document.querySelector('.sidebar-title');
        if (name === 'home' && titleEl) titleEl.textContent = '';
        closeSidebar();
        if (window.innerWidth >= 900) {
            document.getElementById('sidebar')?.classList.add('collapsed');
            document.getElementById('main-content')?.classList.add('sidebar-hidden');
        }
    } else {
        if (window.innerWidth >= 900) {
            document.getElementById('sidebar')?.classList.remove('collapsed');
            document.getElementById('main-content')?.classList.remove('sidebar-hidden');
        }
    }
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
            if (docKey === 'charter') buildArticleCards();
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

    if (!sections.length) {
        nav.innerHTML = '<div class="sidebar-loading">No sections found.</div>';
        return;
    }
    nav.innerHTML = '';

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
}

function buildArticleCards() {
    const grid = document.getElementById('article-cards');
    if (!grid) return;
    const pages = topLevelPages();
    if (!pages.length) return;
    const urlBase = DOCS['charter'].urlBase;
    grid.innerHTML = pages.map(p => `
    <div class="glass-card article-card" data-slug="${p.slug}" tabindex="0" role="button">
      ${p.number ? `<div class="card-num">${p.number}</div>` : ''}
      <div class="card-title">${p.title}</div>
    </div>`).join('');
    grid.querySelectorAll('.article-card').forEach(card => {
        const fn = () => navigate(`${urlBase}/${card.dataset.slug}`);
        card.addEventListener('click', fn);
        card.addEventListener('keydown', e => e.key === 'Enter' && fn());
    });
}

/* ─── Doc Index (charter index generalised for all docs) ─── */
function renderDocIndex() {
    const doc = DOCS[currentDoc];
    updateBreadcrumb(null);
    updateDocNavFooter(null);
    updateSidebarActive(null, null);

    if (currentDoc === 'charter') {
        const indexView = document.getElementById('charter-index-view');
        const articleView = document.getElementById('charter-article-view');
        if (indexView) indexView.style.display = '';
        if (articleView) articleView.style.display = 'none';
        buildArticleCards();
        return;
    }

    const contentEl = document.getElementById(doc.contentEl);
    if (!contentEl) return;
    const urlBase = doc.urlBase;
    const pages = topLevelPages();

    contentEl.innerHTML = `
    <div class="section-content-inner">
      <div class="section-header">
        <div class="section-type-badge">Document</div>
        <h1 class="section-heading">${doc.label}</h1>
      </div>
      <section class="section-grid">
        <h2 class="section-title">Articles at a Glance</h2>
        <div class="card-grid">
          ${pages.map(p => `
            <div class="glass-card article-card" data-href="${urlBase}/${p.slug}" tabindex="0" role="button">
              ${p.number ? `<div class="card-num">${p.number}</div>` : ''}
              <div class="card-title">${p.title}</div>
            </div>`).join('')}
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

    contentEl.querySelectorAll('.article-card').forEach(card => {
        const fn = () => navigate(card.dataset.href);
        card.addEventListener('click', fn);
        card.addEventListener('keydown', e => e.key === 'Enter' && fn());
    });
    contentEl.querySelectorAll('.toc-card-btn').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            navigate(a.dataset.href);
        });
    });
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
      <div class="section-type-badge">Article</div>
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
        <div class="section-type-badge">${typeLabel}</div>
        <div class="section-meta">
          ${currentUser ? `<span class="section-slug-display">${urlBase}/${section.slug}</span>` : ''}
          ${canEditSlug ? `<button class="edit-slug-btn" data-id="${section.id}" data-slug="${section.slug}">Edit slug</button>` : ''}
          ${canEditContent ? `<button class="edit-content-btn" data-id="${section.id}">Edit</button>` : ''}
        </div>
        <h1 class="section-heading">${section.number ? `${section.number} — ` : ''}${section.title}</h1>
      </div>
      <div class="section-body" id="section-body-content">${renderMarkdown(section.content || '')}</div>
    </div>`;

    if (canEditSlug) {
        contentEl.querySelector('.edit-slug-btn')?.addEventListener('click', () => openSlugModal(section));
    }
    if (canEditContent) {
        contentEl.querySelector('.edit-content-btn')?.addEventListener('click', () => openContentModal(section));
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
    // Links
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
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
    const urlBase = doc.urlBase;
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
        btn.addEventListener('click', () => navigate(`${urlBase}/${btn.dataset.slug}`)));
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
            document.querySelectorAll('.copy-dropdown').forEach(d => { d.hidden = true; });
            dd.hidden = isOpen;
            return;
        }
        if (!e.target.closest('.copy-dropdown')) {
            document.querySelectorAll('.copy-dropdown').forEach(d => { d.hidden = true; });
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
            const doc = DOCS[currentDoc];
            const contentEl = document.getElementById(doc.contentEl);
            if (!contentEl) return;
            const title = currentSection.title || 'export';
            const opt = {
                margin: [12, 14, 12, 14],
                filename: `${title}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };
            showToast('Generating PDF…', 'info');
            const loadHtml2pdf = () => new Promise((resolve, reject) => {
                if (window.html2pdf) return resolve(window.html2pdf);
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                s.onload = () => resolve(window.html2pdf);
                s.onerror = reject;
                document.head.appendChild(s);
            });
            loadHtml2pdf()
                .then(h2p => h2p().set(opt).from(contentEl).output('bloburl'))
                .then(url => { window.open(url, '_blank'); showToast('PDF opened in new tab', 'success'); })
                .catch(() => showToast('Failed to load PDF library', 'error'));
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
}

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
    document.getElementById('menu-btn')?.addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-close')?.addEventListener('click', closeSidebar);
    document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
    document.getElementById('login-btn')?.addEventListener('click', () => openModal('auth-modal'));

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
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}