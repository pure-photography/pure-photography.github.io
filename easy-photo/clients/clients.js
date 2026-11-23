/* ============================================================================
 * EASY PHOTO — Clients screen logic
 * ----------------------------------------------------------------------------
 * Single-page Clients screen with three views:
 *   1. list   — searchable client list + upcoming sessions + demo controls
 *   2. form   — add / edit client (validated, inline errors, aria-describedby)
 *   3. detail — profile, session history, payments, notes timeline
 *
 * Accessibility: semantic landmarks, skip link (in HTML), visible labels,
 * inline errors linked via aria-describedby with role="alert", a polite
 * aria-live announcer for every add/update/delete, native buttons/inputs
 * throughout so full keyboard operation works with no extra code, and
 * confirmation before every delete.
 *
 * Depends on: ../db.js (contract), sessions.js (SessionHelpers),
 *             seed.js (SeedDemo).
 * ========================================================================== */
(function () {
  'use strict';

  /* ---------------- utilities ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  function fmtMoney(n) { return money.format(Number(n || 0)); }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // 'YYYY-MM-DD' -> 'Oct 24, 2026' (manual parse: no timezone surprises)
  function fmtDate(iso) {
    if (!iso) return '—';
    var parts = String(iso).slice(0, 10).split('-');
    if (parts.length !== 3) return String(iso);
    var m = parseInt(parts[1], 10);
    return MONTHS[m - 1] + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
  }
  // '14:00' -> '2:00 PM'
  function fmtTime(t) {
    if (!t) return '—';
    var parts = String(t).split(':');
    var h = parseInt(parts[0], 10);
    var min = parts[1] || '00';
    var suffix = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ':' + min + ' ' + suffix;
  }
  // ISO datetime -> 'Oct 18, 2026, 3:05 AM'
  function fmtDateTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    var h = d.getHours();
    var suffix = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    var min = String(d.getMinutes()).padStart(2, '0');
    return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() +
      ', ' + h12 + ':' + min + ' ' + suffix;
  }

  function todayLocal() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  function pluralize(n, singular, pluralWord) {
    return n + ' ' + (n === 1 ? singular : (pluralWord || singular + 's'));
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'id-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 10);
  }

  var announcer = $('#announcer');
  function announce(message) {
    announcer.textContent = '';
    window.setTimeout(function () { announcer.textContent = message; }, 60);
  }

  /* ---------------- view switching ---------------- */
  var VIEWS = ['list', 'form', 'detail'];
  function showView(name) {
    VIEWS.forEach(function (v) {
      $('#view-' + v).hidden = (v !== name);
    });
    var heading = $('#view-' + name + ' h2[tabindex="-1"]') ||
                  $('#view-' + name + ' h2');
    if (heading) heading.focus();
    window.scrollTo(0, 0);
  }

  /* ---------------- form errors ---------------- */
  function setFieldError(input, errorEl, message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    input.setAttribute('aria-invalid', 'true');
  }
  function clearFieldError(input, errorEl) {
    errorEl.textContent = '';
    errorEl.hidden = true;
    input.removeAttribute('aria-invalid');
  }

  /* ---------------- state ---------------- */
  var currentClientId = null;
  var editingClientId = null; // null = add mode
  var searchQuery = '';
  var detailCache = { sessions: [], paymentsBySession: {} };

  /* ==================================================================
   * LIST VIEW
   * ================================================================== */
  function clientStats(clientId) {
    return Promise.all([
      window.db.sessions.byClient(clientId),
      window.db.payments.byClient(clientId)
    ]).then(function (results) {
      var sessions = results[0];
      var payments = results[1];
      var paid = payments.reduce(function (sum, p) {
        return sum + Number(p.amount || 0);
      }, 0);
      return { sessionCount: sessions.length, totalPaid: paid };
    });
  }

  function renderClientList() {
    var listEl = $('#client-list');
    var emptyEl = $('#client-list-empty');
    var noResultsEl = $('#client-list-no-results');
    var getClients = searchQuery
      ? window.db.clients.search(searchQuery)
      : window.db.clients.all();

    return getClients.then(function (clients) {
      listEl.innerHTML = '';
      $('#client-count').textContent = clients.length
        ? '(' + pluralize(clients.length, 'client') + ')'
        : '';
      emptyEl.hidden = clients.length > 0 || searchQuery !== '';
      noResultsEl.hidden = !(searchQuery !== '' && clients.length === 0);

      var chain = Promise.resolve();
      clients.forEach(function (client) {
        chain = chain.then(function () {
          return clientStats(client.id);
        }).then(function (stats) {
          var li = document.createElement('li');
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'client-row';
          btn.setAttribute('data-id', client.id);
          btn.setAttribute('aria-label',
            client.name + ', ' + pluralize(stats.sessionCount, 'session') +
            ', ' + fmtMoney(stats.totalPaid) + ' paid');
          var demoBadge = client.demo
            ? ' <span class="demo-badge">Demo</span>'
            : '';
          btn.innerHTML =
            '<span class="client-row-name">' + esc(client.name) + demoBadge + '</span>' +
            '<span class="client-row-contact">' +
              esc([client.phone, client.email].filter(Boolean).join(' · ') || 'No contact info') +
            '</span>' +
            '<span class="client-row-stats">' +
              esc(pluralize(stats.sessionCount, 'session')) + ' · ' +
              esc(fmtMoney(stats.totalPaid)) + ' paid' +
            '</span>';
          btn.addEventListener('click', function () { openDetail(client.id); });
          li.appendChild(btn);
          listEl.appendChild(li);
        });
      });
      return chain;
    });
  }

  function renderUpcoming() {
    var listEl = $('#upcoming-list');
    var emptyEl = $('#upcoming-empty');
    return window.SessionHelpers.listUpcomingSessions().then(function (sessions) {
      listEl.innerHTML = '';
      emptyEl.hidden = sessions.length > 0;
      var chain = Promise.resolve();
      sessions.forEach(function (s) {
        chain = chain.then(function () {
          return window.db.clients.get(s.clientId);
        }).then(function (client) {
          var li = document.createElement('li');
          var name = client ? client.name : 'Unknown client';
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = name + ' — ' + (s.type || 'Session');
          btn.setAttribute('aria-label',
            'View ' + name + ', ' + (s.type || 'session') + ' on ' + fmtDate(s.date));
          btn.addEventListener('click', function () { openDetail(s.clientId); });
          li.innerHTML =
            '<span class="upcoming-when">' + esc(fmtDate(s.date)) +
            (s.time ? ' · ' + esc(fmtTime(s.time)) : '') + '</span><br>';
          li.appendChild(btn);
          var meta = document.createElement('span');
          meta.className = 'upcoming-meta';
          meta.textContent = (s.status === 'booked' ? 'Booked' : s.status) +
            (s.location ? ' · ' + s.location : '');
          li.appendChild(meta);
          listEl.appendChild(li);
        });
      });
      return chain;
    });
  }

  function refreshDemoUI() {
    return window.SeedDemo.hasDemo().then(function (has) {
      $('#load-demo-btn').hidden = has;
      $('#clear-demo-btn').hidden = !has;
      $('#demo-note').hidden = !has;
    });
  }

  function renderListView() {
    return Promise.all([renderUpcoming(), renderClientList(), refreshDemoUI()])
      .catch(function (err) {
        console.error(err);
        announce('Something went wrong loading the client list.');
      });
  }

  /* ==================================================================
   * CLIENT FORM (add / edit)
   * ================================================================== */
  function openForm(client) {
    editingClientId = client ? client.id : null;
    var form = $('#client-form');
    form.reset();
    $all('.error', form).forEach(function (e) { e.hidden = true; e.textContent = ''; });
    $all('[aria-invalid]', form).forEach(function (el) { el.removeAttribute('aria-invalid'); });

    $('#form-heading').textContent = client ? 'Edit client' : 'Add client';
    $('#client-form-submit').textContent = client ? 'Save changes' : 'Save client';

    if (client) {
      $('#cf-name').value = client.name || '';
      $('#cf-email').value = client.email || '';
      $('#cf-phone').value = client.phone || '';
      $('#cf-address').value = client.address || '';
      $('#cf-source').value = client.source || '';
      $('#cf-tags').value = (client.tags || []).join(', ');
      var firstNote = (client.notesLog && client.notesLog.length) ? client.notesLog[0].text : '';
      $('#cf-notes').value = firstNote;
    }
    showView('form');
  }

  function parseTags(raw) {
    return String(raw || '')
      .split(',')
      .map(function (t) { return t.trim(); })
      .filter(function (t) { return t.length > 0; });
  }

  function validateClientForm() {
    var ok = true;
    var firstInvalid = null;
    var nameInput = $('#cf-name');
    var nameError = $('#cf-name-error');
    var emailInput = $('#cf-email');
    var emailError = $('#cf-email-error');

    clearFieldError(nameInput, nameError);
    clearFieldError(emailInput, emailError);

    if (!nameInput.value.trim()) {
      setFieldError(nameInput, nameError, 'Please enter the client\u2019s name.');
      ok = false;
      firstInvalid = firstInvalid || nameInput;
    }
    if (emailInput.value.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) {
      setFieldError(emailInput, emailError, 'That email address doesn\u2019t look right.');
      ok = false;
      firstInvalid = firstInvalid || emailInput;
    }
    if (firstInvalid) firstInvalid.focus();
    return ok;
  }

  function submitClientForm(event) {
    event.preventDefault();
    if (!validateClientForm()) {
      announce('The form has errors. Please fix the highlighted fields.');
      return;
    }
    var data = {
      name: $('#cf-name').value.trim(),
      email: $('#cf-email').value.trim(),
      phone: $('#cf-phone').value.trim(),
      address: $('#cf-address').value.trim(),
      source: $('#cf-source').value.trim(),
      tags: parseTags($('#cf-tags').value)
    };
    var notesText = $('#cf-notes').value.trim();

    var save;
    if (editingClientId) {
      save = window.db.clients.get(editingClientId).then(function (rec) {
        var log = (rec.notesLog || []).slice();
        if (notesText) {
          if (log.length) {
            log[0] = Object.assign({}, log[0], { text: notesText });
          } else {
            log.push({ id: makeId(), text: notesText, createdAt: new Date().toISOString() });
          }
        } else if (log.length) {
          log.shift(); // notes field cleared -> remove the intro note
        }
        return window.db.clients.update(editingClientId, Object.assign(data, { notesLog: log }));
      }).then(function () {
        announce('Client updated: ' + data.name + '.');
        return editingClientId;
      });
    } else {
      data.notes = notesText;
      save = window.db.clients.add(data).then(function (id) {
        announce('Client added: ' + data.name + '.');
        return id;
      });
    }

    save.then(function (id) {
      renderListView();
      openDetail(id);
    }).catch(function (err) {
      console.error(err);
      announce('Something went wrong saving the client.');
    });
  }

  /* ==================================================================
   * DETAIL VIEW
   * ================================================================== */
  function openDetail(clientId) {
    currentClientId = clientId;
    renderDetail().then(function () {
      showView('detail');
    }).catch(function (err) {
      console.error(err);
      announce('Something went wrong opening the client.');
    });
  }

  function renderDetail() {
    return window.db.clients.get(currentClientId).then(function (client) {
      if (!client) {
        announce('That client could not be found.');
        showView('list');
        return renderListView();
      }
      $('#detail-heading').textContent = client.name + (client.demo ? ' (Demo)' : '');

      // ---- profile ----
      var rows = [
        ['Email', client.email || '—'],
        ['Phone', client.phone || '—'],
        ['Address', client.address || '—'],
        ['How they found you', client.source || '—'],
        ['Client since', fmtDate((client.createdAt || '').slice(0, 10))]
      ];
      var dl = $('#profile-list');
      dl.innerHTML = rows.map(function (r) {
        return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>';
      }).join('') +
        '<dt>Tags</dt><dd>' +
        ((client.tags && client.tags.length)
          ? client.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('')
          : '—') +
        '</dd>';

      return Promise.all([
        window.SessionHelpers.listSessionsByClient(currentClientId),
        window.db.payments.byClient(currentClientId)
      ]).then(function (results) {
        var sessions = results[0];
        var payments = results[1];
        detailCache.sessions = sessions;
        detailCache.paymentsBySession = {};
        payments.forEach(function (p) {
          var key = p.sessionId || '__none__';
          (detailCache.paymentsBySession[key] = detailCache.paymentsBySession[key] || []).push(p);
        });
        renderSessionsTable(client);
        renderPaymentsTable();
        renderNotesTimeline(client);
        buildPaymentSessionOptions(sessions);
      });
    });
  }

  function sessionPaid(sessionId) {
    return (detailCache.paymentsBySession[sessionId] || []).reduce(function (sum, p) {
      return sum + Number(p.amount || 0);
    }, 0);
  }

  var STATUS_LABELS = {
    scheduled: 'Scheduled',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    'no-show': 'No-show'
  };

  function renderSessionsTable(client) {
    var tbody = $('#sessions-tbody');
    var sessions = detailCache.sessions;
    tbody.innerHTML = '';
    $('#sessions-empty').hidden = sessions.length > 0;

    sessions.forEach(function (s) {
      var paid = sessionPaid(s.id);
      var balance = Number(s.price || 0) - paid;
      var tr = document.createElement('tr');

      var statusOptions = Object.keys(STATUS_LABELS).map(function (value) {
        return '<option value="' + value + '"' +
          (s.status === value ? ' selected' : '') + '>' +
          STATUS_LABELS[value] + '</option>';
      }).join('');

      var balanceCell;
      if (balance > 0) {
        balanceCell = '<span class="balance-due">' + esc(fmtMoney(balance)) + ' due</span>';
      } else if (balance < 0) {
        balanceCell = '<span class="balance-ok">' + esc(fmtMoney(-balance)) + ' overpaid</span>';
      } else {
        balanceCell = '<span class="balance-ok">Paid in full</span>';
      }

      tr.innerHTML =
        '<td>' + esc(fmtDate(s.date)) + (s.time ? '<br>' + esc(fmtTime(s.time)) : '') + '</td>' +
        '<td>' + esc(s.type || '—') + '</td>' +
        '<td>' + esc(s.location || '—') + '</td>' +
        '<td><select class="status-select" data-session-id="' + esc(s.id) + '" ' +
          'aria-label="Status for ' + esc(s.type || 'session') + ' on ' + esc(fmtDate(s.date)) + '">' +
          statusOptions + '</select></td>' +
        '<td>' + esc(fmtMoney(s.price)) + '</td>' +
        '<td>' + esc(fmtMoney(paid)) + '</td>' +
        '<td>' + balanceCell + '</td>' +
        '<td><button type="button" class="btn btn-small btn-danger-outline" data-delete-session="' + esc(s.id) + '" ' +
          'aria-label="Delete ' + esc(s.type || 'session') + ' on ' + esc(fmtDate(s.date)) + '">Delete</button></td>';

      tbody.appendChild(tr);
    });

    $all('.status-select', tbody).forEach(function (select) {
      select.addEventListener('change', function () {
        var id = select.getAttribute('data-session-id');
        var newStatus = select.value;
        window.SessionHelpers.updateSessionStatus(id, newStatus).then(function () {
          var s = detailCache.sessions.filter(function (x) { return x.id === id; })[0];
          announce('Session status updated to ' + STATUS_LABELS[newStatus] + '.');
          if (s) s.status = newStatus;
        }).catch(function (err) {
          console.error(err);
          announce('Could not update the session status.');
          renderDetail();
        });
      });
    });

    $all('[data-delete-session]', tbody).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-delete-session');
        var s = detailCache.sessions.filter(function (x) { return x.id === id; })[0];
        var label = s ? (s.type || 'Session') + ' on ' + fmtDate(s.date) : 'this session';
        if (!window.confirm('Delete ' + label + '?\n\nIts payment records will be deleted too. This cannot be undone.')) {
          return;
        }
        window.SessionHelpers.removeSession(id).then(function () {
          announce('Session deleted: ' + label + '.');
          return renderDetail();
        }).catch(function (err) {
          console.error(err);
          announce('Could not delete the session.');
        });
      });
    });
  }

  function sessionLabel(sessionId) {
    var s = detailCache.sessions.filter(function (x) { return x.id === sessionId; })[0];
    return s ? fmtDate(s.date) + ' — ' + (s.type || 'Session') : '—';
  }

  function renderPaymentsTable() {
    var tbody = $('#payments-tbody');
    tbody.innerHTML = '';
    return window.db.payments.byClient(currentClientId).then(function (payments) {
      $('#payments-empty').hidden = payments.length > 0;
      payments.forEach(function (p) {
        var tr = document.createElement('tr');
        var typeLabel = { payment: 'Payment', retainer: 'Retainer', refund: 'Refund' }[p.type] || p.type || '—';
        tr.innerHTML =
          '<td>' + esc(fmtDate(p.date)) + '</td>' +
          '<td>' + esc(sessionLabel(p.sessionId)) + '</td>' +
          '<td>' + esc(typeLabel) + '</td>' +
          '<td>' + esc(p.method || '—') + '</td>' +
          '<td>' + esc(fmtMoney(p.amount)) + '</td>' +
          '<td>' + esc(p.note || '—') + '</td>' +
          '<td><button type="button" class="btn btn-small btn-danger-outline" data-delete-payment="' + esc(p.id) + '" ' +
            'aria-label="Delete ' + esc(fmtMoney(p.amount)) + ' ' + esc(p.method || '') + ' payment on ' + esc(fmtDate(p.date)) + '">Delete</button></td>';
        tbody.appendChild(tr);
      });

      $all('[data-delete-payment]', tbody).forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!window.confirm('Delete this payment record? This cannot be undone.')) return;
          var id = btn.getAttribute('data-delete-payment');
          window.db.payments.remove(id).then(function () {
            announce('Payment deleted.');
            return renderDetail();
          }).catch(function (err) {
            console.error(err);
            announce('Could not delete the payment.');
          });
        });
      });
    });
  }

  function buildPaymentSessionOptions(sessions) {
    var select = $('#pf-session');
    select.innerHTML = '';
    if (!sessions.length) {
      var opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No sessions yet — add a session first';
      select.appendChild(opt);
      select.disabled = true;
      return;
    }
    select.disabled = false;
    sessions.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = fmtDate(s.date) + ' — ' + (s.type || 'Session') +
        ' (' + fmtMoney(s.price) + ')';
      select.appendChild(opt);
    });
  }

  function renderNotesTimeline(client) {
    var ol = $('#notes-timeline');
    var notes = ((client.notesLog || []).slice()).sort(function (a, b) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
    ol.innerHTML = '';
    $('#notes-empty').hidden = notes.length > 0;
    notes.forEach(function (n) {
      var li = document.createElement('li');
      var time = document.createElement('time');
      time.setAttribute('datetime', n.createdAt || '');
      time.textContent = fmtDateTime(n.createdAt);
      var p = document.createElement('p');
      p.textContent = n.text;
      li.appendChild(time);
      li.appendChild(p);
      ol.appendChild(li);
    });
  }

  /* ---------------- session form ---------------- */
  function toggleFormWrap(toggleBtn, wrap) {
    var open = wrap.hidden;
    wrap.hidden = !open;
    toggleBtn.setAttribute('aria-expanded', String(open));
    toggleBtn.textContent = open
      ? toggleBtn.textContent.replace('Add', 'Hide')
      : toggleBtn.textContent.replace('Hide', 'Add');
    if (open) {
      var first = $('input, select, textarea', wrap);
      if (first) first.focus();
    }
  }

  function validateSessionForm() {
    var ok = true;
    var firstInvalid = null;
    var typeInput = $('#sf-type');
    var typeError = $('#sf-type-error');
    var dateInput = $('#sf-date');
    var dateError = $('#sf-date-error');
    clearFieldError(typeInput, typeError);
    clearFieldError(dateInput, dateError);
    if (!typeInput.value.trim()) {
      setFieldError(typeInput, typeError, 'Please enter the session type.');
      ok = false;
      firstInvalid = firstInvalid || typeInput;
    }
    if (!dateInput.value) {
      setFieldError(dateInput, dateError, 'Please choose a date.');
      ok = false;
      firstInvalid = firstInvalid || dateInput;
    }
    if (firstInvalid) firstInvalid.focus();
    return ok;
  }

  function submitSessionForm(event) {
    event.preventDefault();
    if (!validateSessionForm()) {
      announce('The session form has errors. Please fix the highlighted fields.');
      return;
    }
    var retainerPaid = Number($('#sf-retainer').value || 0);
    var price = Number($('#sf-price').value || 0);
    var data = {
      clientId: currentClientId,
      type: $('#sf-type').value.trim(),
      date: $('#sf-date').value,
      time: $('#sf-time').value,
      location: $('#sf-location').value.trim(),
      status: $('#sf-status').value,
      price: price,
      retainerPaid: retainerPaid,
      balanceDue: price - retainerPaid,
      notes: $('#sf-notes').value.trim()
    };
    window.SessionHelpers.createSession(data).then(function (sessionId) {
      var after = Promise.resolve();
      if (retainerPaid > 0) {
        after = window.db.payments.add({
          sessionId: sessionId,
          clientId: currentClientId,
          amount: retainerPaid,
          method: $('#sf-retainer-method').value,
          date: todayLocal(),
          type: 'retainer',
          note: 'Retainer for ' + data.type
        });
      }
      return after;
    }).then(function () {
      $('#session-form').reset();
      $('#sf-price').value = '30';
      toggleFormWrap($('#toggle-session-form'), $('#session-form-wrap'));
      announce('Session added for ' + fmtDate(data.date) + '.');
      return renderDetail();
    }).catch(function (err) {
      console.error(err);
      announce('Something went wrong saving the session.');
    });
  }

  /* ---------------- payment form ---------------- */
  function validatePaymentForm() {
    var ok = true;
    var firstInvalid = null;
    var sessionSelect = $('#pf-session');
    var sessionError = $('#pf-session-error');
    var amountInput = $('#pf-amount');
    var amountError = $('#pf-amount-error');
    var dateInput = $('#pf-date');
    var dateError = $('#pf-date-error');
    clearFieldError(sessionSelect, sessionError);
    clearFieldError(amountInput, amountError);
    clearFieldError(dateInput, dateError);
    if (sessionSelect.disabled || !sessionSelect.value) {
      setFieldError(sessionSelect, sessionError, 'Choose the session this payment is for.');
      ok = false;
      firstInvalid = firstInvalid || sessionSelect;
    }
    var amount = Number(amountInput.value);
    if (amountInput.value === '' || isNaN(amount) || amount === 0) {
      setFieldError(amountInput, amountError, 'Please enter an amount greater than zero.');
      ok = false;
      firstInvalid = firstInvalid || amountInput;
    }
    if (!dateInput.value) {
      setFieldError(dateInput, dateError, 'Please choose a date.');
      ok = false;
      firstInvalid = firstInvalid || dateInput;
    }
    if (firstInvalid) firstInvalid.focus();
    return ok;
  }

  function submitPaymentForm(event) {
    event.preventDefault();
    if (!validatePaymentForm()) {
      announce('The payment form has errors. Please fix the highlighted fields.');
      return;
    }
    var amount = Number($('#pf-amount').value);
    var type = $('#pf-type').value;
    var data = {
      sessionId: $('#pf-session').value,
      clientId: currentClientId,
      amount: type === 'refund' ? -Math.abs(amount) : Math.abs(amount),
      method: $('#pf-method').value,
      date: $('#pf-date').value,
      type: type,
      note: $('#pf-note').value.trim()
    };
    window.db.payments.add(data).then(function () {
      $('#payment-form').reset();
      $('#pf-date').value = todayLocal();
      toggleFormWrap($('#toggle-payment-form'), $('#payment-form-wrap'));
      announce('Payment of ' + fmtMoney(data.amount) + ' recorded.');
      return renderDetail();
    }).catch(function (err) {
      console.error(err);
      announce('Something went wrong saving the payment.');
    });
  }

  /* ---------------- note form ---------------- */
  function appendNote(clientId, text) {
    return window.db.clients.get(clientId).then(function (rec) {
      var log = (rec.notesLog || []).slice();
      log.push({ id: makeId(), text: text, createdAt: new Date().toISOString() });
      return window.db.clients.update(clientId, { notesLog: log });
    });
  }

  function submitNoteForm(event) {
    event.preventDefault();
    var textarea = $('#nf-text');
    var errorEl = $('#nf-text-error');
    clearFieldError(textarea, errorEl);
    var text = textarea.value.trim();
    if (!text) {
      setFieldError(textarea, errorEl, 'Please write a note first.');
      textarea.focus();
      return;
    }
    appendNote(currentClientId, text).then(function () {
      textarea.value = '';
      announce('Note added.');
      return window.db.clients.get(currentClientId);
    }).then(function (client) {
      renderNotesTimeline(client);
    }).catch(function (err) {
      console.error(err);
      announce('Something went wrong saving the note.');
    });
  }

  /* ---------------- delete client ---------------- */
  function deleteCurrentClient() {
    window.db.clients.get(currentClientId).then(function (client) {
      if (!client) return;
      return Promise.all([
        window.SessionHelpers.listSessionsByClient(currentClientId),
        window.db.payments.byClient(currentClientId)
      ]).then(function (results) {
        var sessions = results[0];
        var payments = results[1];
        var summary = 'Delete ' + client.name + '?\n\n' +
          'This will also delete ' + pluralize(sessions.length, 'session') +
          ' and ' + pluralize(payments.length, 'payment record') +
          '. This cannot be undone.';
        if (!window.confirm(summary)) return null;
        var chain = Promise.resolve();
        sessions.forEach(function (s) {
          chain = chain.then(function () {
            return window.SessionHelpers.removeSession(s.id);
          });
        });
        return chain.then(function () {
          var leftover = Promise.resolve();
          payments.forEach(function (p) {
            leftover = leftover.then(function () {
              return window.db.payments.remove(p.id).catch(function () { /* already removed via session */ });
            });
          });
          return leftover;
        }).then(function () {
          return window.db.clients.remove(currentClientId);
        }).then(function () {
          announce('Client deleted: ' + client.name + '.');
          currentClientId = null;
          showView('list');
          return renderListView();
        });
      });
    }).catch(function (err) {
      console.error(err);
      announce('Something went wrong deleting the client.');
    });
  }

  /* ---------------- wiring ---------------- */
  function init() {
    // list view
    $('#add-client-btn').addEventListener('click', function () { openForm(null); });

    var searchInput = $('#search');
    var searchTimer = null;
    searchInput.addEventListener('input', function () {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function () {
        searchQuery = searchInput.value;
        renderClientList();
      }, 150);
    });

    $('#load-demo-btn').addEventListener('click', function () {
      window.SeedDemo.load().then(function (result) {
        if (result.loaded) {
          announce('Demo data loaded: 3 sample clients with sessions, payments, and notes.');
        } else {
          announce('Demo data is already loaded.');
        }
        return renderListView();
      }).catch(function (err) {
        console.error(err);
        announce('Something went wrong loading the demo data.');
      });
    });

    $('#clear-demo-btn').addEventListener('click', function () {
      if (!window.confirm('Remove all demo data?\n\nThe 3 sample clients and all of their sessions, payments, and notes will be deleted. Your real clients are not affected.')) {
        return;
      }
      window.SeedDemo.clear().then(function (counts) {
        announce('Demo data cleared: ' + pluralize(counts.clients, 'client') + ', ' +
          pluralize(counts.sessions, 'session') + ', and ' +
          pluralize(counts.payments, 'payment record') + ' removed.');
        return renderListView();
      }).catch(function (err) {
        console.error(err);
        announce('Something went wrong clearing the demo data.');
      });
    });

    // client form
    $('#client-form').addEventListener('submit', submitClientForm);
    $('#client-form-cancel').addEventListener('click', function () {
      if (editingClientId) {
        openDetail(editingClientId);
      } else {
        showView('list');
      }
    });

    // detail view
    $('#back-to-list').addEventListener('click', function () {
      currentClientId = null;
      showView('list');
      renderListView();
    });
    $('#edit-client-btn').addEventListener('click', function () {
      window.db.clients.get(currentClientId).then(function (client) {
        if (client) openForm(client);
      });
    });
    $('#delete-client-btn').addEventListener('click', deleteCurrentClient);

    $('#toggle-session-form').addEventListener('click', function () {
      toggleFormWrap($('#toggle-session-form'), $('#session-form-wrap'));
    });
    $('#session-form-cancel').addEventListener('click', function () {
      toggleFormWrap($('#toggle-session-form'), $('#session-form-wrap'));
    });
    $('#session-form').addEventListener('submit', submitSessionForm);

    $('#toggle-payment-form').addEventListener('click', function () {
      $('#pf-date').value = todayLocal();
      toggleFormWrap($('#toggle-payment-form'), $('#payment-form-wrap'));
    });
    $('#payment-form-cancel').addEventListener('click', function () {
      toggleFormWrap($('#toggle-payment-form'), $('#payment-form-wrap'));
    });
    $('#payment-form').addEventListener('submit', submitPaymentForm);

    $('#note-form').addEventListener('submit', submitNoteForm);

    renderListView();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
