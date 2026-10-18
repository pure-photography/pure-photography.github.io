/* Pure Photography — client verification snippet.
 *
 * Drop-in email gate for print order galleries. Before the gallery (or any
 * payment step) is shown, the shopper enters the email they booked with.
 * The email is hashed client-side (SHA-256) and checked against the public
 * client-hashes.json — which contains ONLY hashes, no personal data.
 * Non-clients are blocked BEFORE reaching any payment screen.
 *
 * Usage: include this script, then call:
 *   PurePhotoVerify.install({
 *     gateId:    'client-gate',     // container for the gate UI
 *     contentId: 'gallery-content', // hidden until verified
 *     hashesUrl: 'https://pure-photography.github.io/client-hashes.json'
 *   });
 *
 * Requirements: gate container + content container exist in the DOM.
 * The content container should start hidden (hidden attribute).
 * Fully keyboard + screen-reader accessible.
 */
(function (global) {
  'use strict';

  async function sha256Hex(text) {
    const data = new TextEncoder().encode(text.trim().toLowerCase());
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  async function fetchHashes(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('hash list unavailable');
    const doc = await res.json();
    return new Set(doc.hashes || []);
  }

  function buildGate(container) {
    container.innerHTML =
      '<div class="pp-verify-box" role="group" aria-labelledby="pp-verify-heading">' +
      '<h2 id="pp-verify-heading">Your private gallery</h2>' +
      '<p>This gallery is only for Pure Photography clients. ' +
      'Please enter the email address you used when you booked your session.</p>' +
      '<label for="pp-verify-email">Email address you booked with</label>' +
      '<input type="email" id="pp-verify-email" name="verify_email" ' +
      'autocomplete="email" required inputmode="email" ' +
      'aria-describedby="pp-verify-error">' +
      '<p id="pp-verify-error" role="alert" class="pp-verify-error"></p>' +
      '<button type="button" id="pp-verify-btn" class="button">View my gallery</button>' +
      '</div>';
    return {
      input: container.querySelector('#pp-verify-email'),
      button: container.querySelector('#pp-verify-btn'),
      error: container.querySelector('#pp-verify-error')
    };
  }

  function install(options) {
    const gate = document.getElementById(options.gateId);
    const content = document.getElementById(options.contentId);
    if (!gate || !content) {
      console.error('[PurePhotoVerify] gate or content container missing');
      return;
    }
    const ui = buildGate(gate);
    let hashesPromise = null;

    function getHashes() {
      if (!hashesPromise) hashesPromise = fetchHashes(options.hashesUrl);
      return hashesPromise;
    }

    async function verify() {
      const email = ui.input.value.trim();
      ui.error.textContent = '';
      if (!email || email.indexOf('@') < 0) {
        ui.error.textContent = 'Please enter a valid email address.';
        ui.input.focus();
        return;
      }
      ui.button.disabled = true;
      ui.button.textContent = 'Checking…';
      try {
        const [hashes, hex] = await Promise.all([getHashes(), sha256Hex(email)]);
        if (hashes.has(hex)) {
          gate.hidden = true;
          content.hidden = false;
          const heading = content.querySelector('h1, h2');
          if (heading) {
            heading.setAttribute('tabindex', '-1');
            heading.focus({ preventScroll: false });
          }
          try {
            sessionStorage.setItem('pp_verified_email', hex);
          } catch (e) { /* private mode — fine */ }
        } else {
          ui.error.textContent =
            'We couldn\u2019t find a booking with that email address. ' +
            'Only clients with a booked session can order prints. ' +
            'If you think this is a mistake, please contact Mary at ' +
            'purephotography6@gmail.com or text (803) 630-7835.';
          ui.input.select();
        }
      } catch (err) {
        ui.error.textContent =
          'We couldn\u2019t check your email just now. Please check your ' +
          'connection and try again.';
      } finally {
        ui.button.disabled = false;
        ui.button.textContent = 'View my gallery';
      }
    }

    ui.button.addEventListener('click', verify);
    ui.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); verify(); }
    });

    // Re-verify on order submit as a second line of defense before payment.
    document.addEventListener('submit', function (e) {
      const form = e.target;
      if (!form || !form.matches || !form.matches('[data-require-client]')) return;
      let ok = false;
      try {
        ok = !!sessionStorage.getItem('pp_verified_email');
      } catch (err) { /* ignore */ }
      if (!ok) {
        e.preventDefault();
        e.stopPropagation();
        ui.error.textContent =
          'Please verify your booking email above before placing your order.';
        gate.hidden = false;
        content.hidden = true;
        ui.input.focus();
        gate.scrollIntoView();
      }
    }, true);

    ui.input.focus();
  }

  global.PurePhotoVerify = { install: install, sha256Hex: sha256Hex };
})(window);
