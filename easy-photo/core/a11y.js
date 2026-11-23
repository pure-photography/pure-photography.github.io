/* Easy Photo — accessibility utilities (FOUNDATION workstream)
 *
 * Every workstream MUST use these instead of rolling its own:
 *   EasyPhoto.a11y.announce('Client saved')          // aria-live announcements
 *   var release = EasyPhoto.a11y.trapFocus(modalEl)  // modal keyboard trap
 *   EasyPhoto.a11y.toggleTheme()                     // high-contrast theme
 *   EasyPhoto.a11y.prefersReducedMotion()            // check before animating
 *
 * Call EasyPhoto.a11y.initA11y() once at app start (the shell does this).
 */
(function (global) {
  'use strict';

  var THEME_KEY = 'easy-photo:theme';
  var THEMES = ['default', 'high-contrast'];

  var FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  function isVisible(el) {
    return !!(el.getClientRects && el.getClientRects().length);
  }

  function focusablesIn(container) {
    var nodes = container.querySelectorAll(FOCUSABLE_SELECTOR);
    return Array.prototype.filter.call(nodes, isVisible);
  }

  /* ---------- aria-live announcer ---------- */

  function ensureLiveRegion(id, role, politeness) {
    var el = document.getElementById(id);
    if (el) return el;
    el = document.createElement('div');
    el.id = id;
    el.className = 'ep-live-region';
    el.setAttribute('role', role);
    el.setAttribute('aria-live', politeness);
    el.setAttribute('aria-atomic', 'true');
    document.body.appendChild(el);
    return el;
  }

  function ensureLiveRegions() {
    ensureLiveRegion('ep-live-polite', 'status', 'polite');
    ensureLiveRegion('ep-live-assertive', 'alert', 'assertive');
  }

  /**
   * announce(message, priority)
   * Speak a status change to screen readers. Use 'polite' (default) for
   * routine updates ("Client saved") and 'assertive' for urgent ones
   * ("Payment failed — card declined").
   */
  function announce(message, priority) {
    ensureLiveRegions();
    var id = priority === 'assertive' ? 'ep-live-assertive' : 'ep-live-polite';
    var el = document.getElementById(id);
    // Clear-then-set so repeated identical messages are still announced.
    el.textContent = '';
    global.setTimeout(function () {
      el.textContent = String(message);
    }, 50);
  }

  /* ---------- keyboard trap for modals/dialogs ---------- */

  /**
   * trapFocus(container, options) -> release()
   * Keeps Tab/Shift+Tab cycling inside container. Moves focus into the
   * container on trap; restores focus to the previously focused element
   * when release() is called. options.onEscape() fires on Escape.
   */
  function trapFocus(container, options) {
    options = options || {};
    var el = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    if (!el) throw new Error('trapFocus: container not found');

    var previous = document.activeElement;

    function onKeydown(e) {
      if (e.key === 'Escape' && typeof options.onEscape === 'function') {
        options.onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      var items = focusablesIn(el);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeydown, true);

    // Move focus in: first focusable, else the container itself.
    var initial = focusablesIn(el)[0];
    if (initial) {
      initial.focus();
    } else {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus();
    }

    var released = false;
    return function release() {
      if (released) return;
      released = true;
      document.removeEventListener('keydown', onKeydown, true);
      if (previous && typeof previous.focus === 'function') {
        previous.focus({ preventScroll: true });
      }
    };
  }

  /* ---------- high-contrast theme (persisted) ---------- */

  function storageGet() {
    try { return global.localStorage.getItem(THEME_KEY); }
    catch (e) { return null; }
  }
  function storageSet(value) {
    try { global.localStorage.setItem(THEME_KEY, value); }
    catch (e) { /* private mode: theme just won't persist */ }
  }

  function getTheme() {
    var t = storageGet();
    return THEMES.indexOf(t) !== -1 ? t : 'default';
  }

  function setTheme(theme) {
    if (THEMES.indexOf(theme) === -1) theme = 'default';
    document.documentElement.setAttribute('data-theme', theme);
    storageSet(theme);
    var toggle = document.getElementById('theme-toggle');
    if (toggle) {
      var on = theme === 'high-contrast';
      toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
      toggle.textContent = on ? 'High contrast: on' : 'High contrast: off';
    }
    return theme;
  }

  function toggleTheme() {
    return setTheme(getTheme() === 'high-contrast' ? 'default' : 'high-contrast');
  }

  /* ---------- reduced motion ---------- */

  function prefersReducedMotion() {
    return !!(global.matchMedia &&
      global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ---------- init ---------- */

  function initA11y() {
    ensureLiveRegions();
    setTheme(getTheme());
  }

  var EasyPhoto = global.EasyPhoto || (global.EasyPhoto = {});
  EasyPhoto.a11y = {
    announce: announce,
    trapFocus: trapFocus,
    getTheme: getTheme,
    setTheme: setTheme,
    toggleTheme: toggleTheme,
    prefersReducedMotion: prefersReducedMotion,
    initA11y: initA11y,
    FOCUSABLE_SELECTOR: FOCUSABLE_SELECTOR
  };
})(typeof window !== 'undefined' ? window : this);
