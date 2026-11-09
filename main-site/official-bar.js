// Official site bar: the expand and collapse control for the panel that
// teaches a reader how to check a GFTV domain. See gftv-official.md.
//
// The bar itself is permanent and never dismissible; the only thing stored is
// whether the reader has opened the panel, so they are not made to open it
// again. Shared by every page on the site, so it stays out of script.js.
(function () {
    var STORAGE_KEY = 'gftv-policyspot.officialBar';
    var ANIMATION_DURATION_IN_MILLISECONDS = 220; // matches the CSS transition, with a little slack

    var toggleButton = document.getElementById('officialBarToggle');
    var panel = document.getElementById('officialBarPanel');
    if (!toggleButton || !panel) {
        return;
    }

    var closeTimer = null;

    // Saves whether the panel is open so it can be restored on the next visit.
    function rememberOpenState(isOpen) {
        try {
            if (isOpen) {
                localStorage.setItem(STORAGE_KEY, 'open');
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch (storageError) {
            // storage blocked, the bar still works for this page view
        }
    }

    // Opens or closes the panel, with or without the sliding animation.
    function setOpen(isOpen, shouldAnimate) {
        if (closeTimer !== null) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }
        if (isOpen) {
            toggleButton.setAttribute('aria-expanded', 'true');
        } else {
            toggleButton.setAttribute('aria-expanded', 'false');
        }

        if (isOpen) {
            panel.hidden = false;
            if (shouldAnimate) {
                // Two frames so the collapsed row height is painted before
                // the transition to the open one starts.
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        panel.classList.add('open');
                    });
                });
            } else {
                panel.classList.add('open');
            }
            return;
        }

        panel.classList.remove('open');
        if (shouldAnimate) {
            // `hidden` lands after the row has collapsed, so the panel leaves
            // the accessibility tree rather than merely going invisible.
            closeTimer = setTimeout(function () {
                closeTimer = null;
                panel.hidden = true;
            }, ANIMATION_DURATION_IN_MILLISECONDS + 40);
        } else {
            panel.hidden = true;
        }
    }

    var wasOpenLastTime = false;
    try {
        wasOpenLastTime = localStorage.getItem(STORAGE_KEY) === 'open';
    } catch (storageError) {
        // storage blocked, start with the panel closed
    }
    setOpen(wasOpenLastTime, false);

    toggleButton.addEventListener('click', function () {
        var shouldOpen = toggleButton.getAttribute('aria-expanded') !== 'true';
        setOpen(shouldOpen, true);
        rememberOpenState(shouldOpen);
    });
})();
