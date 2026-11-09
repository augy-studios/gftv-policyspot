// Base URL for API calls. Empty means "the same website this page came from".
const API_BASE_URL = '';

/* ─── Document configuration ───
   Every policy document on the site has one entry here describing where its
   data comes from (API endpoints), where it lives on the site (URL base) and
   which HTML elements it renders into. */
const DOCUMENT_CONFIG = {
    charter: {
        apiSections:         '/api/policy/sections',
        apiSection:          '/api/policy/section',
        urlBase:             '/the-charter',
        label:               'Charter of Global Furry Television',
        navPage:             'charter',
        sidebarTitle:        'Charter',
        contentElementId:    'section-content',
        breadcrumbElementId: 'doc-breadcrumb',
        navFooterElementId:  'doc-nav-footer',
    },
    news: {
        apiSections:         '/api/policy/news/sections',
        apiSection:          '/api/policy/news/section',
        urlBase:             '/news',
        label:               'News Standards',
        navPage:             'news',
        sidebarTitle:        'News Standards',
        contentElementId:    'news-content',
        breadcrumbElementId: 'news-breadcrumb',
        navFooterElementId:  'news-nav-footer',
        hero: {
            badge:    'Edition 2023',
            title:    'News Standards // 新闻报道标准',
            subtitle: 'The editorial and journalistic standards of Global Furry Television',
        },
    },
    prs: {
        apiSections:         '/api/policy/prs/sections',
        apiSection:          '/api/policy/prs/section',
        urlBase:             '/prs',
        label:               'Programme Rating System',
        navPage:             'prs',
        sidebarTitle:        'Programme Rating System',
        contentElementId:    'prs-content',
        breadcrumbElementId: 'prs-breadcrumb',
        navFooterElementId:  'prs-nav-footer',
        hero: {
            badge:    'Edition 2023',
            title:    'Programme Rating System // 节目制度系统',
            subtitle: 'The programme classification and content rating framework of Global Furry Television',
        },
    },
    rules: {
        apiSections:         '/api/policy/rules/sections',
        apiSection:          '/api/policy/rules/section',
        urlBase:             '/rules',
        label:               'Community Rules',
        navPage:             'rules',
        sidebarTitle:        'Community Rules',
        contentElementId:    'rules-content',
        breadcrumbElementId: 'rules-breadcrumb',
        navFooterElementId:  'rules-nav-footer',
        hero: {
            badge:    'Edition 2026',
            title:    'Community Rules (CR) // 社区规则与条例',
            subtitle: 'This document will serve as the reference for the rules and regulations that shall govern all communities under Global Furry Television.',
        },
    },
    join: {
        apiSections:         '/api/policy/join/sections',
        apiSection:          '/api/policy/join/section',
        urlBase:             '/join-us',
        label:               'Join GFTV',
        navPage:             'join',
        sidebarTitle:        'Join GFTV',
        contentElementId:    'join-content',
        breadcrumbElementId: 'join-breadcrumb',
        navFooterElementId:  'join-nav-footer',
        defaultSlug:         'home',
    },
    legal: {
        apiSections:         '/api/policy/legal/sections',
        apiSection:          '/api/policy/legal/section',
        urlBase:             '/legal',
        label:               'Legal',
        navPage:             '',
        sidebarTitle:        'Legal',
        contentElementId:    'legal-content',
        breadcrumbElementId: 'legal-breadcrumb',
        navFooterElementId:  'legal-nav-footer',
    },
};

// Screens narrower than this (in pixels) are treated as mobile: the sidebar
// becomes an overlay that closes after a link is chosen.
const MOBILE_BREAKPOINT_WIDTH = 900;

/* ─── State ─── */
let currentUser = null;
let currentDocumentKey = 'charter'; // active document key, one of the keys of DOCUMENT_CONFIG
const documentSectionsCache = {}; // { charter: [], news: [], ... }
let sections = []; // the same list as documentSectionsCache[currentDocumentKey]
let currentSection = null; // currently displayed top-level page/article row
let currentSlug = null;

/* ─── Start-up ─── */
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initRouter();
    await restoreSession();
    await loadSections('charter');
    setupEventListeners();
    handleRoute(location.pathname + location.hash);
});

/* ─── Theme ───
   Two axes: colour theme and light/dark mode. Default is always classic +
   light, regardless of OS preference. See gftv-theme.md.

   Mode preference and mode are different things. The preference is what the
   person chose and can be "time"; the mode is what the document is in and is
   only ever light or dark. */
const COLOR_THEMES = [
    { id: 'classic', label: 'Classic',    dotColor: '#ffffff', hexCode: '#ffffff' },
    { id: 'hello',   label: 'HelloTheme', dotColor: '#fedc00', hexCode: '#fedc00' },
];
const MODE_PREFERENCES = ['light', 'dark', 'time'];
const STORAGE_KEY_COLOR_THEME = 'gftv-policyspot.colorTheme';
const STORAGE_KEY_MODE = 'gftv-policyspot.mode';
const DEFAULT_COLOR_THEME = 'classic';
const DEFAULT_MODE = 'light';

// Page background per combination, for meta[name=theme-color].
const THEME_COLOR = {
    'classic:light': '#ffffff',
    'classic:dark':  '#0f1317',
    'hello:light':   '#fffde0',
    'hello:dark':    '#14120a',
};

/* The daylight window. Duplicated in the pre-paint script in index.html and
   404.html, which have to resolve this before first paint and cannot import
   anything. Change all of them together. */
const LIGHT_FROM_HOUR = 9;
const LIGHT_UNTIL_HOUR = 18;

// Move the old single key onto the two new ones, then drop it.
function migrateLegacyTheme() {
    try {
        const oldThemeSetting = localStorage.getItem('gftv-theme');
        if (oldThemeSetting === null) {
            return;
        }
        if (localStorage.getItem(STORAGE_KEY_COLOR_THEME) === null) {
            let migratedColorTheme = DEFAULT_COLOR_THEME;
            if (oldThemeSetting === 'hello') {
                migratedColorTheme = 'hello';
            }
            localStorage.setItem(STORAGE_KEY_COLOR_THEME, migratedColorTheme);
        }
        if (localStorage.getItem(STORAGE_KEY_MODE) === null) {
            localStorage.setItem(STORAGE_KEY_MODE, DEFAULT_MODE);
        }
        localStorage.removeItem('gftv-theme');
    } catch (storageError) {
        // storage blocked, defaults apply
    }
}

// Returns the saved colour theme id, or the default when nothing valid is saved.
function getStoredColorTheme() {
    let storedValue = null;
    try {
        storedValue = localStorage.getItem(STORAGE_KEY_COLOR_THEME);
    } catch (storageError) {
        // storage blocked, the default is used
    }
    const isKnownTheme = COLOR_THEMES.some(theme => theme.id === storedValue);
    if (isKnownTheme) {
        return storedValue;
    }
    return DEFAULT_COLOR_THEME;
}

// Returns the saved mode preference ("light", "dark" or "time").
function getModePreference() {
    let storedValue = null;
    try {
        storedValue = localStorage.getItem(STORAGE_KEY_MODE);
    } catch (storageError) {
        // storage blocked, the default is used
    }
    if (MODE_PREFERENCES.includes(storedValue)) {
        return storedValue;
    }
    return DEFAULT_MODE;
}

function isDaylightHours(now = new Date()) {
    const hour = now.getHours();
    return hour >= LIGHT_FROM_HOUR && hour < LIGHT_UNTIL_HOUR;
}

// Turns a preference into an actual mode: "time" becomes light or dark
// depending on the clock, and anything other than "dark" becomes light.
function resolveMode(preference) {
    if (preference === 'time') {
        if (isDaylightHours()) {
            return 'light';
        }
        return 'dark';
    }
    if (preference === 'dark') {
        return 'dark';
    }
    return 'light';
}

// The mode the document is in right now, resolved. What syncThemeMeta and
// the export helpers want.
function getStoredMode() {
    return resolveMode(getModePreference());
}

// Updates the browser's <meta name="theme-color"> so the browser toolbar
// colour matches the page.
function syncThemeMeta() {
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeColorMeta) {
        return;
    }
    const themeKey = `${getStoredColorTheme()}:${getStoredMode()}`;
    const themeColor = THEME_COLOR[themeKey] || THEME_COLOR['classic:light'];
    themeColorMeta.setAttribute('content', themeColor);
}

// Redraws the modal from the stored preference and the resolved mode, so the
// pressed button says what was chosen and the note says what the clock did.
function syncModeControls() {
    const preference = getModePreference();
    const resolvedMode = document.documentElement.getAttribute('data-mode');
    document.querySelectorAll('.mode-btn').forEach(modeButton => {
        const isPressed = modeButton.dataset.mode === preference;
        modeButton.classList.toggle('active', isPressed);
        if (isPressed) {
            modeButton.setAttribute('aria-pressed', 'true');
        } else {
            modeButton.setAttribute('aria-pressed', 'false');
        }
    });
    const modeNote = document.getElementById('modeNote');
    if (!modeNote) {
        return;
    }
    if (preference === 'time') {
        const formatHour = hour => String(hour).padStart(2, '0') + ':00';
        modeNote.textContent = `Following the clock: ${resolvedMode} mode now. `
            + `Light from ${formatHour(LIGHT_FROM_HOUR)} to ${formatHour(LIGHT_UNTIL_HOUR)}, dark otherwise.`;
        modeNote.hidden = false;
    } else {
        modeNote.textContent = '';
        modeNote.hidden = true;
    }
}

// Switches the colour theme, saves it, and highlights the matching swatch.
function applyColorTheme(themeId) {
    let theme = COLOR_THEMES.find(candidate => candidate.id === themeId);
    if (!theme) {
        theme = COLOR_THEMES.find(candidate => candidate.id === DEFAULT_COLOR_THEME);
    }
    document.documentElement.setAttribute('data-color-theme', theme.id);
    try {
        localStorage.setItem(STORAGE_KEY_COLOR_THEME, theme.id);
    } catch (storageError) {
        // storage blocked, the theme still applies to this page view
    }
    document.querySelectorAll('.theme-swatch').forEach(swatch => {
        swatch.classList.toggle('active', swatch.dataset.colorTheme === theme.id);
    });
    syncThemeMeta();
}

// Takes a preference, stores the preference, writes the resolved mode.
// Storing the resolved value instead would silently end a "time" choice on
// the first evening.
function applyMode(preference) {
    let chosenPreference = DEFAULT_MODE;
    if (MODE_PREFERENCES.includes(preference)) {
        chosenPreference = preference;
    }
    const resolvedMode = resolveMode(chosenPreference);
    document.documentElement.setAttribute('data-mode', resolvedMode);
    document.documentElement.setAttribute('data-mode-preference', chosenPreference);
    try {
        localStorage.setItem(STORAGE_KEY_MODE, chosenPreference);
    } catch (storageError) {
        // storage blocked, the mode still applies to this page view
    }
    syncThemeMeta();
    syncModeControls();
    scheduleModeCheck();
    return resolvedMode;
}

/* Keeping the time based mode honest while the page stays open. One timer to
   the next boundary rather than polling, plus a re-check when the tab comes
   back into view, since a laptop that slept through 18:00 fires its timer
   late. */
let modeTimer = null;
let isWatchingVisibility = false;

// Milliseconds until the next 09:00 or 18:00, whichever comes first.
function millisecondsUntilNextBoundary(now = new Date()) {
    const nextBoundary = new Date(now);
    nextBoundary.setMinutes(0, 0, 0);
    const hour = now.getHours();
    if (hour < LIGHT_FROM_HOUR) {
        nextBoundary.setHours(LIGHT_FROM_HOUR);
    } else if (hour < LIGHT_UNTIL_HOUR) {
        nextBoundary.setHours(LIGHT_UNTIL_HOUR);
    } else {
        nextBoundary.setDate(nextBoundary.getDate() + 1);
        nextBoundary.setHours(LIGHT_FROM_HOUR);
    }
    // A second of slack, so a timer that fires a fraction early does not land
    // back in the hour it just left and reschedule itself in a tight loop.
    return Math.max(1000, nextBoundary.getTime() - now.getTime() + 1000);
}

function scheduleModeCheck() {
    if (modeTimer !== null) {
        clearTimeout(modeTimer);
        modeTimer = null;
    }
    if (getModePreference() !== 'time') {
        return;
    }

    modeTimer = setTimeout(() => {
        modeTimer = null;
        refreshTimeMode();
    }, millisecondsUntilNextBoundary());

    if (!isWatchingVisibility) {
        isWatchingVisibility = true;
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                refreshTimeMode();
            }
        });
    }
}

// Re-checks the clock while the "time" preference is active and switches
// between light and dark if a boundary has been crossed.
function refreshTimeMode() {
    if (getModePreference() !== 'time') {
        return;
    }
    const resolvedMode = resolveMode('time');
    const currentMode = document.documentElement.getAttribute('data-mode');
    if (resolvedMode !== currentMode) {
        document.documentElement.setAttribute('data-mode', resolvedMode);
        syncThemeMeta();
        document.dispatchEvent(new CustomEvent('gftv:modechange', {
            detail: { mode: resolvedMode, preference: 'time' },
        }));
    }
    scheduleModeCheck();
}

function renderThemeSwatches() {
    const themeGrid = document.getElementById('theme-grid');
    if (!themeGrid) {
        return;
    }
    themeGrid.innerHTML = COLOR_THEMES.map(theme => `
        <button class="theme-swatch" data-color-theme="${theme.id}" type="button">
            <span class="swatch-dot" style="background:${theme.dotColor}"></span>
            <span>${theme.label}</span>
            <span class="swatch-hex">${theme.hexCode}</span>
        </button>`).join('');
}

function initTheme() {
    migrateLegacyTheme();
    renderThemeSwatches();
    applyColorTheme(getStoredColorTheme());
    // The preference, not the resolved mode. Passing the resolved one would
    // quietly rewrite a stored "time" into "dark" the first evening.
    applyMode(getModePreference());
    // A tab left open across 09:00 or 18:00 redraws the modal by itself.
    document.addEventListener('gftv:modechange', syncModeControls);
}

// Export helpers: set attributes directly so a mid-export tab close
// cannot persist the forced theme over the user's pick.
function snapshotTheme() {
    return {
        colorTheme: document.documentElement.getAttribute('data-color-theme'),
        mode: document.documentElement.getAttribute('data-mode'),
    };
}

function forceExportTheme() {
    document.documentElement.setAttribute('data-color-theme', DEFAULT_COLOR_THEME);
    document.documentElement.setAttribute('data-mode', DEFAULT_MODE);
}

function restoreTheme(themeSnapshot) {
    document.documentElement.setAttribute('data-color-theme', themeSnapshot.colorTheme);
    document.documentElement.setAttribute('data-mode', themeSnapshot.mode);
}

/* ─── Router ───
   The site is a single-page app: every URL is served by index.html and this
   code decides which "page" element to show based on the address. */
function initRouter() {
    window.addEventListener('popstate', () => handleRoute(location.pathname + location.hash));
}

// Changes the address bar to "path" without reloading, then shows that page.
function navigate(path, {
    replace = false
} = {}) {
    if (replace) {
        history.replaceState({}, '', path);
    } else {
        history.pushState({}, '', path);
    }
    handleRoute(path);
}

/**
 * Reads a path such as "/news/some-article#part-2" and shows the matching page:
 * the home, about or admin page, a document's index page, or a single article.
 */
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

    // Check each document's urlBase for a match
    for (const [documentKey, documentConfig] of Object.entries(DOCUMENT_CONFIG)) {
        const urlBase = documentConfig.urlBase; // e.g. '/the-charter', '/news'

        // The address is the document's own index page, e.g. "/news"
        if (cleanPath === urlBase) {
            await switchDocument(documentKey);
            showPage(documentKey);
            updateActiveNav(documentConfig.navPage);
            if (documentConfig.defaultSlug) {
                loadPage(documentConfig.defaultSlug, null);
            } else {
                await renderDocumentIndex();
            }
            ensureSidebarOpen();
            return;
        }

        // The address is an article inside the document, e.g. "/news/some-article"
        if (cleanPath.startsWith(urlBase + '/')) {
            const slug = cleanPath.slice(urlBase.length + 1);
            await switchDocument(documentKey);
            showPage(documentKey);
            updateActiveNav(documentConfig.navPage);
            loadPage(slug, hash || null);
            ensureSidebarOpen();
            return;
        }
    }

    showPage('home');
    updateActiveNav('home');
}

/* Switch active document context, loading sections if needed */
async function switchDocument(documentKey) {
    if (currentDocumentKey !== documentKey) {
        currentDocumentKey = documentKey;
        sections = documentSectionsCache[documentKey] || [];
    }
    if (!documentSectionsCache[documentKey]) {
        await loadSections(documentKey);
    } else {
        sections = documentSectionsCache[documentKey];
        buildSidebar();
    }
}

// Opens the sidebar on wide screens (on narrow screens it stays as it is).
function showSidebarOnWideScreens() {
    if (window.innerWidth >= MOBILE_BREAKPOINT_WIDTH) {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('main-content');
        if (sidebar) {
            sidebar.classList.remove('collapsed');
        }
        if (mainContent) {
            mainContent.classList.remove('sidebar-hidden');
        }
    }
}

// Hides every ".page" element and shows the one with id "page-<pageName>".
function showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const pageElement = document.getElementById(`page-${pageName}`);
    if (pageElement) {
        pageElement.classList.add('active');
    }
    if (pageName !== 'charter') {
        window.scrollTo(0, 0);
    }

    // Pages that are not policy documents show the general site navigation
    if (pageName === 'home' || pageName === 'join' || pageName === 'about' || pageName === 'admin') {
        buildHomeSidebar();
    }
    showSidebarOnWideScreens();
}

// Fills the sidebar with links to the main pages of the site.
function buildHomeSidebar() {
    const sidebarNav = document.getElementById('sidebar-nav');
    const sidebarTitle = document.querySelector('.sidebar-title');
    if (sidebarTitle) {
        sidebarTitle.textContent = 'Site Navigation';
    }
    if (!sidebarNav) {
        return;
    }
    sidebarNav.innerHTML = '';

    SITE_PAGES.forEach(sitePage => {
        const articleContainer = document.createElement('div');
        articleContainer.className = 'nav-article';
        const pageButton = document.createElement('button');
        pageButton.className = 'nav-article-btn';
        pageButton.innerHTML = `${sitePage.icon} ${sitePage.label}`;
        pageButton.addEventListener('click', () => {
            navigate(sitePage.href);
            if (window.innerWidth < MOBILE_BREAKPOINT_WIDTH) {
                closeSidebar();
            }
        });
        const buttonRow = document.createElement('div');
        buttonRow.className = 'nav-article-row';
        buttonRow.appendChild(pageButton);
        articleContainer.appendChild(buttonRow);
        sidebarNav.appendChild(articleContainer);
    });
}

// Highlights the header link whose data-page matches "pageName".
function updateActiveNav(pageName) {
    document.querySelectorAll('.nav-link').forEach(navLink => {
        navLink.classList.toggle('active', navLink.dataset.page === pageName);
    });
}

/* ─── Sections Data ─── */

/**
 * Loads the list of sections for a document from the API (or from the
 * in-memory cache if it was already loaded) and rebuilds the sidebar.
 * Pass { force: true } to ignore the cache and always ask the server.
 */
async function loadSections(documentKey = 'charter', { force = false } = {}) {
    if (!force && documentSectionsCache[documentKey]) {
        sections = documentSectionsCache[documentKey];
        buildSidebar();
        if (documentKey === 'charter') {
            buildArticleCards();
        }
        return;
    }
    try {
        const documentConfig = DOCUMENT_CONFIG[documentKey];
        const apiResponse = await apiFetch(documentConfig.apiSections);
        if (apiResponse.ok) {
            documentSectionsCache[documentKey] = apiResponse.sections || [];
            sections = documentSectionsCache[documentKey];
            buildSidebar();
            if (documentKey === 'charter') {
                await buildArticleCards();
            }
        }
    } catch (loadError) {
        console.error('Failed to load sections for', documentKey, loadError);
    }
}

// Sorts two section rows by their order_index, smallest first.
function compareByOrderIndex(firstSection, secondSection) {
    return firstSection.order_index - secondSection.order_index;
}

// Top-level navigable pages: articles, standalone pages, schedules (not subsections)
function topLevelPages() {
    return sections
        .filter(section => section.type !== 'subsection')
        .sort(compareByOrderIndex);
}

// Subsections belonging to an article
function subsectionsOf(articleId) {
    return sections
        .filter(section => section.parent_id === articleId && section.type === 'subsection')
        .sort(compareByOrderIndex);
}

/* ─── Sidebar ─── */

// Returns the small "1.2" style number badge shown before a title, or an
// empty string when the section has no number.
function buildNumberBadgeHtml(section) {
    if (section.number) {
        return `<span class="nav-number">${section.number}</span> `;
    }
    return '';
}

/**
 * Rebuilds the sidebar for the current document: one entry per top-level
 * page, with an expandable list of subsections when the page has any.
 */
function buildSidebar() {
    const sidebarNav = document.getElementById('sidebar-nav');
    const sidebarTitle = document.querySelector('.sidebar-title');
    if (sidebarTitle) {
        sidebarTitle.textContent = DOCUMENT_CONFIG[currentDocumentKey].sidebarTitle;
    }

    sidebarNav.innerHTML = '';
    if (!sections.length) {
        sidebarNav.innerHTML = '<div class="sidebar-loading">No sections found.</div>';
    }

    const urlBase = DOCUMENT_CONFIG[currentDocumentKey].urlBase;
    const pages = topLevelPages();
    pages.forEach(page => {
        const childSections = subsectionsOf(page.id);
        const articleContainer = document.createElement('div');
        articleContainer.className = 'nav-article';
        articleContainer.dataset.id = page.id;
        articleContainer.dataset.slug = page.slug;

        if (childSections.length) {
            const subsectionButtonsHtml = childSections.map(childSection => `
            <button class="nav-sub-btn" data-slug="${page.slug}" data-anchor="${childSection.anchor || ''}">
              ${childSection.title}
            </button>`).join('');

            articleContainer.innerHTML = `
        <div class="nav-article-row">
          <button class="nav-article-btn" data-slug="${page.slug}">
            ${buildNumberBadgeHtml(page)}${page.title}
          </button>
          <button class="nav-chevron-btn" aria-label="Toggle subsections">
            <svg class="nav-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="nav-subsections" style="display:none">
          ${subsectionButtonsHtml}
        </div>`;

            articleContainer.querySelector('.nav-article-btn').addEventListener('click', () => {
                navigate(`${urlBase}/${page.slug}`);
                if (window.innerWidth < MOBILE_BREAKPOINT_WIDTH) {
                    closeSidebar();
                }
            });
            articleContainer.querySelector('.nav-chevron-btn').addEventListener('click', () => {
                const subsectionList = articleContainer.querySelector('.nav-subsections');
                const isOpen = subsectionList.style.display !== 'none';
                if (isOpen) {
                    subsectionList.style.display = 'none';
                } else {
                    subsectionList.style.display = 'block';
                }
                articleContainer.classList.toggle('expanded', !isOpen);
            });
            articleContainer.querySelectorAll('.nav-sub-btn').forEach(subsectionButton => {
                subsectionButton.addEventListener('click', () => {
                    const slug = subsectionButton.dataset.slug;
                    const anchor = subsectionButton.dataset.anchor;
                    let targetPath = `${urlBase}/${slug}`;
                    if (anchor) {
                        targetPath = targetPath + '#' + anchor;
                    }
                    navigate(targetPath);
                    if (window.innerWidth < MOBILE_BREAKPOINT_WIDTH) {
                        closeSidebar();
                    }
                });
            });
        } else {
            articleContainer.innerHTML = `
        <div class="nav-article-row">
          <button class="nav-article-btn" data-slug="${page.slug}">
            ${buildNumberBadgeHtml(page)}${page.title}
          </button>
        </div>`;
            articleContainer.querySelector('.nav-article-btn').addEventListener('click', () => {
                navigate(`${urlBase}/${page.slug}`);
                if (window.innerWidth < MOBILE_BREAKPOINT_WIDTH) {
                    closeSidebar();
                }
            });
        }
        sidebarNav.appendChild(articleContainer);
    });

    if (currentUser && currentUser.is_admin) {
        const addSectionButton = document.createElement('button');
        addSectionButton.className = 'btn btn-sm btn-ghost sidebar-add-btn';
        addSectionButton.textContent = '+ Add Section';
        addSectionButton.addEventListener('click', () => openAddSectionModal(null));
        sidebarNav.appendChild(addSectionButton);
    }

    sidebarNav.appendChild(buildSiteNavSection());
}

const SITE_PAGES = [
    { label: 'Charter', href: '/the-charter', icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" stroke-width="2"/><polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2"/></svg>` },
    { label: 'News Standards', href: '/news', icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
    { label: 'Programme Rating System', href: '/prs', icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="23 7 16 12 23 17 23 7" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><rect x="1" y="5" width="15" height="14" rx="2" stroke="currentColor" stroke-width="2"/></svg>` },
    { label: 'Community Rules', href: '/rules', icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>` },
    { label: 'Join Us', href: '/join-us', icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/></svg>` },
    { label: 'About PolicySpot', href: '/about', icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>` },
];

// Builds the collapsible "Site Navigation" block shown at the bottom of a
// document's sidebar, listing every main page of the site.
function buildSiteNavSection() {
    const wrapper = document.createElement('div');
    wrapper.className = 'site-nav-section';

    const headerButton = document.createElement('button');
    headerButton.className = 'site-nav-header';
    headerButton.setAttribute('aria-expanded', 'false');
    headerButton.innerHTML = `
        <span>Site Navigation</span>
        <svg class="nav-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>`;

    const linkList = document.createElement('div');
    linkList.className = 'site-nav-list';
    linkList.hidden = true;

    let currentHref = undefined;
    if (DOCUMENT_CONFIG[currentDocumentKey]) {
        currentHref = DOCUMENT_CONFIG[currentDocumentKey].urlBase;
    }
    SITE_PAGES.forEach(sitePage => {
        const linkButton = document.createElement('button');
        linkButton.className = 'nav-sub-btn site-nav-link';
        if (sitePage.href === currentHref) {
            linkButton.className = linkButton.className + ' active';
        }
        linkButton.innerHTML = `${sitePage.icon} ${sitePage.label}`;
        linkButton.addEventListener('click', () => {
            navigate(sitePage.href);
            if (window.innerWidth < MOBILE_BREAKPOINT_WIDTH) {
                closeSidebar();
            }
        });
        linkList.appendChild(linkButton);
    });

    headerButton.addEventListener('click', () => {
        const isOpen = !linkList.hidden;
        linkList.hidden = isOpen;
        headerButton.setAttribute('aria-expanded', String(!isOpen));
        const chevron = headerButton.querySelector('.nav-chevron');
        if (isOpen) {
            chevron.style.transform = '';
        } else {
            chevron.style.transform = 'rotate(90deg)';
        }
    });

    wrapper.appendChild(headerButton);
    wrapper.appendChild(linkList);
    return wrapper;
}

/* ─── Shared helpers for article cards ─── */

// True when the given user is allowed to see editor-only details.
function isAdminOrEditor(user) {
    if (!user) {
        return false;
    }
    return Boolean(user.is_admin || user.is_editor);
}

// Asks the API how many times each section of a document has been viewed.
// Returns an object of { sectionId: viewCount }, or an empty object on failure.
async function fetchViewCounts(documentKey) {
    let viewCounts = {};
    try {
        const apiResponse = await apiFetch(`/api/policy/section-views?doc=${documentKey}`);
        if (apiResponse.ok) {
            viewCounts = apiResponse.views || {};
        }
    } catch (fetchError) {
        // view counts are optional, carry on without them
    }
    return viewCounts;
}

/**
 * Adds a "totalViews" number to every page (its own views plus the views of
 * all of its subsections). When at least one page has views, the list is
 * sorted with the most viewed first; otherwise the original order is kept.
 */
function addViewTotalsAndSort(pages, viewCounts) {
    const pagesWithViews = pages.map(page => {
        const childSections = subsectionsOf(page.id);
        const allSectionIds = [page.id];
        childSections.forEach(childSection => allSectionIds.push(childSection.id));
        let totalViews = 0;
        allSectionIds.forEach(sectionId => {
            totalViews = totalViews + (viewCounts[sectionId] || 0);
        });
        return { ...page, totalViews: totalViews };
    });

    const hasAnyViews = pagesWithViews.some(page => page.totalViews > 0);
    if (hasAnyViews) {
        pagesWithViews.sort((firstPage, secondPage) => {
            if (secondPage.totalViews !== firstPage.totalViews) {
                return secondPage.totalViews - firstPage.totalViews;
            }
            return firstPage.order_index - secondPage.order_index;
        });
    }
    return pagesWithViews;
}

// Returns "1 view" / "25 views" HTML, or an empty string when there are no views.
function buildViewCountHtml(totalViews) {
    if (totalViews <= 0) {
        return '';
    }
    let viewWord = 'views';
    if (totalViews === 1) {
        viewWord = 'view';
    }
    return `<div class="card-views">${Number(totalViews).toLocaleString()} ${viewWord}</div>`;
}

// Returns the card number HTML, or an empty string when the page has no number.
function buildCardNumberHtml(page) {
    if (page.number) {
        return `<div class="card-num">${page.number}</div>`;
    }
    return '';
}

// Makes every ".article-card" inside "container" open its page on click or Enter.
function attachArticleCardHandlers(container, getTargetPath) {
    container.querySelectorAll('.article-card').forEach(card => {
        const openCard = () => navigate(getTargetPath(card));
        card.addEventListener('click', openCard);
        card.addEventListener('keydown', keyboardEvent => {
            if (keyboardEvent.key === 'Enter') {
                openCard();
            }
        });
    });
}

// Fills the "Most Viewed Pages" cards on the Charter home page.
async function buildArticleCards() {
    const cardGrid = document.getElementById('article-cards');
    if (!cardGrid) {
        return;
    }
    const pages = topLevelPages();
    if (!pages.length) {
        return;
    }
    const urlBase = DOCUMENT_CONFIG['charter'].urlBase;

    const viewCounts = await fetchViewCounts('charter');
    const pagesWithViews = addViewTotalsAndSort(pages, viewCounts);

    cardGrid.innerHTML = pagesWithViews.map(page => `
    <div class="glass-card article-card" data-slug="${page.slug}" tabindex="0" role="button">
      ${buildCardNumberHtml(page)}
      <div class="card-title">${page.title}</div>
      ${buildViewCountHtml(page.totalViews)}
    </div>`).join('');
    attachArticleCardHandlers(cardGrid, card => `${urlBase}/${card.dataset.slug}`);
}

/* ─── Document Index (charter index generalised for all documents) ─── */

/**
 * Shows the landing page of the current document: a hero banner (or a simple
 * heading), the "Most Viewed Pages" cards and a table of contents.
 * The Charter has its own index already written in index.html.
 */
async function renderDocumentIndex() {
    const documentConfig = DOCUMENT_CONFIG[currentDocumentKey];
    updateBreadcrumb(null);
    updateDocNavFooter(null);
    updateSidebarActive(null, null);

    if (currentDocumentKey === 'charter') {
        const indexView = document.getElementById('charter-index-view');
        const articleView = document.getElementById('charter-article-view');
        if (indexView) {
            indexView.style.display = '';
        }
        if (articleView) {
            articleView.style.display = 'none';
        }
        await buildArticleCards();
        return;
    }

    const contentElement = document.getElementById(documentConfig.contentElementId);
    if (!contentElement) {
        return;
    }
    const urlBase = documentConfig.urlBase;
    const pages = topLevelPages();
    const firstPage = pages[0];

    // Top of the page: either the document's hero banner or a plain heading
    let topOfPageHtml = '';
    if (documentConfig.hero) {
        let startReadingButtonHtml = '';
        if (firstPage) {
            startReadingButtonHtml = `<a href="${documentConfig.urlBase}/${firstPage.slug}" class="btn btn-ghost" data-navlink>Start Reading</a>`;
        }
        topOfPageHtml = `
    <section class="hero glass-card">
        <div class="hero-body">
            <div class="hero-badge">${documentConfig.hero.badge}</div>
            <h1 class="hero-title">${documentConfig.hero.title}</h1>
            <p class="hero-sub">${documentConfig.hero.subtitle}</p>
            <div class="hero-actions">
                <a href="${documentConfig.urlBase}" class="btn btn-primary" data-navlink>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" stroke-width="2"/>
                        <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2"/></svg>
                    Read the Document
                </a>
                ${startReadingButtonHtml}
            </div>
        </div>
        <div class="hero-graphic">
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="10" width="100" height="100" rx="16" fill="var(--brand)" opacity="0.15"/>
                <rect x="24" y="24" width="72" height="72" rx="10" fill="var(--brand)" opacity="0.25"/>
                <line x1="36" y1="46" x2="84" y2="46" stroke="var(--brand)" stroke-width="3" stroke-linecap="round"/>
                <line x1="36" y1="60" x2="84" y2="60" stroke="var(--brand)" stroke-width="3" stroke-linecap="round"/>
                <line x1="36" y1="74" x2="66" y2="74" stroke="var(--brand)" stroke-width="3" stroke-linecap="round"/>
            </svg>
        </div>
    </section>`;
    } else {
        let documentBadgeHtml = '';
        if (isAdminOrEditor(currentUser)) {
            documentBadgeHtml = '<div class="section-type-badge">Document</div>';
        }
        topOfPageHtml = `<div class="section-content-inner"><div class="section-header">
        ${documentBadgeHtml}
        <h1 class="section-heading">${documentConfig.label}</h1>
      </div></div>`;
    }

    // Table of contents: one card per page, listing its subsections underneath
    const tableOfContentsHtml = pages.map(page => {
        const childSections = subsectionsOf(page.id);
        let numberHtml = '';
        if (page.number) {
            numberHtml = `<span class="card-num">${page.number} — </span>`;
        }
        let subsectionListHtml = '';
        if (childSections.length) {
            const subsectionItemsHtml = childSections
                .map(childSection => `<span class="toc-sub-item">${childSection.title}</span>`)
                .join('');
            subsectionListHtml = `<div class="toc-card-subs">${subsectionItemsHtml}</div>`;
        }
        return `
              <a href="${urlBase}/${page.slug}" class="toc-card-btn" data-href="${urlBase}/${page.slug}">
                <div class="toc-card-title">${numberHtml}${page.title}</div>
                ${subsectionListHtml}
              </a>`;
    }).join('');

    contentElement.innerHTML = `
      ${topOfPageHtml}
      <section class="section-grid">
        <h2 class="section-title">Most Viewed Pages</h2>
        <div class="card-grid" id="doc-index-cards">
          ${pages.map(() => '<div class="glass-card article-card skeleton"></div>').join('')}
        </div>
      </section>
      <div class="section-body">
        <h2>Table of Contents</h2>
        <div class="toc-card-list">
          ${tableOfContentsHtml}
        </div>
      </div>`;

    contentElement.querySelectorAll('.toc-card-btn').forEach(tableOfContentsLink => {
        tableOfContentsLink.addEventListener('click', clickEvent => {
            clickEvent.preventDefault();
            navigate(tableOfContentsLink.dataset.href);
        });
    });

    const viewCounts = await fetchViewCounts(currentDocumentKey);
    const pagesWithViews = addViewTotalsAndSort(pages, viewCounts);

    const cardGrid = contentElement.querySelector('#doc-index-cards');
    if (cardGrid) {
        cardGrid.innerHTML = pagesWithViews.map(page => `
            <div class="glass-card article-card" data-href="${urlBase}/${page.slug}" tabindex="0" role="button">
              ${buildCardNumberHtml(page)}
              <div class="card-title">${page.title}</div>
              ${buildViewCountHtml(page.totalViews)}
            </div>`).join('');
        attachArticleCardHandlers(cardGrid, card => card.dataset.href);
    }
}

/* ─── Page Loading ─── */

/**
 * Loads and displays one page of the current document by its slug.
 * Uses the cached section list when possible and falls back to asking the
 * API for that single section. When "anchor" is given, the page scrolls to
 * the subsection with that id after rendering.
 */
async function loadPage(slug, anchor) {
    const documentConfig = DOCUMENT_CONFIG[currentDocumentKey];

    if (currentDocumentKey === 'charter') {
        const indexView = document.getElementById('charter-index-view');
        const articleView = document.getElementById('charter-article-view');
        if (indexView) {
            indexView.style.display = 'none';
        }
        if (articleView) {
            articleView.style.display = '';
        }
    }

    const contentElement = document.getElementById(documentConfig.contentElementId);
    if (!contentElement) {
        return;
    }
    contentElement.innerHTML = '<div class="section-loading"><span class="spinner large"></span><p>Loading...</p></div>';
    updateBreadcrumb(null);
    updateDocNavFooter(null);

    let section = sections.find(candidate => candidate.slug === slug && candidate.type !== 'subsection');

    if (!section) {
        try {
            const apiResponse = await apiFetch(`${documentConfig.apiSection}?slug=${encodeURIComponent(slug)}`);
            if (!apiResponse.ok) {
                throw new Error(apiResponse.error || 'Not found');
            }
            section = apiResponse.section;
            if (section.type === 'article' || section.type === 'page') {
                const allSectionsResponse = await apiFetch(documentConfig.apiSections);
                if (allSectionsResponse.ok) {
                    documentSectionsCache[currentDocumentKey] = allSectionsResponse.sections;
                    sections = documentSectionsCache[currentDocumentKey];
                }
            }
        } catch (loadError) {
            contentElement.innerHTML = `<div class="section-content-inner">
        <h1 class="section-heading">Not Found</h1>
        <p>The section <code>${slug}</code> could not be loaded.</p>
        <a href="${documentConfig.urlBase}" style="color:var(--brand-dark)">Back to ${documentConfig.label}</a>
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
            const anchorElement = document.getElementById(anchor);
            if (anchorElement) {
                anchorElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 80);
    } else {
        window.scrollTo(0, 0);
    }
}

// Returns "1.2 — " when the section has a number, otherwise an empty string.
function buildHeadingNumberPrefix(section) {
    if (section.number) {
        return `${section.number} — `;
    }
    return '';
}

/**
 * Builds the shared header shown at the top of an article or standalone page:
 * a type badge and edit buttons for signed-in staff, then the page heading.
 */
function buildSectionHeaderHtml(section, typeLabel, urlBase, canEditSlug, canEditContent) {
    let typeBadgeHtml = '';
    if (isAdminOrEditor(currentUser)) {
        typeBadgeHtml = `<div class="section-type-badge">${typeLabel}</div>`;
    }
    let slugDisplayHtml = '';
    if (currentUser) {
        slugDisplayHtml = `<span class="section-slug-display">${urlBase}/${section.slug}</span>`;
    }
    let editSlugButtonHtml = '';
    if (canEditSlug) {
        editSlugButtonHtml = `<button class="edit-slug-btn" data-id="${section.id}" data-slug="${section.slug}">Edit slug</button>`;
    }
    let editContentButtonHtml = '';
    if (canEditContent) {
        editContentButtonHtml = `<button class="edit-content-btn" data-id="${section.id}">Edit</button>`;
    }
    return `
      <div class="section-header">
        ${typeBadgeHtml}
        <div class="section-meta">
          ${slugDisplayHtml}
          ${editSlugButtonHtml}
          ${editContentButtonHtml}
        </div>
        <h1 class="section-heading">${buildHeadingNumberPrefix(section)}${section.title}</h1>
      </div>`;
}

/* Renders an article page: intro block + all subsections inline with anchor ids */
function renderArticlePage(article, activeAnchor) {
    const documentConfig = DOCUMENT_CONFIG[currentDocumentKey];
    const contentElement = document.getElementById(documentConfig.contentElementId);
    if (!contentElement) {
        return;
    }
    const childSections = subsectionsOf(article.id);
    const canEditSlug = currentDocumentKey === 'charter' && isAdminOrEditor(currentUser);
    const canEditContent = Boolean(currentUser && currentUser.is_admin);
    const urlBase = documentConfig.urlBase;

    let html = `<div class="section-content-inner">`;
    html += buildSectionHeaderHtml(article, 'Article', urlBase, canEditSlug, canEditContent);

    if (article.content) {
        html += `<div class="section-body article-intro">${renderMarkdown(article.content)}</div>`;
    }

    childSections.forEach(childSection => {
        const subsectionAnchor = childSection.anchor || childSection.slug;
        let subsectionNumberHtml = '';
        if (childSection.number) {
            subsectionNumberHtml = `<span class="subsection-num">${childSection.number}</span>`;
        }
        let editButtonHtml = '';
        if (canEditContent) {
            editButtonHtml = `<button class="edit-content-btn" data-id="${childSection.id}">Edit</button>`;
        }
        html += `
      <div class="subsection-block" id="${subsectionAnchor}">
        <div class="subsection-header">
          <h2 class="subsection-heading">
            <a class="anchor-link" href="${urlBase}/${article.slug}#${subsectionAnchor}" aria-label="Link to section">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </a>
            ${childSection.title}
          </h2>
          ${subsectionNumberHtml}
          ${editButtonHtml}
        </div>
        <div class="section-body subsection-body">${renderMarkdown(childSection.content || '')}</div>
      </div>`;
    });

    if (canEditContent) {
        html += `<button class="btn btn-sm btn-ghost add-subsection-btn" data-parent-id="${article.id}">+ Add Subsection</button>`;
    }

    html += `</div>`;
    contentElement.innerHTML = html;
    initBlobMedia(contentElement);

    if (canEditSlug) {
        contentElement.querySelectorAll('.edit-slug-btn').forEach(editSlugButton => {
            const sectionToEdit = sections.find(candidate => candidate.id === editSlugButton.dataset.id) || article;
            editSlugButton.addEventListener('click', () => openSlugModal(sectionToEdit));
        });
    }

    if (canEditContent) {
        contentElement.querySelectorAll('.edit-content-btn').forEach(editContentButton => {
            const sectionToEdit = sections.find(candidate => candidate.id === editContentButton.dataset.id) || article;
            editContentButton.addEventListener('click', () => openContentModal(sectionToEdit));
        });
        const addSubsectionButton = contentElement.querySelector('.add-subsection-btn');
        if (addSubsectionButton) {
            addSubsectionButton.addEventListener('click', () => openAddSectionModal(article));
        }
    }

    contentElement.querySelectorAll('.anchor-link').forEach(anchorLink => {
        anchorLink.addEventListener('click', clickEvent => {
            clickEvent.preventDefault();
            history.replaceState({}, '', anchorLink.getAttribute('href'));
        });
    });
}

/* Renders a standalone page (Citation, Definitions, First Schedule, etc.) */
function renderStandalonePage(section) {
    const documentConfig = DOCUMENT_CONFIG[currentDocumentKey];
    const contentElement = document.getElementById(documentConfig.contentElementId);
    if (!contentElement) {
        return;
    }
    const canEditSlug = currentDocumentKey === 'charter' && isAdminOrEditor(currentUser);
    const canEditContent = Boolean(currentUser && currentUser.is_admin);
    let typeLabel = 'Section';
    if (section.type === 'schedule') {
        typeLabel = 'Schedule';
    }
    const urlBase = documentConfig.urlBase;

    contentElement.innerHTML = `
    <div class="section-content-inner">
      ${buildSectionHeaderHtml(section, typeLabel, urlBase, canEditSlug, canEditContent)}
      <div class="section-body" id="section-body-content">${renderMarkdown(section.content || '')}</div>
    </div>`;
    initBlobMedia(contentElement);

    if (canEditSlug) {
        const editSlugButton = contentElement.querySelector('.edit-slug-btn');
        if (editSlugButton) {
            editSlugButton.addEventListener('click', () => openSlugModal(section));
        }
    }
    if (canEditContent) {
        const editContentButton = contentElement.querySelector('.edit-content-btn');
        if (editContentButton) {
            editContentButton.addEventListener('click', () => openContentModal(section));
        }
    }
}

/* ─── Markdown Renderer ─── */

// Replaces &, < and > with their HTML entity codes so text cannot inject HTML.
function escapeHtmlCharacters(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Builds an <iframe> for an embedded web page. Google Docs, Sheets and
 * Slides links are rewritten to their "preview" or "embed" addresses so they
 * display inside the page instead of opening the editor.
 */
function buildIframeEmbedHtml(url) {
    if (url.includes('docs.google.com/document/')) {
        const previewUrl = url.replace(/\/(edit|view)[^/]*$/, '/preview');
        return `<iframe class="section-embed section-embed-gdoc" src="${previewUrl}" loading="lazy" allowfullscreen></iframe>`;
    }
    if (url.includes('docs.google.com/spreadsheets/')) {
        const previewUrl = url.replace(/\/(edit|view)[^/]*$/, '/preview');
        return `<iframe class="section-embed section-embed-gsheet" src="${previewUrl}" loading="lazy" allowfullscreen></iframe>`;
    }
    if (url.includes('docs.google.com/presentation/')) {
        const embedUrl = url.replace(/\/(edit|view|pub)[^/]*$/, '/embed');
        return `<iframe class="section-embed section-embed-gslide" src="${embedUrl}" loading="lazy" allowfullscreen></iframe>`;
    }
    return `<iframe class="section-embed" src="${url}" loading="lazy" allowfullscreen></iframe>`;
}

// Builds the download/open card shown for an attached document such as a PDF.
function buildDocumentCardHtml(fileUrl, altText) {
    const filename = altText || fileUrl.split('/').pop();
    const fileExtension = filename.split('.').pop().toUpperCase();
    return `<div class="doc-card">
              <div class="doc-card-icon">
                <svg width="28" height="34" viewBox="0 0 28 34" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 0h14l11 10v21a3 3 0 01-3 3H3a3 3 0 01-3-3V3a3 3 0 013-3z" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
                  <path d="M17 0l11 10H20a3 3 0 01-3-3V0z" fill="var(--border-hover, var(--border))"/>
                  <line x1="6" y1="16" x2="22" y2="16" stroke="var(--border)" stroke-width="1.5" stroke-linecap="round"/>
                  <line x1="6" y1="21" x2="22" y2="21" stroke="var(--border)" stroke-width="1.5" stroke-linecap="round"/>
                  <line x1="6" y1="26" x2="15" y2="26" stroke="var(--border)" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <span class="doc-card-ext">${fileExtension}</span>
              </div>
              <div class="doc-card-info">
                <span class="doc-card-name">${filename}</span>
                <span class="doc-card-type">${fileExtension}</span>
              </div>
              <div class="doc-card-actions">
                <button class="btn btn-sm btn-ghost doc-card-btn" onclick="downloadAsBlob('${fileUrl}','${filename}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</button>
                <button class="btn btn-sm btn-ghost doc-card-btn" onclick="openAsBlob('${fileUrl}','${filename}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Open</button>
              </div>
            </div>`;
}

/**
 * Converts the site's Markdown dialect into HTML.
 *
 * Supported syntax, in the order it is processed:
 *   +++ Title ... +++          collapsible block
 *   | a | b |                  tables (a few safe HTML tags allowed in cells)
 *   #, ##, ###                 headings
 *   ---                        horizontal rule
 *   > text                     block quote
 *   {{embed: url}}             embedded audio, PDF, Google file or web page
 *   ![alt]{type}(url)          image / doc / audio / embed
 *   **bold**, *italic*, __underline__, _italic_
 *   [text](url)                links
 *   `code`                     inline code
 *   - item                     bullet lists (2 spaces = 1 nesting level)
 *   1. / 2.1. / (a)            numbered outline lists
 *
 * Finished blocks of HTML are "stashed" (swapped for a placeholder token)
 * so that later steps, such as bold or italic, cannot change them. The
 * placeholders are swapped back for the real HTML at the very end.
 */
function renderMarkdown(markdownText) {
    // Stash is declared first so collapsible blocks (which need recursive
    // renderMarkdown calls on raw content) can be extracted before HTML escaping.
    const stashedBlocks = [];
    const stashHtml = blockHtml => {
        const placeholderToken = `\x02${stashedBlocks.length}\x02`;
        stashedBlocks.push(blockHtml);
        return placeholderToken;
    };

    // Collapsible sections: +++ Title\ncontent\n+++
    markdownText = markdownText.replace(/^\+\+\+ (.+)\n([\s\S]*?)^\+\+\+[ \t]*$/gm, (fullMatch, title, innerContent) => {
        const safeTitle = escapeHtmlCharacters(title.trim());
        return stashHtml(`<details class="md-collapse">
          <summary class="md-collapse-summary"><span class="md-collapse-title">${safeTitle}</span></summary>
          <div class="md-collapse-body">${renderMarkdown(innerContent.trim())}</div>
        </details>`);
    });

    let html = escapeHtmlCharacters(markdownText);

    // Tables
    const allowedCellTags = new Set(['p','ul','ol','li','mark','strong','em','b','i','u','br','a','code','span','div','h1','h2','h3','h4','h5','h6']);
    // Inside table cells, a short list of harmless HTML tags is allowed through
    const unescapeCell = cellText => cellText.replace(/&lt;(\/?\w+.*?)&gt;/g, (fullMatch, innerTag) => {
        const tagNameMatch = innerTag.match(/^\/?([\w]+)/);
        let tagName = '';
        if (tagNameMatch && tagNameMatch[1]) {
            tagName = tagNameMatch[1].toLowerCase();
        }
        if (allowedCellTags.has(tagName)) {
            return `<${innerTag}>`;
        }
        return fullMatch;
    });
    html = html.replace(/^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)+)/gm, (fullMatch, headerRow, bodyRows) => {
        const headerCellsHtml = headerRow
            .split('|')
            .filter(cell => cell.trim())
            .map(cell => `<th>${unescapeCell(cell.trim())}</th>`)
            .join('');
        const bodyRowsHtml = bodyRows.trim().split('\n').map(row => {
            const rowCellsHtml = row
                .split('|')
                .filter(cell => cell.trim())
                .map(cell => `<td>${unescapeCell(cell.trim())}</td>`)
                .join('');
            return `<tr>${rowCellsHtml}</tr>`;
        }).join('');
        return `<table><thead><tr>${headerCellsHtml}</tr></thead><tbody>${bodyRowsHtml}</tbody></table>\n`;
    });
    // Headings
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    // Horizontal rule
    html = html.replace(/^---$/gm, '<hr/>');
    // Blockquote
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

    // Embeds: {{embed: url}}
    html = html.replace(/\{\{embed:\s*(https?:\/\/[^}]+)\}\}/g, (fullMatch, rawUrl) => {
        const url = rawUrl.trim();
        if (/\.(mp3|aac|m4a|ogg|wav)(\?.*)?$/i.test(url)) {
            return stashHtml(`<audio class="section-audio" controls data-blob-src="${url}"></audio>`);
        }
        if (/\.pdf(\?.*)?$/i.test(url)) {
            return stashHtml(`<iframe class="section-embed section-embed-pdf" src="${url}" loading="lazy"></iframe>`);
        }
        return stashHtml(buildIframeEmbedHtml(url));
    });
    // Media: ![alt]{type}(url) — type is img|doc|audio|embed (optional, defaults to img)
    html = html.replace(/!\[([^\]]*)\](?:\{(img|doc|audio|embed)\})?\((https?:\/\/[^)]+)\)/g, (fullMatch, altText, mediaType, sourceUrl) => {
        mediaType = mediaType || 'img';
        if (mediaType === 'img') {
            if (altText) {
                return stashHtml(`<figure class="section-img-figure"><img class="section-img" src="${sourceUrl}" alt="${altText}"><figcaption class="section-img-caption">${altText}</figcaption></figure>`);
            }
            return stashHtml(`<img class="section-img" src="${sourceUrl}" alt="">`);
        }
        if (mediaType === 'audio') {
            return stashHtml(`<audio class="section-audio" controls data-blob-src="${sourceUrl}"></audio>`);
        }
        if (mediaType === 'doc') {
            return stashHtml(buildDocumentCardHtml(sourceUrl, altText));
        }
        if (mediaType === 'embed') {
            return stashHtml(buildIframeEmbedHtml(sourceUrl));
        }
    });

    // Bold / italic / underline — runs after stashing, so media HTML is never touched
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/__(.+?)__/g, '<u>$1</u>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    // Links (web links open in a new tab, mailto links do not)
    html = html.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)]+)\)/g, (fullMatch, linkText, linkHref) => {
        let newTabAttributes = '';
        if (linkHref.startsWith('http')) {
            newTabAttributes = ' target="_blank" rel="noopener noreferrer"';
        }
        return `<a href="${linkHref}"${newTabAttributes}>${linkText}</a>`;
    });
    // Inline code
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    // Unordered lists — supports nesting via leading spaces (2 spaces = 1 level)
    html = html.replace(/((?:^[ ]*- .+\n?)+)/gm, listBlock => {
        const listLines = listBlock.trimEnd().split('\n').filter(line => /^\s*- /.test(line));
        let output = '';
        const openIndentStack = []; // stack of indent depths, one entry per open <ul>
        for (const line of listLines) {
            const lineMatch = line.match(/^(\s*)- (.*)$/);
            if (!lineMatch) {
                continue;
            }
            const indentWidth = lineMatch[1].length;
            const itemText = lineMatch[2];
            const currentIndent = openIndentStack[openIndentStack.length - 1];
            if (openIndentStack.length === 0) {
                // First item: open the outermost list
                output += '<ul>';
                openIndentStack.push(indentWidth);
                output += `<li>${itemText}`;
            } else if (indentWidth > currentIndent) {
                // Deeper indent: open a nested list inside the current item
                output += `<ul><li>${itemText}`;
                openIndentStack.push(indentWidth);
            } else if (indentWidth === currentIndent) {
                // Same indent: close the previous item and start a sibling
                output += `</li><li>${itemText}`;
            } else {
                // Shallower indent: close nested lists until the levels match
                output += '</li>';
                while (openIndentStack.length > 0 && openIndentStack[openIndentStack.length - 1] > indentWidth) {
                    output += '</ul>';
                    openIndentStack.pop();
                    if (openIndentStack.length > 0) {
                        output += '</li>';
                    }
                }
                output += `<li>${itemText}`;
            }
        }
        output += '</li>';
        while (openIndentStack.length > 0) {
            output += '</ul>';
            openIndentStack.pop();
        }
        return output;
    });
    // Ordered / decimal-outline lists (1., 2.1., 2.1.1., etc.) with optional (a)/(b) sub-items
    html = html.replace(/((?:^(?:(?:\d+\.)+[ \t].+|\([a-zA-Z]\)[ \t].+)\n?)+)/gm, listBlock => {
        let currentDepth = 0;
        const listItemsHtml = listBlock.trim().split('\n').map(line => {
            const decimalMatch = line.match(/^((?:\d+\.)+)[ \t](.+)$/);
            if (decimalMatch) {
                const numberPart = decimalMatch[1];
                // "2.1." has two dots, so it sits one level deeper than "2."
                const dotMatches = numberPart.match(/\./g) || [];
                currentDepth = dotMatches.length - 1;
                return `<li class="ol-depth-${currentDepth}"><strong>${numberPart}</strong> ${decimalMatch[2]}</li>`;
            }
            const letterMatch = line.match(/^(\([a-zA-Z]\))[ \t](.+)$/);
            if (letterMatch) {
                return `<li class="ol-depth-${currentDepth + 1}">${letterMatch[1]} ${letterMatch[2]}</li>`;
            }
            return '';
        }).filter(Boolean).join('');
        return `<ol class="decimal-list">${listItemsHtml}</ol>`;
    });
    // Paragraphs — stash tokens that stand alone are treated as block-level
    html = html.split(/\n\n+/).map(paragraph => {
        const trimmedParagraph = paragraph.trim();
        if (!trimmedParagraph) {
            return '';
        }
        if (/^<(h[1-6]|ul|ol|table|blockquote|hr)/.test(trimmedParagraph)) {
            return trimmedParagraph;
        }
        if (/^\x02\d+\x02$/.test(trimmedParagraph)) {
            return trimmedParagraph;
        }
        return `<p>${trimmedParagraph.replace(/\n/g, '<br/>')}</p>`;
    }).join('\n');

    // Restore stashed blocks
    stashedBlocks.forEach((blockHtml, blockIndex) => {
        html = html.replace(`\x02${blockIndex}\x02`, () => blockHtml);
    });

    return html;
}

/* ─── Breadcrumb ─── */

// Fills the "Home > Document > Page" trail above the content.
function updateBreadcrumb(section) {
    const documentConfig = DOCUMENT_CONFIG[currentDocumentKey];
    const breadcrumbElement = document.getElementById(documentConfig.breadcrumbElementId);
    if (!breadcrumbElement) {
        return;
    }
    const separatorIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    let breadcrumbHtml = `<a href="/" class="bc-link">Home</a>${separatorIcon}<a href="${documentConfig.urlBase}" class="bc-link">${documentConfig.sidebarTitle}</a>`;
    if (section) {
        breadcrumbHtml += `${separatorIcon}<span>${section.title}</span>`;
    }
    breadcrumbElement.innerHTML = breadcrumbHtml;
    breadcrumbElement.querySelectorAll('.bc-link').forEach(breadcrumbLink => {
        breadcrumbLink.addEventListener('click', clickEvent => {
            clickEvent.preventDefault();
            navigate(breadcrumbLink.getAttribute('href'));
        });
    });
}

/* ─── Previous / Next Footer ─── */

/**
 * Fills the footer under a page with the "last updated" date, a view counter
 * placeholder (filled later by trackPageViews) and Previous / Next buttons.
 */
function updateDocNavFooter(section) {
    const documentConfig = DOCUMENT_CONFIG[currentDocumentKey];
    const footerElement = document.getElementById(documentConfig.navFooterElementId);
    if (!footerElement) {
        return;
    }
    if (!section) {
        footerElement.innerHTML = '';
        return;
    }

    // Most recent updated_at across the section and all its subsections
    const relatedSections = [section].concat(sections.filter(candidate => candidate.parent_id === section.id));
    const updateDates = relatedSections
        .map(relatedSection => relatedSection.updated_at)
        .filter(Boolean);
    let lastUpdatedText = null;
    if (updateDates.length) {
        let latestDateText = updateDates[0];
        updateDates.forEach(dateText => {
            if (dateText > latestDateText) {
                latestDateText = dateText;
            }
        });
        const latestDate = new Date(latestDateText);
        lastUpdatedText = latestDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    const urlBase = documentConfig.urlBase;
    const pages = topLevelPages();
    const pageIndex = pages.findIndex(page => page.id === section.id);
    let previousPage = null;
    if (pageIndex > 0) {
        previousPage = pages[pageIndex - 1];
    }
    let nextPage = null;
    if (pageIndex < pages.length - 1) {
        nextPage = pages[pageIndex + 1];
    }

    let lastUpdatedHtml = '';
    if (lastUpdatedText) {
        lastUpdatedHtml = `<span class="doc-last-updated">Last updated: ${lastUpdatedText}</span>`;
    }
    // An empty <span> keeps the "Next" button on the right when there is no previous page
    let previousButtonHtml = '<span></span>';
    if (previousPage) {
        previousButtonHtml = `<button class="doc-nav-btn" data-slug="${previousPage.slug}">
        <span class="doc-nav-label">← Previous</span>
        <span class="doc-nav-title">${buildHeadingNumberPrefix(previousPage)}${previousPage.title}</span>
      </button>`;
    }
    let nextButtonHtml = '';
    if (nextPage) {
        nextButtonHtml = `<button class="doc-nav-btn next" data-slug="${nextPage.slug}">
        <span class="doc-nav-label">Next →</span>
        <span class="doc-nav-title">${buildHeadingNumberPrefix(nextPage)}${nextPage.title}</span>
      </button>`;
    }

    footerElement.innerHTML = `
    <div class="doc-page-meta">
      ${lastUpdatedHtml}
      <span class="doc-views" id="doc-views-count">
        <svg class="doc-views-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <span class="doc-views-spinner"></span>
      </span>
    </div>
    <div class="doc-nav-buttons">
      ${previousButtonHtml}
      ${nextButtonHtml}
    </div>`;
    footerElement.querySelectorAll('.doc-nav-btn').forEach(navigationButton => {
        navigationButton.addEventListener('click', () => navigate(`${urlBase}/${navigationButton.dataset.slug}`));
    });
}

/* ─── Page Visit Tracking ─── */

// Guesses whether the reader is on a tablet, a phone or a desktop computer.
function detectDeviceType() {
    const userAgent = navigator.userAgent;
    const looksLikeTablet = /iPad|Tablet/i.test(userAgent) || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent));
    if (looksLikeTablet) {
        return 'Tablet';
    }
    if (/Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
        return 'Mobile';
    }
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
        return 'Mobile';
    }
    return 'Desktop';
}

/**
 * Records a visit to this page and shows the combined view count of the page
 * and its subsections in the footer.
 */
async function trackPageViews(section) {
    const viewCountElement = document.getElementById('doc-views-count');
    const childSections = sections.filter(candidate => candidate.parent_id === section.id);
    const allSectionIds = [section.id];
    childSections.forEach(childSection => allSectionIds.push(childSection.id));

    try {
        const apiResponse = await apiFetch('/api/policy/track-visit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                section_id:  section.id,
                doc:         currentDocumentKey,
                slug:        section.slug,
                device_type: detectDeviceType(),
                all_ids:     allSectionIds,
            }),
        });
        if (viewCountElement) {
            const loadingSpinner = viewCountElement.querySelector('.doc-views-spinner');
            if (loadingSpinner) {
                loadingSpinner.remove();
            }
            const viewCountLabel = viewCountElement.querySelector('.doc-views-label') || document.createElement('span');
            viewCountLabel.className = 'doc-views-label';
            // Zero is a valid total, so only a missing (null or undefined) total is skipped
            if (apiResponse.ok && apiResponse.total !== null && apiResponse.total !== undefined) {
                let viewWord = 'views';
                if (apiResponse.total === 1) {
                    viewWord = 'view';
                }
                viewCountLabel.textContent = `${Number(apiResponse.total).toLocaleString()} ${viewWord}`;
            } else {
                viewCountLabel.textContent = '';
            }
            if (!viewCountElement.contains(viewCountLabel)) {
                viewCountElement.appendChild(viewCountLabel);
            }
        }
    } catch (trackingError) {
        if (viewCountElement) {
            const loadingSpinner = viewCountElement.querySelector('.doc-views-spinner');
            if (loadingSpinner) {
                loadingSpinner.remove();
            }
        }
    }
}

/* ─── Sidebar Active State ─── */

// Highlights the sidebar entry for the open page (and subsection, if any)
// and expands its list of subsections.
function updateSidebarActive(slug, anchor) {
    // Clear all active states
    document.querySelectorAll('.nav-article-btn, .nav-sub-btn').forEach(navigationButton => {
        navigationButton.classList.remove('active');
    });

    if (!slug) {
        return;
    }

    // Mark the article button active
    document.querySelectorAll(`.nav-article-btn[data-slug="${slug}"]`).forEach(articleButton => {
        articleButton.classList.add('active');
    });

    if (anchor) {
        // Mark the specific subsection button active
        document.querySelectorAll(`.nav-sub-btn[data-slug="${slug}"][data-anchor="${anchor}"]`).forEach(subsectionButton => {
            subsectionButton.classList.add('active');
        });
    }

    // Expand the parent article
    const articleContainer = document.querySelector(`.nav-article[data-slug="${slug}"]`);
    if (articleContainer) {
        const subsectionList = articleContainer.querySelector('.nav-subsections');
        if (subsectionList) {
            subsectionList.style.display = 'block';
            articleContainer.classList.add('expanded');
        }
    }
}

/* ─── Sidebar Toggle ─── */
function ensureSidebarOpen() {
    if (window.innerWidth >= MOBILE_BREAKPOINT_WIDTH) {
        return; // desktop: always visible
    }
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

// On desktop the sidebar collapses to the side; on mobile it slides in and out.
function toggleSidebar() {
    if (window.innerWidth >= MOBILE_BREAKPOINT_WIDTH) {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('main-content');
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('sidebar-hidden');
    } else {
        const isOpen = document.getElementById('sidebar').classList.contains('open');
        if (isOpen) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }
}

/* ─── Session / Auth ─── */

// Checks the saved session token with the server and signs the user back in.
async function restoreSession() {
    const sessionToken = localStorage.getItem('gftv-token');
    if (sessionToken) {
        try {
            const apiResponse = await apiFetch('/api/auth/me', {
                headers: {
                    Authorization: `Bearer ${sessionToken}`
                }
            });
            if (apiResponse.ok) {
                currentUser = apiResponse.user;
            } else {
                localStorage.removeItem('gftv-token');
            }
        } catch (sessionError) {
            localStorage.removeItem('gftv-token');
        }
    }
    updateUserUI();
}

// Shows or hides a dropdown menu element (by id) each time it is called.
function toggleDropdownVisibility(dropdownElementId) {
    const dropdownElement = document.getElementById(dropdownElementId);
    if (dropdownElement.style.display === 'none') {
        dropdownElement.style.display = 'block';
    } else {
        dropdownElement.style.display = 'none';
    }
}

// Adds an event listener to the element with the given id, but only if that
// element exists on the page (some pages do not include every element).
function addListenerIfPresent(elementId, eventName, eventHandler) {
    const element = document.getElementById(elementId);
    if (element) {
        element.addEventListener(eventName, eventHandler);
    }
}

// Builds the signed-in user's name chip with its dropdown menu.
// "idPrefix" is '' for the header copy and 'sidebar-' for the sidebar copy.
function buildUserChipHtml(idPrefix) {
    let adminPanelButtonHtml = '';
    if (currentUser.is_admin) {
        adminPanelButtonHtml = `<button class="user-dropdown-item" id="${idPrefix}goto-admin">Admin Panel</button>`;
    }
    return `
      <div class="user-chip" id="${idPrefix}user-chip" tabindex="0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="2"/></svg>
        ${escapeHtmlCharacters(String(currentUser.display_name || ''))}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2"/></svg>
        <div class="user-dropdown" id="${idPrefix}user-dropdown" style="display:none">
          ${adminPanelButtonHtml}
          <button class="user-dropdown-item danger" id="${idPrefix}logout-btn">Sign Out</button>
        </div>
      </div>`;
}

// Connects the clicks of a user chip created by buildUserChipHtml.
function attachUserChipHandlers(idPrefix) {
    const userChip = document.getElementById(`${idPrefix}user-chip`);
    userChip.addEventListener('click', clickEvent => {
        clickEvent.stopPropagation();
        toggleDropdownVisibility(`${idPrefix}user-dropdown`);
    });
    addListenerIfPresent(`${idPrefix}logout-btn`, 'click', logout);
    addListenerIfPresent(`${idPrefix}goto-admin`, 'click', () => navigate('/admin'));
}

// Closes a user dropdown the next time anything on the page is clicked.
function closeDropdownOnNextClick(dropdownElementId) {
    document.addEventListener('click', () => {
        const dropdownElement = document.getElementById(dropdownElementId);
        if (dropdownElement) {
            dropdownElement.style.display = 'none';
        }
    }, { once: true });
}

/**
 * Redraws the header and sidebar account areas: a user chip with a dropdown
 * when someone is signed in, or "Sign In" buttons when nobody is.
 */
function updateUserUI() {
    const headerUserArea = document.getElementById('user-area');
    const sidebarUserArea = document.getElementById('sidebar-user-area');
    const openSearchFromSidebar = () => {
        closeSidebar();
        openSearch();
    };

    if (currentUser) {
        if (headerUserArea) {
            headerUserArea.innerHTML = buildUserChipHtml('');
            attachUserChipHandlers('');
            closeDropdownOnNextClick('user-dropdown');
        }

        if (sidebarUserArea) {
            sidebarUserArea.innerHTML = buildUserChipHtml('sidebar-') + `
      <button class="btn btn-ghost btn-sm" id="sidebar-search-btn">Search</button>`;
            attachUserChipHandlers('sidebar-');
            addListenerIfPresent('sidebar-search-btn', 'click', openSearchFromSidebar);
            closeDropdownOnNextClick('sidebar-user-dropdown');
        }
    } else {
        if (headerUserArea) {
            headerUserArea.innerHTML = `<button class="btn btn-ghost btn-sm" id="login-btn">Sign In</button>`;
            addListenerIfPresent('login-btn', 'click', () => openModal('auth-modal'));
        }
        if (sidebarUserArea) {
            sidebarUserArea.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="sidebar-login-btn">Sign In</button>
      <button class="btn btn-ghost btn-sm" id="sidebar-search-btn">Search</button>`;
            addListenerIfPresent('sidebar-login-btn', 'click', () => openModal('auth-modal'));
            addListenerIfPresent('sidebar-search-btn', 'click', openSearchFromSidebar);
        }
    }
}

async function logout() {
    const sessionToken = localStorage.getItem('gftv-token');
    if (sessionToken) {
        await apiFetch('/api/auth/logout', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${sessionToken}`
            }
        });
    }
    localStorage.removeItem('gftv-token');
    currentUser = null;
    updateUserUI();
    showToast('Signed out', 'success');
    if (location.pathname === '/admin') {
        navigate('/');
    }
}

/* ─── Auth Form ─── */

// The token the server gave us after a correct password, while it waits
// for the user's two-factor code.
let totpChallengeToken = null;

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
    totpChallengeToken = null;
    clearAuthError();
}

// Saves the new session (and trusted-device token, if any) and updates the page.
function completeLogin(loginResponse) {
    localStorage.setItem('gftv-token', loginResponse.token);
    if (loginResponse.device_token) {
        localStorage.setItem('gftv-device-token', loginResponse.device_token);
    }
    currentUser = loginResponse.user;
    updateUserUI();
    closeModal('auth-modal');
    showToast('Welcome back, ' + loginResponse.user.display_name, 'success');
}

addListenerIfPresent('login-form', 'submit', async () => {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    clearAuthError();
    if (!username || !password) {
        return showAuthError('Please fill in all fields.');
    }
    const deviceToken = localStorage.getItem('gftv-device-token') || undefined;
    const apiResponse = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: username, password: password, device_token: deviceToken }),
        headers: { 'Content-Type': 'application/json' }
    });
    if (!apiResponse.ok) {
        return showAuthError(apiResponse.error || 'Login failed');
    }
    if (apiResponse.totp_required) {
        totpChallengeToken = apiResponse.challenge_token;
        showTotpStep();
    } else {
        completeLogin(apiResponse);
    }
});

addListenerIfPresent('totp-submit', 'click', async () => {
    const code = document.getElementById('totp-code').value.trim();
    const trustDevice = document.getElementById('totp-trust-device').checked;
    clearAuthError();
    if (!code) {
        return showAuthError('Please enter your authentication code.');
    }
    if (!totpChallengeToken) {
        return showAuthError('Session expired, please log in again.');
    }
    const apiResponse = await apiFetch('/api/auth/totp-verify', {
        method: 'POST',
        body: JSON.stringify({ challenge_token: totpChallengeToken, code: code, trust_device: trustDevice }),
        headers: { 'Content-Type': 'application/json' }
    });
    if (apiResponse.ok) {
        completeLogin(apiResponse);
    } else {
        showAuthError(apiResponse.error || 'Invalid code');
    }
});

// Switches the code box between "authenticator app code" and "backup code".
addListenerIfPresent('totp-use-backup', 'click', () => {
    const codeLabel = document.getElementById('totp-code-label');
    const codeInput = document.getElementById('totp-code');
    const switchButton = document.getElementById('totp-use-backup');
    const isBackupMode = codeInput.getAttribute('data-mode') === 'backup';
    if (isBackupMode) {
        codeLabel.textContent = 'Authentication Code';
        codeInput.placeholder = '000000';
        codeInput.inputMode = 'numeric';
        codeInput.maxLength = 20;
        codeInput.removeAttribute('data-mode');
        switchButton.textContent = 'Use a backup code instead';
    } else {
        codeLabel.textContent = 'Backup Code';
        codeInput.placeholder = 'xxxx-xxxx-xxxx';
        codeInput.inputMode = 'text';
        codeInput.maxLength = 50;
        codeInput.setAttribute('data-mode', 'backup');
        switchButton.textContent = 'Use authenticator app instead';
    }
    codeInput.value = '';
    clearAuthError();
});

addListenerIfPresent('totp-back', 'click', showLoginStep);

addListenerIfPresent('reg-submit', 'click', async () => {
    const displayName = document.getElementById('reg-display').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    clearAuthError();
    if (!displayName || !username || !email || !password) {
        return showAuthError('Please fill in all fields.');
    }
    const apiResponse = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            display_name: displayName,
            username: username,
            email: email,
            password: password
        }),
        headers: {
            'Content-Type': 'application/json'
        }
    });
    if (apiResponse.ok) {
        closeModal('auth-modal');
        showToast('Account created! Awaiting admin approval.', 'success');
    } else {
        showAuthError(apiResponse.error || 'Registration failed');
    }
});

addListenerIfPresent('show-register', 'click', () => {
    document.getElementById('auth-form-login').classList.add('hidden');
    document.getElementById('auth-form-register').classList.remove('hidden');
    document.getElementById('auth-modal-title').textContent = 'Create Account';
    clearAuthError();
});

addListenerIfPresent('show-login', 'click', () => {
    document.getElementById('auth-form-register').classList.add('hidden');
    document.getElementById('auth-form-login').classList.remove('hidden');
    document.getElementById('auth-modal-title').textContent = 'Sign In';
    clearAuthError();
});

function showAuthError(errorMessage) {
    const errorElement = document.getElementById('auth-error');
    if (errorElement) {
        errorElement.textContent = errorMessage;
        errorElement.classList.remove('hidden');
    }
}

function clearAuthError() {
    const errorElement = document.getElementById('auth-error');
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.classList.add('hidden');
    }
}

/* ─── Copy Toolbar ─── */

const PUBLIC_SITE_ORIGIN = 'https://policy.globalfurry.tv';

// Hides every "copy" dropdown menu and resets its position.
function hideAllCopyDropdowns() {
    document.querySelectorAll('.copy-dropdown').forEach(copyDropdown => {
        copyDropdown.hidden = true;
        copyDropdown.style.right = '';
        copyDropdown.style.left = '';
    });
}

// Builds a Markdown copy of the open page, including all of its subsections.
function buildCurrentPageMarkdown() {
    const urlBase = DOCUMENT_CONFIG[currentDocumentKey].urlBase;
    let childSections = [];
    if (currentSection.type === 'article') {
        childSections = subsectionsOf(currentSection.id);
    }
    let markdownText = `# ${currentSection.title}\n\nSource: ${PUBLIC_SITE_ORIGIN}${urlBase}/${currentSection.slug}\n\n${currentSection.content || ''}`;
    childSections.forEach(childSection => {
        markdownText += `\n\n## ${childSection.title}\n\n${childSection.content || ''}`;
    });
    return markdownText;
}

// Loads the html2pdf library from a CDN the first time it is needed.
function loadHtml2PdfLibrary() {
    return new Promise((resolve, reject) => {
        if (window.html2pdf) {
            return resolve(window.html2pdf);
        }
        const scriptElement = document.createElement('script');
        scriptElement.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        scriptElement.onload = () => resolve(window.html2pdf);
        scriptElement.onerror = reject;
        document.head.appendChild(scriptElement);
    });
}

// Looks up the reader's public IP address for the PDF footer ("Unknown" on failure).
function fetchPublicIpAddress() {
    return fetch('https://api.ipify.org?format=json')
        .then(response => response.json())
        .then(responseJson => responseJson.ip)
        .catch(() => 'Unknown');
}

// Loads the site logo and converts it to a data URL that jsPDF can draw.
// Resolves with null if the logo cannot be loaded.
function loadLogoAsDataUrl() {
    return new Promise(resolve => {
        const logoImage = new Image();
        logoImage.crossOrigin = 'anonymous';
        logoImage.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = logoImage.naturalWidth;
            canvas.height = logoImage.naturalHeight;
            canvas.getContext('2d').drawImage(logoImage, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        logoImage.onerror = () => resolve(null);
        logoImage.src = '/GHS-main.png';
    });
}

/**
 * Draws the PolicySpot header (logo, name, GFTV badge) and the footer (page
 * address, export time, IP address and page number) on every page of the PDF.
 * All measurements are in millimetres.
 */
function drawPdfHeadersAndFooters(pdfDocument, logoDataUrl, pageUrl, exportDateTime, ipAddress) {
    const totalPages = pdfDocument.internal.getNumberOfPages();
    const pageWidth = pdfDocument.internal.pageSize.getWidth();
    const pageHeight = pdfDocument.internal.pageSize.getHeight();
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        pdfDocument.setPage(pageNumber);
        // Header
        let titleTextX = 14;
        if (logoDataUrl) {
            pdfDocument.addImage(logoDataUrl, 'PNG', 14, 5, 9, 9);
            titleTextX = 25;
        }
        pdfDocument.setFontSize(12);
        pdfDocument.setFont('helvetica', 'bold');
        pdfDocument.setTextColor(30, 30, 50);
        pdfDocument.text('PolicySpot', titleTextX, 10.5);
        const badgeX = titleTextX + pdfDocument.getTextWidth('PolicySpot') + 2;
        pdfDocument.setFillColor(74, 106, 138);
        pdfDocument.setFontSize(6.5);
        pdfDocument.roundedRect(badgeX, 6.2, pdfDocument.getTextWidth('GFTV') + 3, 5, 1, 1, 'F');
        pdfDocument.setTextColor(255, 255, 255);
        pdfDocument.text('GFTV', badgeX + 1.5, 10.2);
        pdfDocument.setDrawColor(180, 190, 200);
        pdfDocument.setLineWidth(0.3);
        pdfDocument.line(14, 17, pageWidth - 14, 17);
        // Footer
        pdfDocument.line(14, pageHeight - 18, pageWidth - 14, pageHeight - 18);
        pdfDocument.setFontSize(7.5);
        pdfDocument.setFont('helvetica', 'normal');
        pdfDocument.setTextColor(100, 110, 120);
        pdfDocument.text(pageUrl, 14, pageHeight - 13.5);
        pdfDocument.text(`Exported: ${exportDateTime}`, 14, pageHeight - 9);
        pdfDocument.text(`Exporting IP: ${ipAddress}`, 14, pageHeight - 4.5);
        const pageLabel = `${pageNumber} / ${totalPages}`;
        pdfDocument.text(pageLabel, pageWidth - 14 - pdfDocument.getTextWidth(pageLabel), pageHeight - 4.5);
    }
}

/**
 * Turns the open page into a PDF (using html2pdf) and opens it in a new tab.
 * While the PDF is made, the page is temporarily switched to the default
 * light theme and every collapsible block is opened; both are put back
 * afterwards, whether the export worked or not.
 */
function exportCurrentPageAsPdf() {
    const documentConfig = DOCUMENT_CONFIG[currentDocumentKey];
    const contentElementId = documentConfig.contentElementId;
    const contentElement = document.getElementById(contentElementId);
    if (!contentElement) {
        return;
    }
    const pageTitle = currentSection.title || 'export';
    const pageUrl = `${PUBLIC_SITE_ORIGIN}${documentConfig.urlBase}/${currentSection.slug}`;
    const exportDateTime = new Date().toLocaleString('en-GB', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
    });
    const pdfOptions = {
        margin: [22, 14, 24, 14],
        filename: `${pageTitle}.pdf`,
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
    const pdfPreparationStyle = document.createElement('style');
    pdfPreparationStyle.id = 'pdf-prep-style';
    pdfPreparationStyle.textContent = `
                #${contentElementId} h1, #${contentElementId} h2,
                #${contentElementId} h3, #${contentElementId} h4 { page-break-after: avoid; }
                #${contentElementId} tr, #${contentElementId} img,
                #${contentElementId} li, #${contentElementId} blockquote { page-break-inside: avoid; }
            `;
    document.head.appendChild(pdfPreparationStyle);

    const savedTheme = snapshotTheme();
    forceExportTheme();
    // Expand all collapsibles for PDF capture, remember which were already open
    const collapsibleElements = Array.from(contentElement.querySelectorAll('details.md-collapse'));
    const collapsibleWasOpen = collapsibleElements.map(collapsibleElement => collapsibleElement.open);
    collapsibleElements.forEach(collapsibleElement => {
        collapsibleElement.open = true;
    });

    // Puts the page back the way it was before the export started
    const undoExportPreparation = () => {
        const preparationStyle = document.getElementById('pdf-prep-style');
        if (preparationStyle) {
            preparationStyle.remove();
        }
        collapsibleElements.forEach((collapsibleElement, elementIndex) => {
            collapsibleElement.open = collapsibleWasOpen[elementIndex];
        });
        restoreTheme(savedTheme);
    };

    Promise.all([loadHtml2PdfLibrary(), fetchPublicIpAddress(), loadLogoAsDataUrl()])
        .then(([html2pdfLibrary, ipAddress, logoDataUrl]) =>
            html2pdfLibrary().set(pdfOptions).from(contentElement).toPdf().get('pdf').then(pdfDocument => {
                drawPdfHeadersAndFooters(pdfDocument, logoDataUrl, pageUrl, exportDateTime, ipAddress);
                return pdfDocument.output('bloburl');
            })
        )
        .then(pdfBlobUrl => {
            undoExportPreparation();
            window.open(pdfBlobUrl, '_blank');
            showToast('PDF opened in new tab', 'success');
        })
        .catch(() => {
            undoExportPreparation();
            showToast('Failed to generate PDF', 'error');
        });
}

// Opens ChatGPT or Claude in a new tab, asking it to read the open page.
function openPageInAiAssistant(assistantName) {
    const urlBase = DOCUMENT_CONFIG[currentDocumentKey].urlBase;
    let encodedPageUrl = 'https%3A%2F%2Fpolicy.globalfurry.tv';
    if (currentSection) {
        encodedPageUrl = encodeURIComponent(`${PUBLIC_SITE_ORIGIN}${urlBase}/${currentSection.slug}`);
    }
    if (assistantName === 'chatgpt') {
        window.open(`https://chat.openai.com/?q=Read%20${encodedPageUrl}%20and%20answer%20questions%20about%20the%20content.`, '_blank');
    } else {
        window.open(`https://claude.ai/new?q=Read%20${encodedPageUrl}%20and%20answer%20questions%20about%20the%20content.`, '_blank');
    }
}

/**
 * Wires up the "Copy" toolbar dropdown on document pages: opening and
 * closing the menu, and the actions inside it (copy or view as Markdown,
 * export as PDF, open in ChatGPT or Claude).
 */
function setupCopyDropdown() {
    // Opening / closing the dropdown menu
    document.addEventListener('click', clickEvent => {
        const dropdownButton = clickEvent.target.closest('.copy-dropdown-btn');
        if (dropdownButton) {
            clickEvent.stopPropagation();
            const copyDropdown = dropdownButton.closest('.doc-actions').querySelector('.copy-dropdown');
            const wasOpen = !copyDropdown.hidden;
            hideAllCopyDropdowns();
            if (!wasOpen) {
                copyDropdown.hidden = false;
                // Keep the menu on screen if it would stick out past the left edge
                const dropdownRectangle = copyDropdown.getBoundingClientRect();
                if (dropdownRectangle.left < 8) {
                    copyDropdown.style.right = 'auto';
                    copyDropdown.style.left = '0';
                }
            }
            return;
        }
        if (!clickEvent.target.closest('.copy-dropdown')) {
            hideAllCopyDropdowns();
        }
    });

    // The actions inside the menu
    document.addEventListener('click', clickEvent => {
        const actionItem = clickEvent.target.closest('[data-action]');
        if (!actionItem) {
            return;
        }
        const action = actionItem.dataset.action;
        const copyDropdown = actionItem.closest('.copy-dropdown');
        if (copyDropdown) {
            copyDropdown.hidden = true;
        }

        setTimeout(() => {
            if (action === 'copy-md' || action === 'view-md') {
                if (!currentSection) {
                    return showToast('No page loaded', 'error');
                }
                const markdownText = buildCurrentPageMarkdown();
                if (action === 'copy-md') {
                    navigator.clipboard.writeText(markdownText).then(() => showToast('Copied as Markdown', 'success'));
                } else {
                    const markdownBlob = new Blob([markdownText], { type: 'text/plain' });
                    window.open(URL.createObjectURL(markdownBlob), '_blank');
                }
            } else if (action === 'export-pdf') {
                if (!currentSection) {
                    return showToast('No page loaded', 'error');
                }
                exportCurrentPageAsPdf();
            } else if (action === 'chatgpt' || action === 'claude') {
                openPageInAiAssistant(action);
            }
        }, 0);
    });
}

/* ─── Slug Modal ─── */
function openSlugModal(section) {
    const urlBase = DOCUMENT_CONFIG[currentDocumentKey].urlBase;
    document.getElementById('slug-input').value = section.slug;
    document.getElementById('slug-section-id').value = section.id;
    document.getElementById('slug-preview').textContent = `policy.globalfurry.tv${urlBase}/${section.slug}`;
    document.getElementById('slug-error').classList.add('hidden');
    openModal('slug-modal');
}

// Live preview of the address while the slug is being typed
addListenerIfPresent('slug-input', 'input', inputEvent => {
    const slugPreview = document.getElementById('slug-preview');
    if (slugPreview) {
        const urlBase = DOCUMENT_CONFIG[currentDocumentKey].urlBase;
        slugPreview.textContent = `policy.globalfurry.tv${urlBase}/${inputEvent.target.value}`;
    }
});

addListenerIfPresent('slug-save', 'click', async () => {
    const sectionId = document.getElementById('slug-section-id').value;
    const slug = document.getElementById('slug-input').value.trim();
    const errorElement = document.getElementById('slug-error');
    errorElement.classList.add('hidden');
    if (!slug) {
        errorElement.textContent = 'Slug cannot be empty';
        errorElement.classList.remove('hidden');
        return;
    }
    const sessionToken = localStorage.getItem('gftv-token');
    const apiResponse = await apiFetch('/api/policy/update-slug', {
        method: 'PUT',
        body: JSON.stringify({
            id: sectionId,
            slug: slug
        }),
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`
        }
    });
    if (apiResponse.ok) {
        closeModal('slug-modal');
        showToast('Slug updated', 'success');
        const updatedSection = sections.find(candidate => candidate.id === sectionId);
        if (updatedSection) {
            updatedSection.slug = slug;
        }
        navigate(`${DOCUMENT_CONFIG[currentDocumentKey].urlBase}/${slug}`);
        buildSidebar();
    } else {
        errorElement.textContent = apiResponse.error || 'Update failed';
        errorElement.classList.remove('hidden');
    }
});

/* ─── Content Edit Modal ─── */

// Shows an element when "shouldShow" is true and hides it otherwise.
function setElementVisible(element, shouldShow) {
    if (shouldShow) {
        element.style.display = '';
    } else {
        element.style.display = 'none';
    }
}

// Opens the editor pre-filled with an existing section's details.
function openContentModal(section) {
    document.getElementById('content-edit-id').value = section.id;
    document.getElementById('content-edit-table').value = currentDocumentKey;
    document.getElementById('content-edit-title').value = section.title || '';
    document.getElementById('content-edit-slug').value = section.slug || '';
    document.getElementById('content-edit-number').value = section.number || '';
    document.getElementById('content-edit-anchor').value = section.anchor || '';
    document.getElementById('content-edit-content').value = section.content || '';
    document.getElementById('content-edit-mode').value = 'edit';
    document.getElementById('content-edit-parent-id').value = section.parent_id || '';

    // Only subsections have an anchor field
    const anchorGroup = document.getElementById('content-edit-anchor-group');
    if (anchorGroup) {
        setElementVisible(anchorGroup, section.type === 'subsection');
    }
    document.getElementById('content-edit-type-group').style.display = 'none';

    document.getElementById('content-modal-title').textContent = 'Edit Section';

    // Only show "move up" / "move down" when there is somewhere to move to
    let siblingSections = topLevelPages();
    if (section.type === 'subsection') {
        siblingSections = subsectionsOf(section.parent_id);
    }
    const positionAmongSiblings = siblingSections.findIndex(sibling => sibling.id === section.id);
    const canMoveUp = positionAmongSiblings > 0;
    const canMoveDown = positionAmongSiblings >= 0 && positionAmongSiblings < siblingSections.length - 1;
    setElementVisible(document.getElementById('content-edit-move-up'), canMoveUp);
    setElementVisible(document.getElementById('content-edit-move-down'), canMoveDown);
    document.getElementById('content-edit-delete').style.display = '';

    document.getElementById('content-edit-error').classList.add('hidden');
    openModal('content-modal');
    editorInitHistory(document.getElementById('content-edit-content'));
}

// Opens the editor empty, ready to create a new section (or a subsection
// of "parentSection" when one is given).
function openAddSectionModal(parentSection) {
    document.getElementById('content-edit-id').value = '';
    document.getElementById('content-edit-table').value = currentDocumentKey;
    document.getElementById('content-edit-title').value = '';
    document.getElementById('content-edit-slug').value = '';
    document.getElementById('content-edit-number').value = '';
    document.getElementById('content-edit-anchor').value = '';
    document.getElementById('content-edit-content').value = '';
    document.getElementById('content-edit-mode').value = 'add';
    let parentId = '';
    if (parentSection) {
        parentId = parentSection.id;
    }
    document.getElementById('content-edit-parent-id').value = parentId;

    const isSubsection = Boolean(parentSection);
    setElementVisible(document.getElementById('content-edit-anchor-group'), isSubsection);
    setElementVisible(document.getElementById('content-edit-type-group'), !isSubsection);

    let modalTitle = 'Add Section';
    if (isSubsection) {
        modalTitle = 'Add Subsection';
    }
    document.getElementById('content-modal-title').textContent = modalTitle;
    document.getElementById('content-edit-move-up').style.display = 'none';
    document.getElementById('content-edit-move-down').style.display = 'none';
    document.getElementById('content-edit-delete').style.display = 'none';

    document.getElementById('content-edit-error').classList.add('hidden');
    openModal('content-modal');
    editorInitHistory(document.getElementById('content-edit-content'));
}

/* ─── Markdown Editor History (undo/redo) ───
   Every saved state stores the text and the cursor selection. "position"
   points at the state currently shown; undo moves it back, redo moves it
   forward. Saving a new state throws away anything after "position". */
const MAXIMUM_HISTORY_STATES = 200;
const editorHistory = { stack: [], position: -1, debounceTimer: null };

function editorSaveState(textArea) {
    editorHistory.stack = editorHistory.stack.slice(0, editorHistory.position + 1);
    editorHistory.stack.push({
        value: textArea.value,
        selectionStart: textArea.selectionStart,
        selectionEnd: textArea.selectionEnd
    });
    if (editorHistory.stack.length > MAXIMUM_HISTORY_STATES) {
        editorHistory.stack.shift();
    }
    editorHistory.position = editorHistory.stack.length - 1;
}

function editorInitHistory(textArea) {
    clearTimeout(editorHistory.debounceTimer);
    editorHistory.stack = [{ value: textArea.value, selectionStart: 0, selectionEnd: 0 }];
    editorHistory.position = 0;
}

// Puts a saved history state back into the text area.
function restoreEditorState(textArea, savedState) {
    textArea.value = savedState.value;
    textArea.selectionStart = savedState.selectionStart;
    textArea.selectionEnd = savedState.selectionEnd;
}

function editorUndo(textArea) {
    if (editorHistory.position > 0) {
        editorHistory.position--;
        restoreEditorState(textArea, editorHistory.stack[editorHistory.position]);
    }
}

function editorRedo(textArea) {
    if (editorHistory.position < editorHistory.stack.length - 1) {
        editorHistory.position++;
        restoreEditorState(textArea, editorHistory.stack[editorHistory.position]);
    }
}

// Debounced history push on regular typing (groups keystrokes ~600ms apart)
addListenerIfPresent('content-edit-content', 'input', inputEvent => {
    clearTimeout(editorHistory.debounceTimer);
    editorHistory.debounceTimer = setTimeout(() => editorSaveState(inputEvent.target), 600);
});

/* ─── Markdown Editor Keyboard Shortcuts ─── */

/**
 * Wraps the selected text in "openingMarker" and "closingMarker" (for
 * example ** and ** for bold). If the selection is already wrapped, the
 * markers are removed instead, so pressing the shortcut twice undoes it.
 * With nothing selected, the word "text" is inserted and selected.
 */
function applyMarkdownFormat(textArea, openingMarker, closingMarker) {
    editorSaveState(textArea);
    const selectionStart = textArea.selectionStart;
    const selectionEnd = textArea.selectionEnd;
    const fullText = textArea.value;
    const selectedText = fullText.substring(selectionStart, selectionEnd);

    // Toggle off if the markers sit just outside the selection
    const charactersBefore = fullText.substring(Math.max(0, selectionStart - openingMarker.length), selectionStart);
    const charactersAfter = fullText.substring(selectionEnd, selectionEnd + closingMarker.length);
    if (charactersBefore === openingMarker && charactersAfter === closingMarker) {
        textArea.value = fullText.substring(0, selectionStart - openingMarker.length)
            + selectedText
            + fullText.substring(selectionEnd + closingMarker.length);
        textArea.selectionStart = selectionStart - openingMarker.length;
        textArea.selectionEnd = selectionEnd - openingMarker.length;
        return;
    }
    // Toggle off if the markers are inside the selection
    const selectionIsWrapped = selectedText.startsWith(openingMarker)
        && selectedText.endsWith(closingMarker)
        && selectedText.length > openingMarker.length + closingMarker.length;
    if (selectionIsWrapped) {
        const innerText = selectedText.slice(openingMarker.length, selectedText.length - closingMarker.length);
        textArea.value = fullText.substring(0, selectionStart) + innerText + fullText.substring(selectionEnd);
        textArea.selectionStart = selectionStart;
        textArea.selectionEnd = selectionStart + innerText.length;
        return;
    }

    const textToWrap = selectedText || 'text';
    textArea.value = fullText.substring(0, selectionStart) + openingMarker + textToWrap + closingMarker + fullText.substring(selectionEnd);
    textArea.selectionStart = selectionStart + openingMarker.length;
    textArea.selectionEnd = selectionStart + openingMarker.length + textToWrap.length;
}

// Ctrl+Shift+I: inserts an image placeholder and selects the "url" part.
function insertImagePlaceholder(textArea) {
    editorSaveState(textArea);
    const selectionStart = textArea.selectionStart;
    const selectedText = textArea.value.substring(selectionStart, textArea.selectionEnd);
    const altText = selectedText || 'alt';
    const imageMarkdown = `![${altText}]{img}(url)`;
    textArea.value = textArea.value.substring(0, selectionStart) + imageMarkdown + textArea.value.substring(textArea.selectionEnd);
    const urlStart = selectionStart + `![${altText}]{img}(`.length;
    textArea.selectionStart = urlStart;
    textArea.selectionEnd = urlStart + 'url'.length;
    textArea.focus();
}

// Ctrl+K: turns the selection into a link, or inserts a "[link text](url)" placeholder.
function insertLinkPlaceholder(textArea) {
    editorSaveState(textArea);
    const selectionStart = textArea.selectionStart;
    const selectedText = textArea.value.substring(selectionStart, textArea.selectionEnd);
    if (selectedText) {
        textArea.value = textArea.value.substring(0, selectionStart) + '[' + selectedText + '](url)' + textArea.value.substring(textArea.selectionEnd);
        // Select the word "url" so it can be typed over
        textArea.selectionStart = selectionStart + selectedText.length + 3;
        textArea.selectionEnd = selectionStart + selectedText.length + 6;
    } else {
        textArea.value = textArea.value.substring(0, selectionStart) + '[link text](url)' + textArea.value.substring(selectionStart);
        // Select the words "link text" so they can be typed over
        textArea.selectionStart = selectionStart + 1;
        textArea.selectionEnd = selectionStart + 10;
    }
}

/**
 * Keyboard shortcuts in the Markdown editor (Ctrl on Windows/Linux, Cmd on Mac):
 *   Z undo, Shift+Z / Y redo, B bold, I italic, Shift+I image,
 *   U underline, K link, ` inline code, S save.
 */
addListenerIfPresent('content-edit-content', 'keydown', keyboardEvent => {
    if (!keyboardEvent.ctrlKey && !keyboardEvent.metaKey) {
        return;
    }
    const textArea = keyboardEvent.target;
    switch (keyboardEvent.key.toLowerCase()) {
        case 'z':
            keyboardEvent.preventDefault();
            if (keyboardEvent.shiftKey) {
                editorRedo(textArea);
            } else {
                editorUndo(textArea);
            }
            break;
        case 'y':
            keyboardEvent.preventDefault();
            editorRedo(textArea);
            break;
        case 'b':
            keyboardEvent.preventDefault();
            applyMarkdownFormat(textArea, '**', '**');
            break;
        case 'i':
            keyboardEvent.preventDefault();
            if (keyboardEvent.shiftKey) {
                insertImagePlaceholder(textArea);
            } else {
                applyMarkdownFormat(textArea, '*', '*');
            }
            break;
        case 'u':
            keyboardEvent.preventDefault();
            applyMarkdownFormat(textArea, '__', '__');
            break;
        case 'k':
            keyboardEvent.preventDefault();
            insertLinkPlaceholder(textArea);
            break;
        case '`':
            keyboardEvent.preventDefault();
            applyMarkdownFormat(textArea, '`', '`');
            break;
        case 's': {
            keyboardEvent.preventDefault();
            const saveButton = document.getElementById('content-edit-save');
            if (saveButton) {
                saveButton.click();
            }
            break;
        }
    }
});

/* ─── Media Picker (images, documents, sounds and embeds) ───
   One modal with several tabs. This object remembers what has been chosen
   so far, and which text area / cursor position to insert the result at. */
const mediaPicker = {
    textArea: null,
    cursorPosition: 0,
    // Images
    selectedImageUrl: null,
    compressedImage: null,
    originalFile: null,
    // Documents
    documentFile: null,
    selectedDocumentUrl: null,
    selectedDocumentName: null,
    // Sounds
    soundFile: null,
    selectedSoundUrl: null,
    selectedSoundName: null,
};

/**
 * Shrinks an image in the browser before upload by drawing it onto a canvas.
 * Images wider than "maxWidth" are scaled down. GIFs stay GIF, small PNGs
 * stay PNG, and everything else becomes WebP.
 * Resolves with { base64, mimeType, width, height, size }.
 */
function compressImage(file, maxWidth = 1920, quality = 0.82) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const objectUrl = URL.createObjectURL(file);
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image'));
        };
        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            let width = image.naturalWidth;
            let height = image.naturalHeight;
            if (width > maxWidth) {
                height = Math.round(height * maxWidth / width);
                width = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(image, 0, 0, width, height);
            // GIF stays GIF; small PNGs stay PNG; everything else → WebP
            let outputMimeType = 'image/webp';
            if (file.type === 'image/gif') {
                outputMimeType = 'image/gif';
            } else if (file.type === 'image/png' && file.size < 100_000) {
                outputMimeType = 'image/png';
            }
            canvas.toBlob(compressedBlob => {
                const fileReader = new FileReader();
                fileReader.onload = () => resolve({
                    base64: fileReader.result.split(',')[1],
                    mimeType: compressedBlob.type,
                    width: width,
                    height: height,
                    size: compressedBlob.size,
                });
                fileReader.readAsDataURL(compressedBlob);
            }, outputMimeType, quality);
        };
        image.src = objectUrl;
    });
}

// Sets the "hidden" property of an element, if the element exists.
function setHiddenIfPresent(elementId, isHidden) {
    const element = document.getElementById(elementId);
    if (element) {
        element.hidden = isHidden;
    }
}

// Opens the media picker and resets every tab to its empty state.
function openImagePicker(textArea) {
    mediaPicker.textArea = textArea;
    mediaPicker.cursorPosition = textArea.selectionStart;
    mediaPicker.selectedImageUrl = null;
    mediaPicker.compressedImage = null;
    mediaPicker.originalFile = null;

    mediaPicker.documentFile = null;
    mediaPicker.selectedDocumentUrl = null;
    mediaPicker.selectedDocumentName = null;
    mediaPicker.soundFile = null;
    mediaPicker.selectedSoundUrl = null;
    mediaPicker.selectedSoundName = null;

    // Reset upload pane
    document.getElementById('img-drop-zone').hidden = false;
    document.getElementById('img-preview-wrap').hidden = true;
    document.getElementById('img-alt-upload').value = '';
    document.getElementById('img-insert-btn').disabled = true;

    // Reset document / sound / embed panes
    setHiddenIfPresent('doc-drop-zone', false);
    setHiddenIfPresent('doc-file-ready', true);
    setHiddenIfPresent('snd-drop-zone', false);
    setHiddenIfPresent('snd-file-ready', true);
    setHiddenIfPresent('embed-type-badge', true);
    const embedUrlInput = document.getElementById('embed-url-input');
    if (embedUrlInput) {
        embedUrlInput.value = '';
    }

    switchMediaPickerTab('upload');
    openModal('image-picker-modal');
}

// Shows one tab of the media picker and loads its library list if needed.
function switchMediaPickerTab(tabName) {
    document.querySelectorAll('.img-tab-btn').forEach(tabButton => {
        tabButton.classList.toggle('active', tabButton.dataset.tab === tabName);
    });
    document.querySelectorAll('.img-tab-pane').forEach(tabPane => {
        tabPane.classList.toggle('hidden', tabPane.id !== `img-pane-${tabName}`);
    });
    if (tabName === 'library') {
        loadImageLibrary();
    }
    if (tabName === 'documents') {
        loadDocumentLibrary();
    }
    if (tabName === 'sounds') {
        loadSoundLibrary();
    }
}

// Turns a byte count into whole kilobytes.
function bytesToKilobytes(byteCount) {
    return Math.round(byteCount / 1024);
}

// Returns the file extension in capitals, e.g. "report.pdf" gives "PDF".
function getUpperCaseExtension(filename) {
    return filename.split('.').pop().toUpperCase();
}

// Turns a file name like "my_photo-1.png" into readable alt text "my photo 1".
function filenameToAltText(filename) {
    return filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
}

// True when an API response contains a non-empty list under "listName".
function responseHasItems(apiResponse, listName) {
    const itemList = apiResponse[listName];
    return Boolean(apiResponse.ok && itemList && itemList.length);
}

let isImageLibraryLoaded = false;

// Fills the "Library" tab with every uploaded image (once per page view).
async function loadImageLibrary() {
    const libraryGrid = document.getElementById('img-library-grid');
    if (isImageLibraryLoaded) {
        return; // already populated this session
    }
    libraryGrid.innerHTML = '<p class="img-library-empty">Loading&hellip;</p>';

    const apiResponse = await apiFetch('/api/policy/images');
    isImageLibraryLoaded = true;
    if (!responseHasItems(apiResponse, 'images')) {
        libraryGrid.innerHTML = '<p class="img-library-empty">No images uploaded yet.</p>';
        return;
    }

    libraryGrid.innerHTML = '';
    apiResponse.images.forEach(imageRecord => {
        const libraryTile = document.createElement('div');
        libraryTile.className = 'img-library-tile';
        libraryTile.dataset.url = imageRecord.public_url;
        const sizeInKilobytes = bytesToKilobytes(imageRecord.file_size);
        let dimensionsText = '';
        if (imageRecord.width) {
            dimensionsText = `${imageRecord.width}×${imageRecord.height}`;
        }
        let separatorText = '';
        if (dimensionsText && sizeInKilobytes) {
            separatorText = ' · ';
        }
        let sizeText = '';
        if (sizeInKilobytes) {
            sizeText = sizeInKilobytes + ' KB';
        }
        libraryTile.innerHTML = `
            <img src="${imageRecord.public_url}" alt="${imageRecord.filename}" loading="lazy">
            <span class="img-tile-name" title="${imageRecord.filename}">${imageRecord.filename}</span>
            <span class="img-tile-meta">${dimensionsText}${separatorText}${sizeText}</span>`;
        libraryTile.addEventListener('click', () => {
            document.querySelectorAll('.img-library-tile').forEach(tile => tile.classList.remove('selected'));
            libraryTile.classList.add('selected');
            mediaPicker.selectedImageUrl = imageRecord.public_url;
            document.getElementById('img-alt-library').value = filenameToAltText(imageRecord.filename);
            document.getElementById('img-alt-library-group').style.display = '';
            document.getElementById('img-insert-btn').disabled = false;
        });
        libraryGrid.appendChild(libraryTile);
    });
}

/**
 * Fills a document or sound library list with one clickable row per file.
 * "onRowSelected" is called with the chosen file record when a row is clicked.
 */
function renderMediaFileRows(listElement, listSelector, fileRecords, onRowSelected) {
    listElement.innerHTML = '';
    fileRecords.forEach(fileRecord => {
        const fileRow = document.createElement('div');
        fileRow.className = 'media-file-row';
        fileRow.innerHTML = `
            <span class="media-file-ext">${getUpperCaseExtension(fileRecord.filename)}</span>
            <span class="media-file-row-name" title="${fileRecord.filename}">${fileRecord.filename}</span>
            <span class="media-file-row-size">${bytesToKilobytes(fileRecord.file_size)} KB</span>`;
        fileRow.addEventListener('click', () => {
            document.querySelectorAll(`${listSelector} .media-file-row`).forEach(row => row.classList.remove('selected'));
            fileRow.classList.add('selected');
            onRowSelected(fileRecord);
            document.getElementById('img-insert-btn').disabled = false;
        });
        listElement.appendChild(fileRow);
    });
}

let isDocumentLibraryLoaded = false;

// Fills the "Documents" tab with every uploaded document (once per page view).
async function loadDocumentLibrary() {
    const documentList = document.getElementById('doc-library-list');
    if (isDocumentLibraryLoaded) {
        return;
    }
    documentList.innerHTML = '<p class="media-library-empty">Loading&hellip;</p>';
    const apiResponse = await apiFetch('/api/policy/documents');
    isDocumentLibraryLoaded = true;
    if (!responseHasItems(apiResponse, 'documents')) {
        documentList.innerHTML = '<p class="media-library-empty">No documents uploaded yet.</p>';
        return;
    }
    renderMediaFileRows(documentList, '#doc-library-list', apiResponse.documents, documentRecord => {
        mediaPicker.selectedDocumentUrl = documentRecord.public_url;
        mediaPicker.selectedDocumentName = documentRecord.filename;
        mediaPicker.documentFile = null;
        document.getElementById('doc-drop-zone').hidden = false;
        document.getElementById('doc-file-ready').hidden = true;
    });
}

let isSoundLibraryLoaded = false;

// Fills the "Sounds" tab with every uploaded audio file (once per page view).
async function loadSoundLibrary() {
    const soundList = document.getElementById('snd-library-list');
    if (isSoundLibraryLoaded) {
        return;
    }
    soundList.innerHTML = '<p class="media-library-empty">Loading&hellip;</p>';
    const apiResponse = await apiFetch('/api/policy/sounds');
    isSoundLibraryLoaded = true;
    if (!responseHasItems(apiResponse, 'sounds')) {
        soundList.innerHTML = '<p class="media-library-empty">No audio files uploaded yet.</p>';
        return;
    }
    renderMediaFileRows(soundList, '#snd-library-list', apiResponse.sounds, soundRecord => {
        mediaPicker.selectedSoundUrl = soundRecord.public_url;
        mediaPicker.selectedSoundName = soundRecord.filename;
        mediaPicker.soundFile = null;
        document.getElementById('snd-drop-zone').hidden = false;
        document.getElementById('snd-file-ready').hidden = true;
    });
}

// Called when a document file is chosen from disk or dropped onto the drop zone.
function handleDocumentFileSelected(file) {
    if (!file) {
        return;
    }
    mediaPicker.documentFile = file;
    mediaPicker.selectedDocumentUrl = null;
    mediaPicker.selectedDocumentName = null;
    document.querySelectorAll('#doc-library-list .media-file-row').forEach(row => row.classList.remove('selected'));
    document.getElementById('doc-drop-zone').hidden = true;
    document.getElementById('doc-file-ready').hidden = false;
    document.getElementById('doc-file-name').textContent = file.name;
    document.getElementById('doc-file-size').textContent = `${bytesToKilobytes(file.size)} KB`;
    document.getElementById('img-insert-btn').disabled = false;
}

// Called when an audio file is chosen from disk or dropped onto the drop zone.
function handleSoundFileSelected(file) {
    if (!file) {
        return;
    }
    mediaPicker.soundFile = file;
    mediaPicker.selectedSoundUrl = null;
    mediaPicker.selectedSoundName = null;
    document.querySelectorAll('#snd-library-list .media-file-row').forEach(row => row.classList.remove('selected'));
    document.getElementById('snd-drop-zone').hidden = true;
    document.getElementById('snd-file-ready').hidden = false;
    document.getElementById('snd-file-name').textContent = file.name;
    document.getElementById('snd-file-size').textContent = `${bytesToKilobytes(file.size)} KB`;
    document.getElementById('img-insert-btn').disabled = false;
}

// Reads a file and resolves with its contents as base64 text (without the "data:" prefix).
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = () => resolve(fileReader.result.split(',')[1]);
        fileReader.onerror = reject;
        fileReader.readAsDataURL(file);
    });
}

// Describes what kind of player or viewer an embed address will produce.
function getEmbedType(url) {
    if (/\.(mp3|aac|m4a|ogg|wav)(\?.*)?$/i.test(url)) {
        return 'Audio Player';
    }
    if (/\.pdf(\?.*)?$/i.test(url)) {
        return 'PDF Viewer';
    }
    if (url.includes('docs.google.com/document/')) {
        return 'Google Doc';
    }
    if (url.includes('docs.google.com/spreadsheets/')) {
        return 'Google Sheet';
    }
    if (url.includes('docs.google.com/presentation/')) {
        return 'Google Slides';
    }
    return 'Embedded Frame';
}

// Called when an image is chosen for upload: compresses it and shows a preview.
async function handleImageFileSelected(file) {
    if (!file) {
        return;
    }
    document.getElementById('img-drop-zone').hidden = false;
    document.getElementById('img-preview-wrap').hidden = true;
    document.getElementById('img-insert-btn').disabled = true;
    document.getElementById('img-compress-info').textContent = 'Compressing…';
    document.getElementById('img-drop-zone').hidden = true;
    document.getElementById('img-preview-wrap').hidden = false;

    try {
        const compressedImage = await compressImage(file);
        mediaPicker.compressedImage = compressedImage;
        mediaPicker.originalFile = file;
        document.getElementById('img-preview').src = `data:${compressedImage.mimeType};base64,${compressedImage.base64}`;
        document.getElementById('img-alt-upload').value = filenameToAltText(file.name);
        let percentageSaved = 0;
        if (file.size > 0) {
            percentageSaved = Math.round((1 - compressedImage.size / file.size) * 100);
        }
        let compressionInfoText = `${compressedImage.width}×${compressedImage.height} · ${bytesToKilobytes(compressedImage.size)} KB`;
        if (percentageSaved > 5) {
            compressionInfoText += ` (${percentageSaved}% smaller than original)`;
        }
        document.getElementById('img-compress-info').textContent = compressionInfoText;
        document.getElementById('img-insert-btn').disabled = false;
    } catch (compressionError) {
        document.getElementById('img-compress-info').textContent = 'Could not process image.';
    }
}

// Inserts "![alt]{type}(url)" into the editor at the remembered cursor position.
function insertMediaMarkdown(url, altText, mediaType) {
    const textArea = mediaPicker.textArea;
    if (!textArea) {
        return;
    }
    editorSaveState(textArea);
    const mediaMarkdown = `![${altText || ''}]{${mediaType}}(${url})`;
    const insertPosition = mediaPicker.cursorPosition;
    textArea.value = textArea.value.substring(0, insertPosition) + mediaMarkdown + textArea.value.substring(insertPosition);
    textArea.selectionStart = insertPosition + mediaMarkdown.length;
    textArea.selectionEnd = insertPosition + mediaMarkdown.length;
    textArea.focus();
}

// Returns the first file of a file list, or undefined when there is none.
function getFirstFile(fileList) {
    if (fileList && fileList.length > 0) {
        return fileList[0];
    }
    return undefined;
}

/**
 * Makes an element accept dragged-and-dropped files. While a file is dragged
 * over it, the "drag-over" class is added. The dropped file is passed to
 * "onFileDropped" only if "acceptsFile" says it is the right kind of file.
 */
function setupFileDropZone(dropZoneElementId, acceptsFile, onFileDropped) {
    const dropZoneElement = document.getElementById(dropZoneElementId);
    if (!dropZoneElement) {
        return;
    }
    dropZoneElement.addEventListener('dragover', dragEvent => {
        dragEvent.preventDefault();
        dropZoneElement.classList.add('drag-over');
    });
    dropZoneElement.addEventListener('dragleave', () => dropZoneElement.classList.remove('drag-over'));
    dropZoneElement.addEventListener('drop', dropEvent => {
        dropEvent.preventDefault();
        dropZoneElement.classList.remove('drag-over');
        const droppedFile = getFirstFile(dropEvent.dataTransfer.files);
        if (droppedFile && acceptsFile(droppedFile)) {
            onFileDropped(droppedFile);
        }
    });
}

// Connects a "Browse" button to its hidden file input, and the file input to a handler.
function setupFileBrowseButton(browseButtonId, fileInputId, onFileChosen) {
    addListenerIfPresent(browseButtonId, 'click', () => document.getElementById(fileInputId).click());
    addListenerIfPresent(fileInputId, 'change', changeEvent => {
        onFileChosen(getFirstFile(changeEvent.target.files));
        // Clear the input so choosing the same file again still fires "change"
        changeEvent.target.value = '';
    });
}

// Tab switching
document.querySelectorAll('.img-tab-btn').forEach(tabButton => {
    tabButton.addEventListener('click', () => switchMediaPickerTab(tabButton.dataset.tab));
});

// Image browse and drag-and-drop
setupFileBrowseButton('img-browse-btn', 'img-file-input', handleImageFileSelected);
setupFileDropZone('img-drop-zone', file => file.type.startsWith('image/'), handleImageFileSelected);

// Document browse, drop, clear
setupFileBrowseButton('doc-browse-btn', 'doc-file-input', handleDocumentFileSelected);
addListenerIfPresent('doc-file-clear', 'click', () => {
    mediaPicker.documentFile = null;
    document.getElementById('doc-drop-zone').hidden = false;
    document.getElementById('doc-file-ready').hidden = true;
    if (!mediaPicker.selectedDocumentUrl) {
        document.getElementById('img-insert-btn').disabled = true;
    }
});
setupFileDropZone('doc-drop-zone', () => true, handleDocumentFileSelected);

// Embed URL input: show what kind of embed the address will make
addListenerIfPresent('embed-url-input', 'input', inputEvent => {
    const embedUrl = inputEvent.target.value.trim();
    const embedTypeBadge = document.getElementById('embed-type-badge');
    document.getElementById('img-insert-btn').disabled = !embedUrl;
    if (embedUrl) {
        embedTypeBadge.hidden = false;
        embedTypeBadge.textContent = getEmbedType(embedUrl);
    } else {
        embedTypeBadge.hidden = true;
    }
});

// Sound browse, drop, clear
setupFileBrowseButton('snd-browse-btn', 'snd-file-input', handleSoundFileSelected);
addListenerIfPresent('snd-file-clear', 'click', () => {
    mediaPicker.soundFile = null;
    document.getElementById('snd-drop-zone').hidden = false;
    document.getElementById('snd-file-ready').hidden = true;
    if (!mediaPicker.selectedSoundUrl) {
        document.getElementById('img-insert-btn').disabled = true;
    }
});
setupFileDropZone('snd-drop-zone', () => true, handleSoundFileSelected);

// Returns a readable message from an error, or "Unknown" when it has none.
function getErrorMessage(error) {
    if (error && error.message) {
        return error.message;
    }
    return 'Unknown';
}

/**
 * Uploads a document or audio file chosen from disk and inserts it into the
 * editor. Returns true when the upload worked.
 */
async function uploadFileAndInsert(file, uploadEndpoint, mediaType, successMessage) {
    const base64Data = await fileToBase64(file);
    const apiResponse = await apiFetch(uploadEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mime_type: file.type, data: base64Data }),
    });
    if (!apiResponse.ok) {
        showToast(apiResponse.error || 'Upload failed', 'error');
        return false;
    }
    insertMediaMarkdown(apiResponse.url, file.name, mediaType);
    closeModal('image-picker-modal');
    showToast(successMessage, 'success');
    return true;
}

// Picks the file extension that matches a compressed image's MIME type.
function getExtensionForImageMimeType(mimeType) {
    if (mimeType === 'image/webp') {
        return 'webp';
    }
    if (mimeType === 'image/png') {
        return 'png';
    }
    if (mimeType === 'image/gif') {
        return 'gif';
    }
    return 'jpg';
}

/**
 * The media picker's "Insert" button. What it does depends on the open tab:
 * library images, documents, sounds and embeds are inserted directly (after
 * uploading a new file when one was chosen), and the upload tab uploads the
 * compressed image first.
 */
addListenerIfPresent('img-insert-btn', 'click', async () => {
    const activeTabButton = document.querySelector('.img-tab-btn.active');
    let activeTab = undefined;
    if (activeTabButton) {
        activeTab = activeTabButton.dataset.tab;
    }
    const insertButton = document.getElementById('img-insert-btn');

    if (activeTab === 'library') {
        if (!mediaPicker.selectedImageUrl) {
            return;
        }
        const altText = document.getElementById('img-alt-library').value.trim();
        insertMediaMarkdown(mediaPicker.selectedImageUrl, altText, 'img');
        closeModal('image-picker-modal');
        return;
    }

    if (activeTab === 'documents') {
        if (mediaPicker.selectedDocumentUrl) {
            insertMediaMarkdown(mediaPicker.selectedDocumentUrl, mediaPicker.selectedDocumentName, 'doc');
            closeModal('image-picker-modal');
            return;
        }
        if (!mediaPicker.documentFile) {
            return;
        }
        insertButton.disabled = true;
        insertButton.textContent = 'Uploading…';
        try {
            const uploadWorked = await uploadFileAndInsert(mediaPicker.documentFile, '/api/policy/upload-document', 'doc', 'Document uploaded and inserted');
            if (uploadWorked) {
                isDocumentLibraryLoaded = false; // reload the list next time the tab opens
            }
        } catch (uploadError) {
            showToast('Upload error: ' + getErrorMessage(uploadError), 'error');
        } finally {
            insertButton.disabled = false;
            insertButton.textContent = 'Insert';
        }
        return;
    }

    if (activeTab === 'sounds') {
        if (mediaPicker.selectedSoundUrl) {
            insertMediaMarkdown(mediaPicker.selectedSoundUrl, mediaPicker.selectedSoundName, 'audio');
            closeModal('image-picker-modal');
            return;
        }
        if (!mediaPicker.soundFile) {
            return;
        }
        insertButton.disabled = true;
        insertButton.textContent = 'Uploading…';
        try {
            const uploadWorked = await uploadFileAndInsert(mediaPicker.soundFile, '/api/policy/upload-sound', 'audio', 'Audio uploaded and inserted');
            if (uploadWorked) {
                isSoundLibraryLoaded = false; // reload the list next time the tab opens
            }
        } catch (uploadError) {
            showToast('Upload error: ' + getErrorMessage(uploadError), 'error');
        } finally {
            insertButton.disabled = false;
            insertButton.textContent = 'Insert';
        }
        return;
    }

    if (activeTab === 'embeds') {
        const embedUrl = document.getElementById('embed-url-input').value.trim();
        if (!embedUrl) {
            return;
        }
        insertMediaMarkdown(embedUrl, '', 'embed');
        closeModal('image-picker-modal');
        return;
    }

    // Upload tab
    if (!mediaPicker.compressedImage) {
        return;
    }
    insertButton.disabled = true;
    insertButton.textContent = 'Uploading…';

    try {
        const compressedImage = mediaPicker.compressedImage;
        const originalFile = mediaPicker.originalFile;
        const fileExtension = getExtensionForImageMimeType(compressedImage.mimeType);
        const baseName = originalFile.name.replace(/\.[^.]+$/, '');
        const apiResponse = await apiFetch('/api/policy/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename:  `${baseName}.${fileExtension}`,
                mime_type: compressedImage.mimeType,
                data:      compressedImage.base64,
                width:     compressedImage.width,
                height:    compressedImage.height,
            }),
        });

        if (!apiResponse.ok) {
            showToast(apiResponse.error || 'Upload failed', 'error');
            return;
        }

        isImageLibraryLoaded = false; // force reload next time library tab opens

        const altText = document.getElementById('img-alt-upload').value.trim() || baseName.replace(/[_-]/g, ' ');
        insertMediaMarkdown(apiResponse.url, altText, 'img');
        closeModal('image-picker-modal');
        showToast('Image uploaded and inserted', 'success');
    } catch (uploadError) {
        showToast('Upload error: ' + getErrorMessage(uploadError), 'error');
    } finally {
        insertButton.disabled = false;
        insertButton.textContent = 'Insert';
    }
});

// Builds the request headers for an admin API call that sends JSON.
function buildAuthorizedJsonHeaders() {
    const sessionToken = localStorage.getItem('gftv-token');
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` };
}

// Shows an error message in the content editor.
function showContentEditError(errorMessage) {
    const errorElement = document.getElementById('content-edit-error');
    errorElement.textContent = errorMessage;
    errorElement.classList.remove('hidden');
}

/**
 * The editor's "Save" button. In "add" mode it creates a new section,
 * otherwise it updates the section being edited. Afterwards the sidebar is
 * refreshed and the page for the saved section is shown.
 */
addListenerIfPresent('content-edit-save', 'click', async () => {
    const sectionId = document.getElementById('content-edit-id').value;
    const table = document.getElementById('content-edit-table').value;
    const title = document.getElementById('content-edit-title').value.trim();
    const slug = document.getElementById('content-edit-slug').value.trim();
    const number = document.getElementById('content-edit-number').value.trim();
    const anchor = document.getElementById('content-edit-anchor').value.trim();
    const content = document.getElementById('content-edit-content').value;
    const editorMode = document.getElementById('content-edit-mode').value;
    const parentId = document.getElementById('content-edit-parent-id').value;
    document.getElementById('content-edit-error').classList.add('hidden');

    if (!title) {
        showContentEditError('Title cannot be empty');
        return;
    }
    if (!slug) {
        showContentEditError('Slug cannot be empty');
        return;
    }

    if (editorMode === 'add') {
        // A section with a parent is always a subsection; otherwise use the chosen type
        let sectionType = 'subsection';
        if (!parentId) {
            const typeSelect = document.getElementById('content-edit-type');
            sectionType = 'article';
            if (typeSelect && typeSelect.value) {
                sectionType = typeSelect.value;
            }
        }
        const apiResponse = await apiFetch('/api/policy/add-section', {
            method: 'POST',
            body: JSON.stringify({
                table: table,
                title: title,
                slug: slug,
                content: content,
                type: sectionType,
                parent_id: parentId || null,
                number: number || null,
                anchor: anchor || null
            }),
            headers: buildAuthorizedJsonHeaders()
        });
        if (apiResponse.ok) {
            closeModal('content-modal');
            showToast('Section created', 'success');
            documentSectionsCache[currentDocumentKey] = null;
            await loadSections(currentDocumentKey, { force: true });
            navigate(`${DOCUMENT_CONFIG[currentDocumentKey].urlBase}/${apiResponse.section.slug}`);
        } else {
            showContentEditError(apiResponse.error || 'Create failed');
        }
    } else {
        const apiResponse = await apiFetch('/api/policy/update-section', {
            method: 'PUT',
            body: JSON.stringify({
                id: sectionId,
                table: table,
                title: title,
                slug: slug,
                content: content,
                anchor: anchor || null,
                number: number || null
            }),
            headers: buildAuthorizedJsonHeaders()
        });
        if (apiResponse.ok) {
            closeModal('content-modal');
            showToast('Section updated', 'success');
            const editedSection = sections.find(candidate => candidate.id === sectionId);
            if (editedSection) {
                Object.assign(editedSection, apiResponse.section);
            }
            buildSidebar();
            let savedSlug = slug;
            if (apiResponse.section && apiResponse.section.slug) {
                savedSlug = apiResponse.section.slug;
            }
            navigate(`${DOCUMENT_CONFIG[currentDocumentKey].urlBase}/${savedSlug}${location.hash}`, { replace: true });
        } else {
            showContentEditError(apiResponse.error || 'Update failed');
        }
    }
});

/* ─── Move Up / Down ─── */
async function moveSection(direction) {
    const sectionId = document.getElementById('content-edit-id').value;
    const table = document.getElementById('content-edit-table').value;
    const apiResponse = await apiFetch('/api/policy/reorder-section', {
        method: 'PUT',
        body: JSON.stringify({ id: sectionId, table: table, direction: direction }),
        headers: buildAuthorizedJsonHeaders()
    });
    if (apiResponse.ok) {
        closeModal('content-modal');
        showToast('Reordered', 'success');
        documentSectionsCache[currentDocumentKey] = null;
        await loadSections(currentDocumentKey, { force: true });
        navigate(location.pathname + location.hash, { replace: true });
    } else {
        showContentEditError(apiResponse.error || 'Reorder failed');
    }
}

addListenerIfPresent('content-edit-move-up', 'click', () => moveSection('up'));
addListenerIfPresent('content-edit-move-down', 'click', () => moveSection('down'));

/* ─── Delete Section ───
   Clicking "Delete" in the editor remembers which section to delete and
   opens a confirmation dialog; the delete only happens after confirming. */
let pendingDeleteSectionId = null;
let pendingDeleteTable = null;
let pendingDeleteParentId = null;

addListenerIfPresent('content-edit-delete', 'click', () => {
    pendingDeleteSectionId = document.getElementById('content-edit-id').value;
    pendingDeleteTable = document.getElementById('content-edit-table').value;
    pendingDeleteParentId = document.getElementById('content-edit-parent-id').value || null;
    const title = document.getElementById('content-edit-title').value;
    document.getElementById('delete-confirm-message').textContent =
        `Are you sure you want to delete "${title}"? This cannot be undone.`;
    document.getElementById('delete-confirm-error').classList.add('hidden');
    closeModal('content-modal');
    openModal('delete-confirm-modal');
});

addListenerIfPresent('delete-confirm-btn', 'click', async () => {
    if (!pendingDeleteSectionId || !pendingDeleteTable) {
        return;
    }
    const apiResponse = await apiFetch('/api/policy/delete-section', {
        method: 'DELETE',
        body: JSON.stringify({ id: pendingDeleteSectionId, table: pendingDeleteTable }),
        headers: buildAuthorizedJsonHeaders()
    });
    if (apiResponse.ok) {
        closeModal('delete-confirm-modal');
        showToast('Section deleted', 'success');
        documentSectionsCache[currentDocumentKey] = null;
        await loadSections(currentDocumentKey, { force: true });
        const urlBase = DOCUMENT_CONFIG[currentDocumentKey].urlBase;
        // Go back to the parent article if it still exists, otherwise to the document index
        let parentSection = null;
        if (pendingDeleteParentId) {
            parentSection = sections.find(candidate => candidate.id === pendingDeleteParentId);
        }
        if (parentSection) {
            navigate(`${urlBase}/${parentSection.slug}`);
        } else {
            navigate(urlBase);
        }
        pendingDeleteSectionId = null;
        pendingDeleteTable = null;
        pendingDeleteParentId = null;
    } else {
        const deleteErrorElement = document.getElementById('delete-confirm-error');
        deleteErrorElement.textContent = apiResponse.error || 'Delete failed';
        deleteErrorElement.classList.remove('hidden');
    }
});

/* ─── Admin ─── */

// Opens the admin panel (admins only) and wires up its tabs.
async function loadAdmin() {
    if (!currentUser || !currentUser.is_admin) {
        showPage('home');
        showToast('Admin access required', 'error');
        return;
    }
    loadAdminUsers();
    document.querySelectorAll('.tab-btn').forEach(tabButton => {
        tabButton.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(otherButton => otherButton.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tabContent => tabContent.classList.add('hidden'));
            tabButton.classList.add('active');
            const selectedTabContent = document.getElementById(`tab-${tabButton.dataset.tab}`);
            if (selectedTabContent) {
                selectedTabContent.classList.remove('hidden');
            }
            if (tabButton.dataset.tab === 'images') {
                loadAdminImages();
            }
            if (tabButton.dataset.tab === 'documents') {
                loadAdminDocuments();
            }
            if (tabButton.dataset.tab === 'sounds') {
                loadAdminSounds();
            }
        });
    });
}

// Builds the session-token header used by admin API calls.
function buildAuthorizationHeader() {
    const sessionToken = localStorage.getItem('gftv-token');
    return { Authorization: `Bearer ${sessionToken}` };
}

// Builds a green/red/grey "Yes" or "No" badge for the users table.
function buildYesNoBadgeHtml(isYes, noBadgeClass) {
    if (isYes) {
        return '<span class="badge badge-green">Yes</span>';
    }
    return `<span class="badge ${noBadgeClass}">No</span>`;
}

// Fills the admin "Users" table, with Approve / Make Editor buttons where useful.
async function loadAdminUsers() {
    const apiResponse = await apiFetch('/api/admin/users', {
        headers: buildAuthorizationHeader()
    });
    const usersListElement = document.getElementById('admin-users-list');
    if (!apiResponse.ok || !usersListElement) {
        return;
    }
    const users = apiResponse.users || [];
    const userRowsHtml = users.map(user => {
        let approveButtonHtml = '';
        if (!user.is_approved) {
            approveButtonHtml = `<button class="btn btn-sm btn-primary" onclick="approveUser('${user.id}')">Approve</button>`;
        }
        let makeEditorButtonHtml = '';
        if (!user.is_editor) {
            makeEditorButtonHtml = `<button class="btn btn-sm btn-ghost" onclick="makeEditor('${user.id}')">Make Editor</button>`;
        }
        return `<tr>
      <td>${escapeHtmlCharacters(String(user.display_name || ''))}</td><td>@${escapeHtmlCharacters(String(user.username || ''))}</td><td>${escapeHtmlCharacters(String(user.email || ''))}</td>
      <td>${buildYesNoBadgeHtml(user.is_approved, 'badge-red')}</td>
      <td>${buildYesNoBadgeHtml(user.is_admin, 'badge-grey')}</td>
      <td>${buildYesNoBadgeHtml(user.is_editor, 'badge-grey')}</td>
      <td>
        ${approveButtonHtml}
        ${makeEditorButtonHtml}
      </td>
    </tr>`;
    }).join('');
    usersListElement.innerHTML = `<table class="users-table">
    <thead><tr><th>Display Name</th><th>Username</th><th>Email</th><th>Approved</th><th>Admin</th><th>Editor</th><th>Actions</th></tr></thead>
    <tbody>${userRowsHtml}</tbody></table>`;
}

// A short grey status message used while admin lists load.
function buildAdminStatusMessageHtml(messageText) {
    return `<p style="color:var(--text-muted);font-size:0.9rem">${messageText}</p>`;
}

let isAdminImagesLoaded = false;

// Fills the admin "Images" table. Pass true to reload even if already loaded.
async function loadAdminImages(force = false) {
    if (isAdminImagesLoaded && !force) {
        return;
    }
    const imagesListElement = document.getElementById('admin-images-list');
    if (!imagesListElement) {
        return;
    }
    imagesListElement.innerHTML = buildAdminStatusMessageHtml('Loading images…');
    const apiResponse = await apiFetch('/api/policy/images', {
        headers: buildAuthorizationHeader()
    });
    isAdminImagesLoaded = true;
    if (!apiResponse.ok) {
        imagesListElement.innerHTML = buildAdminStatusMessageHtml('Failed to load images.');
        return;
    }
    const images = apiResponse.images || [];
    if (!images.length) {
        imagesListElement.innerHTML = buildAdminStatusMessageHtml('No images uploaded yet.');
        return;
    }
    imagesListElement.innerHTML = `<div class="admin-images-wrap"><table class="admin-images-table">
    <thead><tr><th></th><th>Filename</th><th>Description</th><th>Size</th><th>Uploaded</th><th>Actions</th></tr></thead>
    <tbody>${images.map(buildAdminImageRowHtml).join('')}</tbody></table></div>`;
}

window.copyImageUrl = function (url) {
    navigator.clipboard.writeText(url).then(() => showToast('URL copied to clipboard', 'success'));
};

// Downloads a file and opens it in a new tab from a local "blob:" address.
// Falls back to opening the original address if the download fails.
window.openAsBlob = async function (url, filename) {
    try {
        const fileResponse = await fetch(url);
        const fileBlob = await fileResponse.blob();
        const blobUrl = URL.createObjectURL(fileBlob);
        window.open(blobUrl, '_blank');
    } catch (downloadError) {
        window.open(url, '_blank');
    }
};

// Starts a browser download of a file by clicking a temporary <a download> link.
function clickTemporaryDownloadLink(url, filename) {
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// Downloads a file under the given file name. Going through a blob makes the
// browser save the file instead of opening it, even for files on another site.
window.downloadAsBlob = async function (url, filename) {
    try {
        const fileResponse = await fetch(url);
        const fileBlob = await fileResponse.blob();
        const blobUrl = URL.createObjectURL(fileBlob);
        clickTemporaryDownloadLink(blobUrl, filename);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (downloadError) {
        clickTemporaryDownloadLink(url, filename);
    }
};

// Loads every <audio data-blob-src="..."> inside "container" through a blob
// address, falling back to the original address if that fails.
function initBlobMedia(container) {
    container.querySelectorAll('audio[data-blob-src]').forEach(async audioElement => {
        try {
            const audioUrl = audioElement.dataset.blobSrc;
            const audioResponse = await fetch(audioUrl);
            const audioBlob = await audioResponse.blob();
            audioElement.src = URL.createObjectURL(audioBlob);
        } catch (downloadError) {
            audioElement.src = audioElement.dataset.blobSrc;
        }
    });
}

// Reads the file name shown in the same table row as "button".
function getFilenameFromRow(button, fallbackText) {
    const tableRow = button.closest('tr');
    if (tableRow) {
        const filenameCell = tableRow.querySelector('.admin-img-filename');
        if (filenameCell && filenameCell.textContent) {
            return filenameCell.textContent;
        }
    }
    return fallbackText;
}

/**
 * Sets up a "Delete" button + confirmation dialog for an admin media table
 * (images, documents or sounds).
 *
 * window[globalFunctionName](id, button) is called by the row's Delete
 * button: it remembers the item and opens the confirmation dialog. When the
 * dialog's confirm button is pressed, the item is deleted through the API
 * and its table row is removed.
 */
function setupAdminDeleteConfirmation(options) {
    let pendingItemId = null;
    let pendingDeleteButton = null;

    window[options.globalFunctionName] = function (itemId, deleteButton) {
        const filename = getFilenameFromRow(deleteButton, options.fallbackName);
        document.getElementById(options.filenameElementId).textContent = filename;
        pendingItemId = itemId;
        pendingDeleteButton = deleteButton;
        openModal(options.modalId);
    };

    addListenerIfPresent(options.confirmButtonId, 'click', async () => {
        if (!pendingItemId) {
            return;
        }
        const itemId = pendingItemId;
        const deleteButton = pendingDeleteButton;
        pendingItemId = null;
        pendingDeleteButton = null;
        closeModal(options.modalId);
        deleteButton.disabled = true;
        const requestOptions = { method: 'DELETE' };
        if (options.sendAuthorization) {
            requestOptions.headers = buildAuthorizationHeader();
        }
        const apiResponse = await apiFetch(`${options.deleteEndpoint}?id=${itemId}`, requestOptions);
        if (apiResponse.ok) {
            const tableRow = document.querySelector(`tr[${options.rowIdAttribute}="${itemId}"]`);
            if (tableRow) {
                tableRow.remove();
            }
            showToast(options.successMessage, 'success');
        } else {
            deleteButton.disabled = false;
            showToast(apiResponse.error || 'Failed to delete', 'error');
        }
    });
}

/* ─── Delete Image Modal ─── */
setupAdminDeleteConfirmation({
    globalFunctionName: 'deleteAdminImage',
    fallbackName: 'this image',
    filenameElementId: 'delete-image-filename',
    modalId: 'delete-image-modal',
    confirmButtonId: 'delete-image-confirm',
    deleteEndpoint: '/api/policy/manage-image',
    sendAuthorization: true,
    rowIdAttribute: 'data-img-id',
    successMessage: 'Image deleted',
});

// The grey dash shown when an image has no description.
const EMPTY_DESCRIPTION_HTML = '<em style="color:var(--text-muted);font-style:normal">—</em>';

/**
 * Turns an image's description cell into a text box. Pressing Enter or
 * clicking away saves the new description; pressing Escape cancels.
 */
window.editImageDescription = function (descriptionElement) {
    if (descriptionElement.querySelector('input')) {
        return;
    }
    const imageId = descriptionElement.dataset.id;
    const currentDescription = descriptionElement.dataset.desc || '';
    descriptionElement.innerHTML = `<input class="admin-img-desc-input" type="text" value="${currentDescription.replace(/"/g, '&quot;')}" placeholder="Add description…">`;
    const descriptionInput = descriptionElement.querySelector('input');
    descriptionInput.focus();
    descriptionInput.select();
    let isCancelled = false;

    async function saveDescription() {
        if (isCancelled) {
            return;
        }
        const newDescription = descriptionInput.value.trim();
        descriptionElement.dataset.desc = newDescription;
        descriptionElement.innerHTML = newDescription || EMPTY_DESCRIPTION_HTML;
        const apiResponse = await apiFetch(`/api/policy/manage-image?id=${imageId}`, {
            method: 'PATCH',
            body: JSON.stringify({ description: newDescription || null }),
            headers: buildAuthorizedJsonHeaders()
        });
        if (!apiResponse.ok) {
            showToast('Failed to save description', 'error');
        }
    }

    descriptionInput.addEventListener('blur', saveDescription);
    descriptionInput.addEventListener('keydown', keyboardEvent => {
        if (keyboardEvent.key === 'Enter') {
            keyboardEvent.preventDefault();
            descriptionInput.blur();
        }
        if (keyboardEvent.key === 'Escape') {
            isCancelled = true;
            descriptionElement.innerHTML = descriptionElement.dataset.desc || EMPTY_DESCRIPTION_HTML;
        }
    });
};

/* ─── Admin Documents and Sounds ───
   Both tables have the same columns, so they share one row builder. */

// Builds one table row for an uploaded document or sound.
// "rowIdAttribute" is data-doc-id or data-snd-id; "deleteFunctionName" is the
// global delete function the row's Delete button calls.
function buildAdminFileRowHtml(fileRecord, rowIdAttribute, deleteFunctionName) {
    const sizeInKilobytes = bytesToKilobytes(fileRecord.file_size);
    const fileExtension = getUpperCaseExtension(fileRecord.filename);
    const uploadDate = new Date(fileRecord.uploaded_at).toLocaleDateString();
    return `<tr ${rowIdAttribute}="${fileRecord.id}">
      <td class="admin-img-filename">${fileRecord.filename}</td>
      <td style="color:var(--text-muted);font-size:0.8rem">${fileExtension}</td>
      <td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap">${sizeInKilobytes} KB</td>
      <td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap">${uploadDate}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm btn-ghost" onclick="copyImageUrl('${fileRecord.public_url}')">Copy URL</button>
        <button class="btn btn-sm btn-danger" onclick="${deleteFunctionName}('${fileRecord.id}', this)">Delete</button>
      </td>
    </tr>`;
}

function buildAdminDocumentRowHtml(documentRecord) {
    return buildAdminFileRowHtml(documentRecord, 'data-doc-id', 'deleteAdminDocument');
}

function buildAdminSoundRowHtml(soundRecord) {
    return buildAdminFileRowHtml(soundRecord, 'data-snd-id', 'deleteAdminSound');
}

/**
 * Loads a list of uploaded files from the API and shows them as a table in
 * the admin panel. Used for both the Documents and Sounds tabs.
 */
async function renderAdminFileTable(options) {
    const listElement = document.getElementById(options.listElementId);
    if (!listElement) {
        return false;
    }
    listElement.innerHTML = buildAdminStatusMessageHtml(options.loadingMessage);
    const apiResponse = await apiFetch(options.listEndpoint);
    if (!apiResponse.ok) {
        listElement.innerHTML = buildAdminStatusMessageHtml(options.failureMessage);
        return true;
    }
    const fileRecords = apiResponse[options.responseListName] || [];
    if (!fileRecords.length) {
        listElement.innerHTML = buildAdminStatusMessageHtml(options.emptyMessage);
        return true;
    }
    listElement.innerHTML = `<div class="admin-images-wrap"><table class="admin-images-table">
    <thead><tr><th>Filename</th><th>Type</th><th>Size</th><th>Uploaded</th><th>Actions</th></tr></thead>
    <tbody>${fileRecords.map(options.buildRowHtml).join('')}</tbody></table></div>`;
    return true;
}

let isAdminDocumentsLoaded = false;

// Fills the admin "Documents" table. Pass true to reload even if already loaded.
async function loadAdminDocuments(force = false) {
    if (isAdminDocumentsLoaded && !force) {
        return;
    }
    const listWasFound = await renderAdminFileTable({
        listElementId: 'admin-documents-list',
        listEndpoint: '/api/policy/documents',
        responseListName: 'documents',
        loadingMessage: 'Loading documents…',
        failureMessage: 'Failed to load documents.',
        emptyMessage: 'No documents uploaded yet.',
        buildRowHtml: buildAdminDocumentRowHtml,
    });
    if (listWasFound) {
        isAdminDocumentsLoaded = true;
    }
}

/* ─── Delete Document Modal ─── */
setupAdminDeleteConfirmation({
    globalFunctionName: 'deleteAdminDocument',
    fallbackName: 'this document',
    filenameElementId: 'delete-document-filename',
    modalId: 'delete-document-modal',
    confirmButtonId: 'delete-document-confirm',
    deleteEndpoint: '/api/policy/manage-document',
    sendAuthorization: false,
    rowIdAttribute: 'data-doc-id',
    successMessage: 'Document deleted',
});

/**
 * Connects an admin "Upload" button to its hidden file input. The chosen
 * file is uploaded straight away and a row for it is added to the top of
 * the table (or the whole table is reloaded if it is not shown yet).
 */
function setupAdminFileUpload(options) {
    const fileInput = document.getElementById(options.fileInputId);
    const uploadButton = document.getElementById(options.uploadButtonId);

    if (uploadButton) {
        uploadButton.addEventListener('click', () => {
            if (fileInput) {
                fileInput.click();
            }
        });
    }

    if (!fileInput) {
        return;
    }
    fileInput.addEventListener('change', async changeEvent => {
        const file = getFirstFile(changeEvent.target.files);
        changeEvent.target.value = '';
        if (!file) {
            return;
        }
        uploadButton.disabled = true;
        uploadButton.textContent = 'Uploading…';
        try {
            const base64Data = await fileToBase64(file);
            const apiResponse = await apiFetch(options.uploadEndpoint, {
                method: 'POST',
                headers: buildAuthorizedJsonHeaders(),
                body: JSON.stringify({ filename: file.name, mime_type: file.type, data: base64Data }),
            });
            if (!apiResponse.ok) {
                showToast(apiResponse.error || 'Upload failed', 'error');
                return;
            }
            showToast(options.successMessage, 'success');
            const listElement = document.getElementById(options.listElementId);
            let tableBody = null;
            if (listElement) {
                tableBody = listElement.querySelector('tbody');
            }
            const uploadedRecord = apiResponse[options.responseRecordName];
            if (tableBody && uploadedRecord) {
                tableBody.insertAdjacentHTML('afterbegin', options.buildRowHtml(uploadedRecord));
            } else {
                options.reloadList();
            }
        } finally {
            uploadButton.disabled = false;
            uploadButton.textContent = options.buttonLabel;
        }
    });
}

/* ─── Admin Document Upload ─── */
setupAdminFileUpload({
    fileInputId: 'admin-doc-file-input',
    uploadButtonId: 'admin-doc-upload-btn',
    uploadEndpoint: '/api/policy/upload-document',
    successMessage: 'Document uploaded',
    listElementId: 'admin-documents-list',
    responseRecordName: 'document',
    buildRowHtml: buildAdminDocumentRowHtml,
    buttonLabel: 'Upload Document',
    reloadList: () => {
        isAdminDocumentsLoaded = false;
        loadAdminDocuments();
    },
});

/* ─── Admin Sounds ─── */
let isAdminSoundsLoaded = false;

// Fills the admin "Sounds" table. Pass true to reload even if already loaded.
async function loadAdminSounds(force = false) {
    if (isAdminSoundsLoaded && !force) {
        return;
    }
    const listWasFound = await renderAdminFileTable({
        listElementId: 'admin-sounds-list',
        listEndpoint: '/api/policy/sounds',
        responseListName: 'sounds',
        loadingMessage: 'Loading audio files…',
        failureMessage: 'Failed to load sounds.',
        emptyMessage: 'No audio files uploaded yet.',
        buildRowHtml: buildAdminSoundRowHtml,
    });
    if (listWasFound) {
        isAdminSoundsLoaded = true;
    }
}

/* ─── Delete Sound Modal ─── */
setupAdminDeleteConfirmation({
    globalFunctionName: 'deleteAdminSound',
    fallbackName: 'this audio file',
    filenameElementId: 'delete-sound-filename',
    modalId: 'delete-sound-modal',
    confirmButtonId: 'delete-sound-confirm',
    deleteEndpoint: '/api/policy/manage-sound',
    sendAuthorization: false,
    rowIdAttribute: 'data-snd-id',
    successMessage: 'Audio deleted',
});

/* ─── Admin Sound Upload ─── */
setupAdminFileUpload({
    fileInputId: 'admin-snd-file-input',
    uploadButtonId: 'admin-snd-upload-btn',
    uploadEndpoint: '/api/policy/upload-sound',
    successMessage: 'Sound uploaded',
    listElementId: 'admin-sounds-list',
    responseRecordName: 'sound',
    buildRowHtml: buildAdminSoundRowHtml,
    buttonLabel: 'Upload Sound',
    reloadList: () => {
        isAdminSoundsLoaded = false;
        loadAdminSounds();
    },
});

/* ─── Admin Image Upload ─── */

// Builds one row of the admin "Images" table.
function buildAdminImageRowHtml(imageRecord) {
    const sizeInKilobytes = bytesToKilobytes(imageRecord.file_size);
    let dimensionsHtml = '';
    if (imageRecord.width) {
        dimensionsHtml = `${imageRecord.width}×${imageRecord.height}<br>`;
    }
    const uploadDate = new Date(imageRecord.uploaded_at).toLocaleDateString();
    const escapedDescription = (imageRecord.description || '').replace(/"/g, '&quot;');
    const descriptionHtml = imageRecord.description || EMPTY_DESCRIPTION_HTML;
    return `<tr data-img-id="${imageRecord.id}">
      <td><img class="admin-img-thumb" src="${imageRecord.public_url}" alt="" loading="lazy"></td>
      <td class="admin-img-filename">${imageRecord.filename}</td>
      <td><span class="admin-img-desc" data-id="${imageRecord.id}" data-desc="${escapedDescription}" onclick="editImageDescription(this)">${descriptionHtml}</span></td>
      <td style="color:var(--text-muted);white-space:nowrap;font-size:0.8rem">${dimensionsHtml}${sizeInKilobytes} KB</td>
      <td style="color:var(--text-muted);white-space:nowrap;font-size:0.8rem">${uploadDate}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm btn-ghost" onclick="copyImageUrl('${imageRecord.public_url}')">Copy URL</button>
        <button class="btn btn-sm btn-danger" onclick="deleteAdminImage('${imageRecord.id}', this)">Delete</button>
      </td>
    </tr>`;
}

/**
 * Admin image upload. Choosing a file shows a "staging" strip with a
 * compressed preview and an Upload button; the file is only sent to the
 * server when that Upload button is pressed.
 */
function setupAdminImageUpload() {
    const fileInput = document.getElementById('admin-img-file-input');
    const uploadButton = document.getElementById('admin-img-upload-btn');
    const stagingElement = document.getElementById('admin-img-staging');

    // Hides the staging strip and forgets the chosen file
    function clearStaging() {
        stagingElement.className = 'admin-img-staging hidden';
        stagingElement.innerHTML = '';
    }

    if (uploadButton) {
        uploadButton.addEventListener('click', () => {
            if (fileInput) {
                fileInput.click();
            }
        });
    }

    if (!fileInput) {
        return;
    }
    fileInput.addEventListener('change', async changeEvent => {
        const file = getFirstFile(changeEvent.target.files);
        changeEvent.target.value = '';
        if (!file) {
            return;
        }

        stagingElement.className = 'admin-img-staging';
        stagingElement.innerHTML = `
            <div class="admin-img-staging-thumb"></div>
            <div class="admin-img-staging-info">
                <span class="admin-img-staging-name">${escapeHtmlCharacters(file.name)}</span>
                <span class="admin-img-staging-meta">Compressing…</span>
            </div>
            <button class="btn btn-sm btn-primary" id="admin-img-staging-go" disabled>Upload</button>
            <button class="btn btn-sm btn-ghost" id="admin-img-staging-cancel">Cancel</button>`;

        document.getElementById('admin-img-staging-cancel').addEventListener('click', clearStaging);

        try {
            const compressedImage = await compressImage(file);
            const thumbnailContainer = stagingElement.querySelector('.admin-img-staging-thumb');
            thumbnailContainer.innerHTML = `<img src="data:${compressedImage.mimeType};base64,${compressedImage.base64}" alt="">`;
            let percentageSaved = 0;
            if (file.size > 0) {
                percentageSaved = Math.round((1 - compressedImage.size / file.size) * 100);
            }
            let compressionInfoText = `${compressedImage.width}×${compressedImage.height} · ${bytesToKilobytes(compressedImage.size)} KB`;
            if (percentageSaved > 5) {
                compressionInfoText += ` (${percentageSaved}% smaller)`;
            }
            stagingElement.querySelector('.admin-img-staging-meta').textContent = compressionInfoText;

            const confirmUploadButton = document.getElementById('admin-img-staging-go');
            confirmUploadButton.disabled = false;
            confirmUploadButton.addEventListener('click', async () => {
                confirmUploadButton.disabled = true;
                confirmUploadButton.textContent = 'Uploading…';
                const fileExtension = getExtensionForImageMimeType(compressedImage.mimeType);
                const baseName = file.name.replace(/\.[^.]+$/, '');
                const apiResponse = await apiFetch('/api/policy/upload-image', {
                    method: 'POST',
                    headers: buildAuthorizedJsonHeaders(),
                    body: JSON.stringify({
                        filename:  `${baseName}.${fileExtension}`,
                        mime_type: compressedImage.mimeType,
                        data:      compressedImage.base64,
                        width:     compressedImage.width,
                        height:    compressedImage.height,
                    }),
                });
                if (!apiResponse.ok) {
                    showToast(apiResponse.error || 'Upload failed', 'error');
                    confirmUploadButton.disabled = false;
                    confirmUploadButton.textContent = 'Upload';
                    return;
                }
                showToast('Image uploaded', 'success');
                clearStaging();
                isImageLibraryLoaded = false; // invalidate image picker library cache

                // Prepend row to admin table, or rebuild if table doesn't exist yet
                const imagesListElement = document.getElementById('admin-images-list');
                let tableBody = null;
                if (imagesListElement) {
                    tableBody = imagesListElement.querySelector('tbody');
                }
                if (tableBody && apiResponse.image) {
                    tableBody.insertAdjacentHTML('afterbegin', buildAdminImageRowHtml(apiResponse.image));
                } else {
                    isAdminImagesLoaded = false;
                    loadAdminImages();
                }
            });
        } catch (compressionError) {
            stagingElement.querySelector('.admin-img-staging-meta').textContent = 'Could not process image.';
        }
    });
}
setupAdminImageUpload();

// Changes one role flag on a user (for example is_approved or is_editor),
// then reloads the admin panel.
async function updateUserFlag(userId, flagName, successMessage) {
    const requestBody = { id: userId };
    requestBody[flagName] = true;
    const apiResponse = await apiFetch('/api/admin/users', {
        method: 'PUT',
        body: JSON.stringify(requestBody),
        headers: buildAuthorizedJsonHeaders()
    });
    if (apiResponse.ok) {
        showToast(successMessage, 'success');
        loadAdmin();
    } else {
        showToast(apiResponse.error || 'Failed', 'error');
    }
}

window.approveUser = async function (userId) {
    await updateUserFlag(userId, 'is_approved', 'User approved');
};

window.makeEditor = async function (userId) {
    await updateUserFlag(userId, 'is_editor', 'Editor role granted');
};

/* ─── Modals ─── */
function openModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
        modalElement.hidden = false;
        modalElement.removeAttribute('hidden');
    }
}

function closeModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
        modalElement.hidden = true;
    }
    // The sign-in dialog always reopens on its first step
    if (modalId === 'auth-modal') {
        showLoginStep();
    }
}

// Close buttons: either name their modal in data-close, or close the modal they sit in
document.querySelectorAll('.modal-close, [data-close]').forEach(closeButton => {
    closeButton.addEventListener('click', () => {
        let targetModalId = closeButton.dataset.close;
        if (!targetModalId) {
            const parentOverlay = closeButton.closest('.modal-overlay');
            if (parentOverlay) {
                targetModalId = parentOverlay.id;
            }
        }
        if (targetModalId) {
            closeModal(targetModalId);
        }
    });
});

// Clicking the dark area around a modal closes it
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', clickEvent => {
        if (clickEvent.target === overlay) {
            closeModal(overlay.id);
        }
    });
});

/* ─── Image click → open as blob in new tab (hides storage URL) ─── */
document.addEventListener('click', async clickEvent => {
    const clickedImage = clickEvent.target.closest('.section-img, .section-img-figure img');
    if (!clickedImage) {
        return;
    }
    try {
        const imageResponse = await fetch(clickedImage.src);
        const imageBlob = await imageResponse.blob();
        const blobUrl = URL.createObjectURL(imageBlob);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (downloadError) {
        window.open(clickedImage.src, '_blank');
    }
});

/* ─── Toast ─── */

// SVG drawings used inside toast messages
const TOAST_SUCCESS_ICON = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" stroke-width="2"/><polyline points="22,4 12,14.01 9,11.01" stroke="currentColor" stroke-width="2"/>';
const TOAST_ERROR_ICON = '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/>';

// Shows a short pop-up message in the corner for three seconds.
// "toastType" is 'success', 'error', 'info' or '' and only changes the styling.
function showToast(message, toastType = '') {
    const toastContainer = document.getElementById('toast-container');
    const toastElement = document.createElement('div');
    toastElement.className = `toast ${toastType}`;
    let iconSvg = TOAST_ERROR_ICON;
    if (toastType === 'success') {
        iconSvg = TOAST_SUCCESS_ICON;
    }
    toastElement.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">${iconSvg}</svg>${message}`;
    toastContainer.appendChild(toastElement);
    setTimeout(() => {
        toastElement.classList.add('out');
        setTimeout(() => toastElement.remove(), 300);
    }, 3000);
}

/* ─── Top chrome offset ───
   The official bar and the update notice sit above the sticky header and
   scroll away with the page. The sidebar is fixed, so it hangs from wherever
   the header currently ends rather than from a hardcoded 60px. */
(function trackChromeBottom() {
    const siteHeader = document.getElementById('site-header');
    if (!siteHeader) {
        return;
    }
    // True while an update is already queued for the next animation frame
    let isUpdateQueued = false;

    function updateChromeBottom() {
        isUpdateQueued = false;
        const headerBottom = Math.max(0, Math.round(siteHeader.getBoundingClientRect().bottom));
        document.documentElement.style.setProperty('--chrome-bottom', headerBottom + 'px');
    }

    // Many scroll events can fire per frame; only measure once per frame
    function requestChromeUpdate() {
        if (isUpdateQueued) {
            return;
        }
        isUpdateQueued = true;
        requestAnimationFrame(updateChromeBottom);
    }

    window.addEventListener('scroll', requestChromeUpdate, { passive: true });
    window.addEventListener('resize', requestChromeUpdate);
    if ('ResizeObserver' in window) {
        const bodyResizeObserver = new ResizeObserver(requestChromeUpdate);
        bodyResizeObserver.observe(document.body);
    }
    updateChromeBottom();
})();

/* ─── Service worker and the update notice ───
   A new worker never activates on its own. It downloads, installs, and waits;
   the only thing that promotes it is a person pressing Reload. See
   update-bar-spec.md. */
const SERVICE_WORKER_URL = '/sw.js';
const UPDATE_NOTICE_TEXT = {
    label:  'Update',
    ready:  'A new version of GFTV PolicySpot is ready.',
    reload: 'Reload',
    later:  'Not now',
};

let serviceWorkerRegistration = null;
let waitingServiceWorker = null;
let isReloadingForUpdate = false;
let isUpdateNoticeDismissed = false; // this page view only, never stored

/**
 * Shows the "A new version is ready" bar when a new service worker is
 * waiting, or removes the bar when there is none or the reader chose "Not now".
 */
function renderUpdateNotice() {
    const existingNotice = document.querySelector('.update-notice');

    if (!waitingServiceWorker || isUpdateNoticeDismissed) {
        if (existingNotice) {
            existingNotice.remove();
        }
        return;
    }

    let noticeBar = existingNotice;
    if (!noticeBar) {
        noticeBar = document.createElement('div');
    }
    noticeBar.className = 'update-notice';
    noticeBar.setAttribute('role', 'status');
    noticeBar.setAttribute('aria-label', UPDATE_NOTICE_TEXT.label);
    noticeBar.textContent = '';

    const noticeInner = document.createElement('div');
    noticeInner.className = 'update-notice-inner';

    const noticeText = document.createElement('p');
    noticeText.textContent = UPDATE_NOTICE_TEXT.ready;

    const reloadButton = document.createElement('button');
    reloadButton.type = 'button';
    reloadButton.className = 'btn btn-primary btn-sm';
    reloadButton.setAttribute('data-sw-update', '');
    reloadButton.textContent = UPDATE_NOTICE_TEXT.reload;
    reloadButton.addEventListener('click', () => {
        // The only place anything asks for skipWaiting. The reload happens on
        // controllerchange, not here.
        if (waitingServiceWorker) {
            waitingServiceWorker.postMessage('skip-waiting');
        }
    });

    const laterButton = document.createElement('button');
    laterButton.type = 'button';
    laterButton.className = 'btn btn-ghost btn-sm';
    laterButton.setAttribute('data-sw-later', '');
    laterButton.textContent = UPDATE_NOTICE_TEXT.later;
    laterButton.addEventListener('click', () => {
        isUpdateNoticeDismissed = true;
        renderUpdateNotice();
    });

    noticeInner.append(noticeText, reloadButton, laterButton);
    noticeBar.append(noticeInner);

    if (!existingNotice) {
        // Under the permanent official bar, above the header.
        const officialBar = document.getElementById('officialBar');
        if (officialBar) {
            officialBar.after(noticeBar);
        } else {
            document.body.prepend(noticeBar);
        }
    }
}

// Watches the service worker registration for a new version being installed.
function watchForServiceWorkerUpdate() {
    if (!serviceWorkerRegistration) {
        return;
    }

    // A worker already waiting when the page opened. This is the ordinary
    // case on the second page view after a deploy.
    if (serviceWorkerRegistration.waiting && navigator.serviceWorker.controller) {
        waitingServiceWorker = serviceWorkerRegistration.waiting;
        renderUpdateNotice();
    }

    serviceWorkerRegistration.addEventListener('updatefound', () => {
        const installingWorker = serviceWorkerRegistration.installing;
        if (!installingWorker) {
            return;
        }
        installingWorker.addEventListener('statechange', () => {
            // `installed` with a controller present means an update.
            // `installed` with no controller is a first install, which has
            // nothing to prompt about.
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                waitingServiceWorker = serviceWorkerRegistration.waiting || installingWorker;
                renderUpdateNotice();
            }
        });
    });
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    navigator.serviceWorker
        .register(SERVICE_WORKER_URL)
        .then(registration => {
            serviceWorkerRegistration = registration;
            watchForServiceWorkerUpdate();
        })
        .catch(registrationError => {
            // A refused registration is not a reason to break the page.
            console.warn('service worker registration failed:', registrationError);
        });

    // The swap, once somebody has accepted it. The controller has changed by
    // this point, so the reload is served by the new worker. The flag guards
    // against a second controllerchange starting a reload loop.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (isReloadingForUpdate) {
            return;
        }
        isReloadingForUpdate = true;
        window.location.reload();
    });
}

// Registration on `load`, not immediately: installing fetches everything the
// worker precaches, and starting that while the page is still fetching its
// own assets makes a first visit slower for no gain.
if (document.readyState === 'complete') {
    registerServiceWorker();
} else {
    window.addEventListener('load', registerServiceWorker, { once: true });
}

/* ─── API Helper ─── */

/**
 * Calls one of the site's API endpoints and returns the parsed JSON reply.
 * The saved session token is sent automatically unless the caller already
 * set an Authorization header. Network failures never throw; they return
 * { ok: false, error: 'Network error' } instead.
 */
async function apiFetch(url, options = {}) {
    const sessionToken = localStorage.getItem('gftv-token');
    const requestHeaders = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    if (sessionToken && !requestHeaders['Authorization']) {
        requestHeaders['Authorization'] = `Bearer ${sessionToken}`;
    }
    try {
        const httpResponse = await fetch(API_BASE_URL + url, {
            ...options,
            headers: requestHeaders
        });
        return await httpResponse.json();
    } catch (networkError) {
        return {
            ok: false,
            error: 'Network error'
        };
    }
}

/* ─── Search ─── */

// Downloads a document's section list into the cache if it is not there yet,
// so the search can look inside every document.
async function prefetchSections(documentKey) {
    if (documentSectionsCache[documentKey]) {
        return;
    }
    try {
        const apiResponse = await apiFetch(DOCUMENT_CONFIG[documentKey].apiSections);
        if (apiResponse.ok) {
            documentSectionsCache[documentKey] = apiResponse.sections || [];
        }
    } catch (fetchError) {
        // search simply covers fewer documents
    }
}

async function openSearch() {
    openModal('search-modal');
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
        renderSearchResults('');
        searchInput.focus();
    }
    await Promise.all(Object.keys(DOCUMENT_CONFIG).map(prefetchSections));
    // The reader may have started typing while the documents downloaded
    let currentQuery = '';
    const searchInputAfterLoading = document.getElementById('search-input');
    if (searchInputAfterLoading) {
        currentQuery = searchInputAfterLoading.value || '';
    }
    renderSearchResults(currentQuery);
}

function closeSearch() {
    closeModal('search-modal');
}

// Removes Markdown symbols so the text can be searched and shown as plain text.
function stripMarkdown(markdownText) {
    return markdownText
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/#{1,6}\s/g, '')
        .replace(/[*_~`>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Returns a short piece of "text" around the first place "query" appears,
 * with "…" added where text was cut off. If the query is not found, the
 * start of the text is returned instead.
 */
function extractSnippet(text, query, maximumLength = 140) {
    const matchIndex = text.toLowerCase().indexOf(query.toLowerCase());
    if (matchIndex === -1) {
        let snippet = text.slice(0, maximumLength);
        if (text.length > maximumLength) {
            snippet += '…';
        }
        return snippet;
    }
    const snippetStart = Math.max(0, matchIndex - 40);
    const snippetEnd = Math.min(text.length, matchIndex + query.length + 100);
    let snippet = text.slice(snippetStart, snippetEnd);
    if (snippetStart > 0) {
        snippet = '…' + snippet;
    }
    if (snippetEnd < text.length) {
        snippet = snippet + '…';
    }
    return snippet;
}

/**
 * Builds the list of everything the search can find: the main site pages
 * plus every section of every document that has been loaded.
 */
function getSearchIndex() {
    const searchItems = [
        { title: 'Home', subtitle: 'PolicySpot', href: '/', type: 'page', content: '' },
    ];
    SITE_PAGES.forEach(sitePage => {
        searchItems.push({ title: sitePage.label, subtitle: 'Page', href: sitePage.href, type: 'page', content: '' });
    });
    for (const [documentKey, documentSections] of Object.entries(documentSectionsCache)) {
        const documentConfig = DOCUMENT_CONFIG[documentKey];
        documentSections.forEach(section => {
            if (section.type === 'subsection') {
                // Subsections live on their parent article's page, under an anchor
                const parentSection = documentSections.find(candidate => candidate.id === section.parent_id);
                let parentSlug = '';
                if (parentSection && parentSection.slug) {
                    parentSlug = parentSection.slug;
                }
                searchItems.push({
                    title: section.title,
                    subtitle: documentConfig.label,
                    href: `${documentConfig.urlBase}/${parentSlug}#${section.slug || section.id}`,
                    type: 'section',
                    content: section.content || ''
                });
            } else {
                searchItems.push({
                    title: section.title,
                    subtitle: documentConfig.label,
                    href: `${documentConfig.urlBase}/${section.slug}`,
                    type: 'section',
                    content: section.content || ''
                });
            }
        });
    }
    return searchItems;
}

const PAGE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" stroke-width="2"/><polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2"/></svg>`;
const SECTION_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><line x1="8" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="3" y1="6" x2="3.01" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="3" y1="12" x2="3.01" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="3" y1="18" x2="3.01" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

// Builds one clickable search result. A snippet of matching text is shown
// when the query was found in the item's content.
function buildResultItem(searchItem, resultIndex, query) {
    const resultButton = document.createElement('button');
    resultButton.className = 'search-result-item';
    resultButton.dataset.index = resultIndex;
    let snippetHtml = '';
    if (query && searchItem.content) {
        const plainText = stripMarkdown(searchItem.content);
        if (plainText.toLowerCase().includes(query.toLowerCase())) {
            snippetHtml = `<span class="search-result-snippet">${extractSnippet(plainText, query)}</span>`;
        }
    }
    let iconSvg = SECTION_ICON;
    if (searchItem.type === 'page') {
        iconSvg = PAGE_ICON;
    }
    resultButton.innerHTML = `
        <span class="search-result-icon">${iconSvg}</span>
        <span class="search-result-text">
            <span class="search-result-title">${searchItem.title}</span>
            <span class="search-result-sub">${searchItem.subtitle}</span>
            ${snippetHtml}
        </span>`;
    resultButton.addEventListener('click', () => {
        closeSearch();
        navigate(searchItem.href);
    });
    return resultButton;
}

/**
 * Shows the search results for "query": up to 12 items whose title,
 * document name or content contain the query. With an empty query, the
 * main site pages are listed instead.
 */
function renderSearchResults(query) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) {
        return;
    }
    const normalisedQuery = query.trim().toLowerCase();
    const searchIndex = getSearchIndex();
    let results = [];
    if (normalisedQuery) {
        results = searchIndex.filter(searchItem => {
            if (searchItem.title.toLowerCase().includes(normalisedQuery)) {
                return true;
            }
            if (searchItem.subtitle.toLowerCase().includes(normalisedQuery)) {
                return true;
            }
            if (searchItem.content && stripMarkdown(searchItem.content).toLowerCase().includes(normalisedQuery)) {
                return true;
            }
            return false;
        }).slice(0, 12);
    } else {
        results = searchIndex.filter(searchItem => searchItem.type === 'page');
    }
    resultsContainer.innerHTML = '';
    if (normalisedQuery && !results.length) {
        resultsContainer.innerHTML = `<div class="search-empty">No results for "<strong>${escapeHtmlCharacters(query)}</strong>"</div>`;
        return;
    }
    results.forEach((searchItem, resultIndex) => {
        resultsContainer.appendChild(buildResultItem(searchItem, resultIndex, query.trim()));
    });
}

// Moves the keyboard highlight to the search result at "highlightIndex".
function highlightSearchResult(resultItems, highlightIndex) {
    resultItems.forEach((resultItem, itemIndex) => {
        resultItem.classList.toggle('focused', itemIndex === highlightIndex);
    });
    const highlightedItem = resultItems[highlightIndex];
    if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: 'nearest' });
    }
}

// Where each header link (by its data-page value) goes.
const NAV_LINK_DESTINATIONS = {
    home: '/',
    charter: '/the-charter',
    news: '/news',
    prs: '/prs',
    rules: '/rules',
    join: '/join-us',
    about: '/about',
};

/**
 * Connects all of the page's fixed buttons and links once the page has
 * loaded: theme picker, search, sidebar, header navigation, home page cards
 * and the copy toolbar.
 */
function setupEventListeners() {
    addListenerIfPresent('theme-btn', 'click', () => openModal('theme-modal'));

    // Delegated theme pickers, modal stays open so combinations can be tried
    addListenerIfPresent('theme-grid', 'click', clickEvent => {
        const swatch = clickEvent.target.closest('.theme-swatch');
        if (swatch) {
            applyColorTheme(swatch.dataset.colorTheme);
        }
    });
    addListenerIfPresent('mode-toggle', 'click', clickEvent => {
        const modeButton = clickEvent.target.closest('.mode-btn');
        if (modeButton) {
            applyMode(modeButton.dataset.mode);
        }
    });

    addListenerIfPresent('search-btn', 'click', openSearch);
    addListenerIfPresent('sidebar-search-btn', 'click', () => {
        closeSidebar();
        openSearch();
    });
    addListenerIfPresent('menu-btn', 'click', toggleSidebar);
    addListenerIfPresent('sidebar-close', 'click', closeSidebar);
    addListenerIfPresent('sidebar-overlay', 'click', closeSidebar);
    addListenerIfPresent('login-btn', 'click', () => openModal('auth-modal'));

    addListenerIfPresent('search-input', 'input', inputEvent => renderSearchResults(inputEvent.target.value));

    // Arrow keys move through the results, Enter opens one, Escape closes the search
    addListenerIfPresent('search-input', 'keydown', keyboardEvent => {
        const resultItems = document.querySelectorAll('.search-result-item');
        const focusedItem = document.querySelector('.search-result-item.focused');
        let highlightIndex = -1;
        if (focusedItem) {
            highlightIndex = parseInt(focusedItem.dataset.index);
        }
        if (keyboardEvent.key === 'Escape') {
            closeSearch();
            return;
        }
        if (keyboardEvent.key === 'ArrowDown') {
            keyboardEvent.preventDefault();
            highlightIndex = Math.min(highlightIndex + 1, resultItems.length - 1);
            highlightSearchResult(resultItems, highlightIndex);
        } else if (keyboardEvent.key === 'ArrowUp') {
            keyboardEvent.preventDefault();
            highlightIndex = Math.max(highlightIndex - 1, 0);
            highlightSearchResult(resultItems, highlightIndex);
        } else if (keyboardEvent.key === 'Enter') {
            const highlightedItem = document.querySelector('.search-result-item.focused');
            if (highlightedItem) {
                highlightedItem.click();
            }
        }
    });

    document.querySelectorAll('.nav-link').forEach(navLink => {
        navLink.addEventListener('click', clickEvent => {
            clickEvent.preventDefault();
            const destinationPath = NAV_LINK_DESTINATIONS[navLink.dataset.page];
            if (destinationPath) {
                navigate(destinationPath);
            }
        });
    });

    // Hero / static links with data-navlink
    document.querySelectorAll('[data-navlink]').forEach(navigationLink => {
        navigationLink.addEventListener('click', clickEvent => {
            const linkHref = navigationLink.getAttribute('href');
            if (linkHref && linkHref.startsWith('/')) {
                clickEvent.preventDefault();
                navigate(linkHref);
            }
        });
    });

    // Home page document cards
    document.querySelectorAll('.home-doc-card').forEach(documentCard => {
        const openCard = () => navigate(documentCard.dataset.href);
        documentCard.addEventListener('click', openCard);
        documentCard.addEventListener('keydown', keyboardEvent => {
            if (keyboardEvent.key === 'Enter') {
                openCard();
            }
        });
    });

    setupCopyDropdown();
}

/* ─── PWA ─── */
// The service worker is registered, and the controllerchange reload listener
// is set up, in registerServiceWorker() above.
