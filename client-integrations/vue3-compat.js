/**
 * BugPin widget — Vue 3 compatibility shim
 *
 * Two issues this file solves when embedding BugPin widget in a Vue 3 app:
 *
 * 1) html2canvas screenshot fails because of cross-origin images
 *    Symptom: screenshot is partial or capture throws "tainted canvas".
 *    Fix:     proactively remove cross-origin <img> elements (debounced, via
 *             requestIdleCallback) before BugPin opens the screenshot dialog.
 *             Vue-managed elements (with `data-v-*` scoped style attrs or
 *             `v-*` directives) are skipped to avoid breaking reactivity.
 *
 * 2) BugPin hooks console.warn / console.error and uploads arguments as
 *    feedback context. Vue 3 component proxies contain circular references
 *    and throw "Cannot convert object to primitive value" + side-effect
 *    "emitsOptions null" when serialised.
 *    Fix:     wrap console.warn / .error AFTER BugPin's hook attaches,
 *             pre-stringifying Vue-proxy-looking arguments to short tags
 *             like "[VueComponent]" / "[VueProxy]" / "[VueRef]".
 *
 * Usage
 * -----
 * Load this file BEFORE the BugPin widget script:
 *
 *   <script src="/path/to/vue3-compat.js"></script>
 *   <script src="https://your-bugpin-server.com/widget.js"
 *           data-api-key="proj_xxx"></script>
 *
 * The shim is idempotent and side-effect-only (no exports). Safe to load
 * multiple times — the second call is a no-op via internal guard.
 *
 * Tested with: Vue 3.5 + Vite 6 + Ant Design Vue 4 (mige-lims).
 *
 * Known trade-offs
 * ----------------
 * - Removes cross-origin <img> from DOM. If your app legitimately renders
 *   cross-origin images (e.g. CDN avatars on a different domain) and you
 *   need them visible AFTER screenshot, configure those CDNs to serve
 *   `Access-Control-Allow-Origin` instead of using this shim.
 * - The console hook patch always JSON-stringifies object arguments after
 *   BugPin's hook returns. If you rely on `console.error(error)` printing
 *   the original `Error` object to DevTools, you'll see the stringified
 *   form instead.
 */
(function () {
  if (window.__bugpinVue3CompatLoaded) return;
  window.__bugpinVue3CompatLoaded = true;

  // ==========================================================================
  // 1) Image purge — strip cross-origin / failed <img> before screenshot
  // ==========================================================================

  function isCrossOrigin(src) {
    if (!src) return false;
    if (src.startsWith('data:') || src.startsWith('blob:')) return false;
    if (src.startsWith('/') && !src.startsWith('//')) return false;
    try {
      var u = new URL(src, window.location.href);
      return u.origin !== window.location.origin;
    } catch (e) {
      return false;
    }
  }

  // Skip elements marked with Vue scoped-style (`data-v-*`) or directives
  // (`v-*`), and walk up 5 levels to catch parent-scoped descendants.
  function isVueManaged(img) {
    if (!img || !img.attributes) return false;
    for (var i = 0; i < img.attributes.length; i++) {
      var name = img.attributes[i].name;
      if (name.indexOf('data-v-') === 0 || name.indexOf('v-') === 0) return true;
    }
    var p = img.parentElement;
    var depth = 0;
    while (p && depth < 5) {
      if (p.attributes) {
        for (var j = 0; j < p.attributes.length; j++) {
          if (p.attributes[j].name.indexOf('data-v-') === 0) return true;
        }
      }
      p = p.parentElement;
      depth++;
    }
    return false;
  }

  function purge() {
    document.querySelectorAll('img').forEach(function (img) {
      if (isVueManaged(img)) return;
      var src = img.getAttribute('src') || '';
      if (isCrossOrigin(src)) {
        img.remove();
      } else if (img.complete && img.naturalWidth === 0 && src) {
        img.remove();
      }
    });
  }

  var purgeQueued = false;
  function schedulePurge() {
    if (purgeQueued) return;
    purgeQueued = true;
    var run = function () { purgeQueued = false; purge(); };
    (window.requestIdleCallback || function (cb) { return setTimeout(cb, 500); })(run, { timeout: 2000 });
  }

  document.addEventListener(
    'error',
    function (e) {
      if (e.target && e.target.tagName === 'IMG' && !isVueManaged(e.target)) e.target.remove();
    },
    true
  );
  document.addEventListener('DOMContentLoaded', schedulePurge);
  setTimeout(schedulePurge, 1500);
  setTimeout(schedulePurge, 3500);
  new MutationObserver(schedulePurge).observe(document.documentElement, { childList: true, subtree: true });

  // ==========================================================================
  // 2) console hook safety — pre-stringify Vue proxies after BugPin hooks
  // ==========================================================================

  function safeStringifyArg(arg) {
    if (typeof arg !== 'object' || arg === null) return arg;
    try {
      if (arg.__v_isRef) return '[VueRef]';
      if (arg.__v_isReactive) return '[VueReactive]';
      if (arg.__v_skip || arg.__v_raw) return '[VueProxy]';
      if (arg.$el || arg.$root || arg.$parent) return '[VueComponent]';
    } catch (_) {
      // Accessing proxy props can throw; fall through to JSON.stringify.
    }
    try {
      return JSON.stringify(arg, function (k, v) {
        if (typeof v === 'function') return '[Function]';
        if (v && typeof v === 'object') {
          try {
            if (v.__v_isRef || v.__v_isReactive || v.__v_skip || v.__v_raw) return '[VueProxy]';
            if (v.$el || v.$root || v.$parent) return '[VueComponent]';
          } catch (_) {
            return '[Unstringifiable]';
          }
        }
        return v;
      });
    } catch (e) {
      try { return String(arg); } catch (_) { return '[Unstringifiable]'; }
    }
  }

  function patchConsoleAfterBugPin() {
    ['warn', 'error'].forEach(function (method) {
      var bugpinHooked = console[method];
      console[method] = function () {
        var safeArgs = Array.prototype.slice.call(arguments).map(safeStringifyArg);
        try {
          return bugpinHooked.apply(console, safeArgs);
        } catch (e) {
          // BugPin's hook still threw — fall back to the browser's native
          // console method via prototype, so the app keeps working.
          try {
            var ctor = window.console.constructor;
            if (ctor && ctor.prototype && ctor.prototype[method]) {
              return ctor.prototype[method].apply(console, safeArgs);
            }
          } catch (_) {
            // Silently swallow; do NOT let logging crash the app.
          }
        }
      };
    });
  }

  // BugPin widget.js typically installs its console hook on / after
  // DOMContentLoaded. Patch on top of it once the page is loaded.
  if (document.readyState === 'complete') {
    setTimeout(patchConsoleAfterBugPin, 500);
  } else {
    window.addEventListener('load', function () {
      setTimeout(patchConsoleAfterBugPin, 500);
    });
  }
})();
