/* ============================================================
   ROUTER.JS — SPA Hash-based Client-Side Router
   ============================================================ */

const SpaRouter = (() => {
  let currentRoute = null;
  let routes = {};

  // --- Route Registry ---
  function register(name, config) {
    routes[name] = config;
    // config = { title, templateFn, initFn, destroyFn, sidebarVisible, navId }
  }

  // --- Navigate ---
  function navigate(route, params) {
    if (params) {
      // Store params in sessionStorage for cross-route data
      Object.entries(params).forEach(([k, v]) => setSessionParam(k, v));
    }

    let targetBaseRoute = route.split('?')[0];

    const currentRawHash = window.cm_currentRawHash || 'home';

    // Check unsaved changes guard (Programmatic navigation)
    if (window.adminIsDirty && typeof isAdminFormOpen === 'function' && isAdminFormOpen() && currentRawHash !== route) {
      showUnsavedConfirm(
        () => { window.adminIsDirty = false; navigate(route, params); },
        () => {
          if (window.saveCurrentAdminForm) {
            const success = window.saveCurrentAdminForm({ silent: true });
            if (success === false) return;
          }
          window.adminIsDirty = false;
          navigate(route, params);
        }
      );
      return;
    }

    window.location.hash = '#/' + route;
  }

  // --- Handle hash change ---
  function handleRoute() {
    let rawHash = window.location.hash.replace(/^#\/?/, '') || 'home';
    let hash = rawHash.split('?')[0]; // Strip query parameters for route lookup

    const isAnalyticsRoute = hash === 'analytics' || hash.startsWith('analytics-');
    if (!isAnalyticsRoute && hash !== 'solution' && hash !== 'notes-practice') {
      if (typeof window.flushActiveAnalyticsState === 'function') {
        window.flushActiveAnalyticsState();
      }
    }

    if (hash !== 'solution' && !hash.startsWith('analytics-')) {
      if (typeof window.clearAnalyticsScrollPositions === 'function') {
        window.clearAnalyticsScrollPositions();
      }
    }

    const currentRawHash = window.cm_currentRawHash || 'home';

    // Native Back/Forward button intercept for unsaved changes
    if (window.adminIsDirty && typeof isAdminFormOpen === 'function' && isAdminFormOpen() && currentRawHash !== rawHash) {
      // Capture where the user was trying to go
      const targetHash = window.location.hash;

      // Temporarily detach listener and revert URL to keep the user on the current screen
      window.removeEventListener('hashchange', handleRoute);
      window.location.hash = '#/' + currentRawHash;

      // Re-attach listener after the event loop clears
      setTimeout(() => {
        window.addEventListener('hashchange', handleRoute);
      }, 0);

      // Trigger the modal
      showUnsavedConfirm(
        () => {
          window.adminIsDirty = false;
          window.location.hash = targetHash; // Proceed to target
        },
        () => {
          if (window.saveCurrentAdminForm) {
            const success = window.saveCurrentAdminForm({ silent: true });
            if (success === false) return; // Cancel navigation if save fails
          }
          window.adminIsDirty = false;
          window.location.hash = targetHash; // Proceed to target
        }
      );
      return; // Abort the current routing cycle
    }

    const routeConfig = routes[hash];

    if (!routeConfig) {
      // Fallback to home if route doesn't exist
      window.location.hash = '#/home';
      return;
    }

    // Teardown previous route
    if (currentRoute && routes[currentRoute] && routes[currentRoute].destroyFn) {
      try { routes[currentRoute].destroyFn(); } catch (e) { console.error('[Router] Destroy error:', e); }
    }

    currentRoute = hash;

    // Update document title
    document.title = routeConfig.title || 'StudySession Pro';

    // Toggle sidebar visibility
    const sidebar = document.querySelector('.app-sidebar');
    const spaContent = document.getElementById('spa-content');
    const focused = routeConfig.sidebarVisible === false;
    if (sidebar) {
      sidebar.style.display = focused ? 'none' : '';
    }
    // Focused routes are the attempt/result screens (practice, practice-set,
    // solution, notebook session…). Flagging them on <body> lets chrome that
    // belongs to the app shell — the settings FAB — stay out of an attempt.
    document.body.classList.toggle('route-focused', focused);
    document.body.dataset.route = hash;

    // Close mobile sidebar overlay on every navigation (before the transition
    // snapshot so the sidebar isn't animated).
    if (typeof closeMobileSidebar === 'function') closeMobileSidebar();

    // The full render+init sequence runs as one unit so that, when wrapped in a
    // View Transition (whose update callback is async), initFn/icons/reveal all
    // execute against the NEW DOM — never the stale previous route.
    const renderAndInit = () => {
      // Inject template
      if (spaContent && routeConfig.templateFn) {
        spaContent.innerHTML = routeConfig.templateFn();
        // Fallback entrance animation when View Transitions are unavailable
        spaContent.classList.remove('route-enter');
        void spaContent.offsetWidth; // force reflow to restart animation
        spaContent.classList.add('route-enter');
      }

      // Update sidebar active state
      document.querySelectorAll('.sidebar-menu .sidebar-link').forEach(el => el.classList.remove('active'));
      if (routeConfig.navId) {
        const activeEl = document.getElementById(routeConfig.navId);
        if (activeEl) activeEl.classList.add('active');
      }

      // Run init
      if (routeConfig.initFn) {
        try {
          routeConfig.initFn();
        } catch (e) {
          console.error('[Router] Init error on route "' + hash + '":', e);
          // Show a visible fallback so the user isn't left with a blank page
          if (spaContent) {
            spaContent.innerHTML = `
              <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                          height:100%;gap:1rem;padding:3rem;text-align:center;">
                <i data-lucide="alert-triangle" style="width:48px;height:48px;color:var(--color-danger);"></i>
                <h2 style="color:var(--text-primary);">Something went wrong</h2>
                <p style="color:var(--text-secondary);max-width:420px;line-height:1.6;">
                  This page encountered an error while loading. Try refreshing or navigating elsewhere.
                </p>
                <button onclick="spaNavigate('home')" class="btn btn-primary">Go to Home</button>
                <details style="font-size:0.75rem;color:var(--text-tertiary);max-width:520px;text-align:left;margin-top:0.5rem;">
                  <summary style="cursor:pointer;">Error details</summary>
                  <pre style="margin-top:0.5rem;white-space:pre-wrap;font-family:var(--font-mono);">${
                    typeof escapeHTML === 'function' ? escapeHTML(e.message || String(e)) : (e.message || String(e))
                  }</pre>
                </details>
              </div>
            `;
          }
        }
      }

      // Re-create Lucide icons globally safely
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }

      // Activate scroll-reveal / count-up for any [data-reveal]/[data-count-to]
      // nodes the new route injected.
      if (window.Motion && typeof Motion.scan === 'function') {
        Motion.scan(spaContent || document);
      }
    };

    if (window.Motion && typeof Motion.withViewTransition === 'function') {
      Motion.withViewTransition(renderAndInit);
    } else {
      renderAndInit();
    }

    window.cm_currentRawHash = rawHash;
  }

  // --- Boot ---
  function init() {
    window.addEventListener('hashchange', handleRoute);

    // Handle initial load
    if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
      window.location.hash = '#/home';
    } else {
      handleRoute();
    }
  }

  return { register, navigate, init, getCurrentRoute: () => currentRoute };
})();

// Global shortcut
function spaNavigate(route, params) {
  SpaRouter.navigate(route, params);
}