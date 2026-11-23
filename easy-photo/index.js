/* Easy Photo — dashboard + sign-in (index.js, v1) */
(function () {
  'use strict';

  function announce(msg, priority) {
    EasyPhoto.a11y.announce(msg, priority);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function showError(el, message) {
    el.textContent = message;
    el.hidden = false;
    el.focus();
  }

  /* ---------- auth view tabs ---------- */
  var tabs = {
    signin: { tab: 'tab-signin', form: 'form-signin' },
    signup: { tab: 'tab-signup', form: 'form-signup' },
    agent: { tab: 'tab-agent', form: 'form-agent' },
    owner: { tab: 'tab-owner', form: 'form-owner' }
  };

  function showTab(key) {
    Object.keys(tabs).forEach(function (k) {
      var t = tabs[k];
      document.getElementById(t.tab).setAttribute('aria-pressed', k === key ? 'true' : 'false');
      document.getElementById(t.tab).classList.toggle('btn-primary', k === key);
      document.getElementById(t.form).hidden = k !== key;
    });
    document.getElementById('form-forgot').hidden = true;
    document.getElementById('form-reset').hidden = true;
  }

  Object.keys(tabs).forEach(function (key) {
    document.getElementById(tabs[key].tab).addEventListener('click', function () {
      showTab(key);
    });
  });

  document.getElementById('forgot-link').addEventListener('click', function () {
    Object.keys(tabs).forEach(function (k) {
      document.getElementById(tabs[k].form).hidden = true;
    });
    document.getElementById('form-forgot').hidden = false;
    document.getElementById('fp-email').focus();
  });

  document.getElementById('fp-have-code-btn').addEventListener('click', function () {
    document.getElementById('form-forgot').hidden = true;
    document.getElementById('form-reset').hidden = false;
    document.getElementById('rs-email').focus();
  });

  /* ---------- sign in ---------- */
  document.getElementById('form-signin').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('si-email').value;
    var password = document.getElementById('si-password').value;
    EasyPhoto.auth.signIn(email, password).then(function () {
      enterApp();
    }).catch(function (err) {
      showError(document.getElementById('si-error'), err.message);
    });
  });

  /* ---------- create account ---------- */
  document.getElementById('form-signup').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = document.getElementById('su-name').value;
    var email = document.getElementById('su-email').value;
    var password = document.getElementById('su-password').value;
    EasyPhoto.auth.signUp(name, email, password).then(function () {
      announce('Account created. Welcome to Easy Photo!');
      enterApp();
    }).catch(function (err) {
      showError(document.getElementById('su-error'), err.message);
    });
  });

  /* ---------- agent sign-in ---------- */
  document.getElementById('form-agent').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('ag-email').value;
    var key = document.getElementById('ag-key').value;
    EasyPhoto.auth.agentSignIn(email, key).then(function (session) {
      announce('Signed in as agent for ' + session.email + '.');
      enterApp();
    }).catch(function (err) {
      showError(document.getElementById('ag-error'), err.message);
    });
  });

  /* ---------- owner login ---------- */
  document.getElementById('form-owner').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('ow-email').value;
    var password = document.getElementById('ow-password').value;
    EasyPhoto.auth.ownerLogin(email, password).then(function (result) {
      if (result.seed && result.seed.imported) {
        announce('Owner signed in. Connected to Pure Photography. ' +
          result.seed.galleries + ' past-shoot galleries with ' +
          result.seed.photos + ' photos were added to your account.');
      } else {
        announce('Owner signed in. Connected to Pure Photography.');
      }
      enterApp();
    }).catch(function (err) {
      showError(document.getElementById('ow-error'), err.message);
    });
  });

  /* ---------- forgot password: request ---------- */
  document.getElementById('form-forgot').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('fp-email').value;
    EasyPhoto.auth.requestReset(email).then(function () {
      document.getElementById('fp-sent').hidden = false;
      announce('Reset request sent. Your email app opened — press send in your email app. Hannah will reply with a reset code.');
    }).catch(function (err) {
      showError(document.getElementById('fp-error'), err.message);
    });
  });

  /* ---------- forgot password: enter code ---------- */
  document.getElementById('form-reset').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('rs-email').value;
    var code = document.getElementById('rs-code').value;
    var password = document.getElementById('rs-password').value;
    EasyPhoto.auth.resetWithCode(email, code, password).then(function () {
      announce('Password reset. You are signed in.');
      enterApp();
    }).catch(function (err) {
      showError(document.getElementById('rs-error'), err.message);
    });
  });

  /* ---------- dashboard ---------- */
  function money(cents) {
    if (cents == null) return '—';
    return '$' + (cents / 100).toFixed(2);
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0');
  }

  function renderList(ul, emptyEl, items, renderItem) {
    ul.innerHTML = '';
    emptyEl.hidden = items.length !== 0;
    items.forEach(function (item) {
      var li = document.createElement('li');
      li.innerHTML = renderItem(item);
      ul.appendChild(li);
    });
  }

  function loadDashboard() {
    var db = window.db;
    var statusEl = document.getElementById('db-status');
    var today = todayISO();
    Promise.all([
      db.sessions.query('byDate', today),
      db.leads.query('byStatus', 'new'),
      db.galleries.all(),
      db.clients.all()
    ]).then(function (results) {
      var sessions = results[0] || [];
      var leads = results[1] || [];
      var galleries = results[2] || [];
      var clients = results[3] || [];
      statusEl.textContent = 'Studio database ready.';
      var clientNames = {};
      clients.forEach(function (c) { clientNames[c.id] = c.name; });

      renderList(
        document.getElementById('today-list'),
        document.getElementById('today-empty'),
        sessions,
        function (s) {
          return esc(clientNames[s.clientId] || 'Session') + ' — ' + esc(s.type || '') +
            (s.time ? ' at ' + esc(s.time) : '') +
            (s.location ? ' — ' + esc(s.location) : '') +
            ' <span class="ep-status" data-tone="' +
            (s.status === 'completed' ? 'success' : 'warning') + '">' + esc(s.status) + '</span>';
        }
      );

      var due = sessions.filter(function (s) {
        return s.balanceDue != null && s.balanceDue > 0;
      });
      renderList(
        document.getElementById('balances-list'),
        document.getElementById('balances-empty'),
        due,
        function (s) {
          return esc(clientNames[s.clientId] || 'Session') + ' — balance due ' + money(s.balanceDue);
        }
      );

      renderList(
        document.getElementById('leads-list'),
        document.getElementById('leads-empty'),
        leads.slice(0, 5),
        function (l) {
          return esc(l.name || 'Lead') + ' — ' + esc(l.channel || '') +
            (l.requestedDate ? ' — wants ' + esc(l.requestedDate) : '');
        }
      );

      document.getElementById('quick-galleries').textContent = galleries.length + ' galleries';
      document.getElementById('quick-clients').textContent = clients.length + ' clients';
    }).catch(function (err) {
      statusEl.textContent = 'Could not load the studio database: ' + err.message;
    });
  }

  function enterApp() {
    document.getElementById('view-auth').hidden = true;
    document.getElementById('view-dashboard').hidden = false;
    document.getElementById('main-nav').hidden = false;
    if (EasyPhoto.auth.isOwner()) {
      document.getElementById('owner-connection').hidden = false;
    }
    // Refresh the user bar (auth.js injected it at load; it shows the old state).
    var bar = document.getElementById('ep-userbar');
    if (bar) bar.remove();
    loadDashboard();
    document.getElementById('h-dashboard').focus();
  }

  /* ---------- start ---------- */
  EasyPhoto.a11y.initA11y();

  if (EasyPhoto.auth.currentUser()) {
    enterApp();
  } else {
    showTab('signin');
  }

  /* PWA install prompt (kept from the scaffold). */
  var deferredPrompt = null;
  var installBtn = document.getElementById('install-btn');
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener('click', function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () { deferredPrompt = null; });
    installBtn.hidden = true;
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js').catch(function () {
        /* offline support is best-effort */
      });
    });
  }
})();
