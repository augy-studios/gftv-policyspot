// Official site bar: the expand and collapse control for the panel that
// teaches a reader how to check a GFTV domain. See gftv-official.md.
//
// The bar itself is permanent and never dismissible; the only thing stored is
// whether the reader has opened the panel, so they are not made to open it
// again. Shared by every page on the site, so it stays out of script.js.
(function () {
    var STORAGE_KEY = 'gftv-policyspot.officialBar';
    var DURATION = 220; // matches the CSS transition, with a little slack

    var toggle = document.getElementById('officialBarToggle');
    var panel = document.getElementById('officialBarPanel');
    if (!toggle || !panel) return;

    var closeTimer = null;

    function remember(open) {
        try {
            if (open) localStorage.setItem(STORAGE_KEY, 'open');
            else localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            // storage blocked, the bar still works for this page view
        }
    }

    function setOpen(open, animate) {
        if (closeTimer !== null) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');

        if (open) {
            panel.hidden = false;
            if (animate) {
                // Two frames so the collapsed row height is painted before
                // the transition to the open one starts.
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () { panel.classList.add('open'); });
                });
            } else {
                panel.classList.add('open');
            }
            return;
        }

        panel.classList.remove('open');
        if (animate) {
            // `hidden` lands after the row has collapsed, so the panel leaves
            // the accessibility tree rather than merely going invisible.
            closeTimer = setTimeout(function () {
                closeTimer = null;
                panel.hidden = true;
            }, DURATION + 40);
        } else {
            panel.hidden = true;
        }
    }

    var remembered = false;
    try { remembered = localStorage.getItem(STORAGE_KEY) === 'open'; } catch (e) { }
    setOpen(remembered, false);

    toggle.addEventListener('click', function () {
        var open = toggle.getAttribute('aria-expanded') !== 'true';
        setOpen(open, true);
        remember(open);
    });
})();
