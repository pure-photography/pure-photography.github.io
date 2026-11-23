/* Easy Photo — Print store (v1)
 *
 * Connect an existing print store, or guided free setup with Printify.
 * Easy Photo cannot create a Printify account for the photographer — they
 * sign up on Printify's own site. This page only records the connection.
 */
(function () {
  'use strict';

  var form = document.getElementById('existing-form');
  var nameInput = document.getElementById('ps-name');
  var urlInput = document.getElementById('ps-url');
  var urlError = document.getElementById('ps-url-error');
  var savedLine = document.getElementById('ps-saved');
  var savedLink = document.getElementById('ps-saved-link');

  function announce(msg, priority) {
    EasyPhoto.a11y.announce(msg, priority);
  }

  function showSaved(store) {
    if (!store || !store.url) {
      savedLine.hidden = true;
      return;
    }
    savedLink.href = store.url;
    savedLink.textContent = (store.name ? store.name + ' — ' : '') + store.url;
    savedLine.hidden = false;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var url = urlInput.value.trim();
    if (url && url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) {
      url = 'https://' + url;
    }
    if (!url || url.indexOf('.') === -1) {
      urlError.textContent = 'Please enter a full store address, for example https://example.com';
      urlError.hidden = false;
      urlInput.setAttribute('aria-invalid', 'true');
      urlInput.focus();
      return;
    }
    urlError.hidden = true;
    urlInput.removeAttribute('aria-invalid');
    var store = { name: nameInput.value.trim(), url: url };
    window.db.settings.set('print.store', store).then(function () {
      showSaved(store);
      announce('Print store connected.');
    });
  });

  document.getElementById('ps-disconnect-btn').addEventListener('click', function () {
    if (!window.confirm('Disconnect your print store?')) return;
    window.db.settings.set('print.store', null).then(function () {
      form.reset();
      showSaved(null);
      announce('Print store disconnected.');
    });
  });

  EasyPhoto.a11y.initA11y();
  window.db.settings.get('print.store').then(function (store) {
    if (!store) return;
    nameInput.value = store.name || '';
    urlInput.value = store.url || '';
    showSaved(store);
  });
})();
