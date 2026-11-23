/* EASY PHOTO — Payment tracking (payments.js).
 * Record payments, per-session ledgers (retainer vs balance split), and
 * per-client totals. All money as real text. All changes announced.
 */
(function () {
  'use strict';

  var EPS = 0.009;

  async function activeSessions() {
    return (await window.db.sessions.all()).filter(function (s) {
      return s.status !== 'lost' && s.status !== 'cancelled';
    });
  }

  async function sessionLabel(s) {
    var l = await EP.ledger(s);
    return (s.clientName || 'Unnamed client') + ' — ' +
           (s.sessionType || 'Session') + ' — ' + EP.fmtDate(s.date) +
           ' — balance ' + EP.money(Math.max(0, l.balanceDue));
  }

  async function fillSessionSelect(sel, sessions) {
    sel.innerHTML = '';
    var ph = document.createElement('option');
    ph.value = '';
    ph.textContent = sessions.length ? 'Choose a session…' : 'No sessions yet — add one in the CRM first';
    sel.appendChild(ph);
    for (var fs of sessions) {
      var o = document.createElement('option');
      o.value = fs.id;
      o.textContent = await sessionLabel(fs);
      sel.appendChild(o);
    }
  }

  function formError(msg) {
    var p = document.getElementById('form-error');
    if (!msg) { p.hidden = true; p.textContent = ''; return; }
    p.hidden = false;
    p.textContent = msg;
  }

  /* ---------- record payment ---------- */
  async function onSubmit(ev) {
    ev.preventDefault();
    formError(null);
    var f = ev.target;
    var sessionId = f.session.value;
    var amount = Number(f.amount.value);
    var type = f.type.value;

    var session = window.db.sessions.get(sessionId);
    if (!session) { formError('Choose a session for this payment.'); return; }
    if (!(amount > 0)) { formError('Enter an amount greater than $0.'); return; }
    if (!f.date.value) { formError('Pick the payment date.'); return; }

    if (type === 'retainer') {
      var l = await EP.ledger(session);
      if (l.retainerPaid + amount > l.retainer + EPS) {
        formError('That would exceed the agreed retainer of ' + EP.money(l.retainer) +
                  ' (' + EP.money(l.retainerPaid) + ' already paid). Record the rest as Balance.');
        return;
      }
    }

    var p = await window.db.payments.add({
      sessionId: session.id,
      clientId: session.clientId,
      amount: amount,
      method: f.method.value,
      date: f.date.value,
      type: type,
      note: f.note.value.trim()
    });

    EP.announce(EP.money(p.amount) + ' ' + EP.typeLabel(type).toLowerCase() +
                ' payment recorded for ' + (session.clientName || 'unnamed client') +
                ' via ' + EP.methodLabel(p.method) + '.');

    f.amount.value = '';
    f.note.value = '';
    f.type.value = 'balance';
    refresh();
  }

  /* ---------- ledger ---------- */
  async function renderLedger(sessionId) {
    var body = document.getElementById('ledger-body');
    var session = sessionId && await window.db.sessions.get(sessionId);
    if (!session) {
      body.innerHTML = '<p class="empty">Choose a session above to see its ledger.</p>';
      return;
    }
    var l = await EP.ledger(session);

    var html = '<dl class="ledger-summary">' +
      stat('Shoot fee', EP.money(l.shootFee)) +
      stat('Retainer (nonrefundable)', EP.money(l.retainer),
           EP.money(l.retainerPaid) + ' paid' + (l.retainerDue > EPS ? ', ' + EP.money(l.retainerDue) + ' owed' : '')) +
      stat('Session total', EP.money(l.total)) +
      stat('Paid toward session', EP.money(l.totalPaid)) +
      stat('Balance due', EP.money(Math.max(0, l.balanceDue)),
           l.paidInFull ? 'Paid in full' : '') +
      stat('Print payments', EP.money(l.printPaid), 'separate from session balance') +
      '</dl>';

    if (!l.payments.length) {
      html += '<p class="empty">No payments recorded for this session yet.</p>';
    } else {
      html += '<div class="table-wrap"><table>' +
        '<caption>Payments for ' + EP.esc(session.clientName || 'unnamed client') +
        ' — ' + EP.esc(session.sessionType || 'session') + '</caption>' +
        '<thead><tr><th scope="col">Date</th><th scope="col">Type</th>' +
        '<th scope="col">Method</th><th scope="col" class="num">Amount</th>' +
        '<th scope="col">Note</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>' +
        '<tbody>';
      l.payments.forEach(function (p) {
        html += '<tr>' +
          '<td>' + EP.esc(EP.fmtDate(p.date)) + '</td>' +
          '<td>' + EP.esc(EP.typeLabel(p.type)) + '</td>' +
          '<td>' + EP.esc(EP.methodLabel(p.method)) + '</td>' +
          '<td class="num">' + EP.money(p.amount) + '</td>' +
          '<td class="note-cell">' + EP.esc(p.note || '—') + '</td>' +
          '<td><button type="button" class="small danger" data-del="' + EP.esc(p.id) + '">Delete</button></td>' +
          '</tr>';
      });
      html += '</tbody></table></div>';
    }
    body.innerHTML = html;

    body.querySelectorAll('button[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pid = btn.getAttribute('data-del');
        var pays = window.db.payments.all();
        var target = null;
        pays.forEach(function (p) { if (p.id === pid) target = p; });
        if (!target) return;
        if (!window.confirm('Delete this ' + EP.money(target.amount) + ' ' +
                            EP.typeLabel(target.type).toLowerCase() +
                            ' payment? This cannot be undone.')) return;
        window.db.payments.remove(pid);
        EP.announce('Payment of ' + EP.money(target.amount) + ' deleted.');
        refresh();
      });
    });
  }

  function stat(term, value, sub) {
    return '<div class="stat"><dt>' + EP.esc(term) + '</dt><dd>' + EP.esc(value) +
           (sub ? '<span class="sub">' + EP.esc(sub) + '</span>' : '') + '</dd></div>';
  }

  /* ---------- per-client totals ---------- */
  async function renderTotals() {
    var tbody = document.querySelector('#client-totals tbody');
    var empty = document.getElementById('totals-empty');

    // aggregate by clientId (fall back to clientName) across sessions + payments
    var map = {};
    function key(s) { return s.clientId || ('name:' + (s.clientName || 'unnamed')); }
    async function ensure(s) {
      var k = key(s);
      if (!map[k]) {
        var c = s.clientId ? await window.db.clients.get(s.clientId) : null;
        map[k] = { name: (c && c.name) || s.clientName || 'Unnamed client',
                   sessions: 0, booked: 0, paid: 0, outstanding: 0, prints: 0 };
      }
      return map[k];
    }

    for (var s of await window.db.sessions.all()) {
      var active = s.status !== 'lost' && s.status !== 'cancelled';
      var t = await ensure(s);
      if (active) {
        t.sessions += 1;
        t.booked += EP.sessionTotal(s);
        t.outstanding += Math.max(0, (await EP.ledger(s)).balanceDue);
      }
      for (var p of await window.db.payments.bySession(s.id)) {
        var a = Number(p.amount) || 0;
        if (p.type === 'print') t.prints += a;
        else t.paid += a;
      }
    }

    var rows = Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });

    tbody.innerHTML = '';
    empty.hidden = rows.length > 0;
    rows.forEach(function (t) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<th scope="row">' + EP.esc(t.name) + '</th>' +
        '<td class="num">' + t.sessions + '</td>' +
        '<td class="num">' + EP.money(t.booked) + '</td>' +
        '<td class="num">' + EP.money(t.paid) + '</td>' +
        '<td class="num">' + EP.money(t.outstanding) + '</td>' +
        '<td class="num">' + EP.money(t.prints) + '</td>';
      tbody.appendChild(tr);
    });
  }

  /* ---------- refresh ---------- */
  var ledgerSel = document.getElementById('ledger-session');
  async function refresh() {
    var sessions = await activeSessions();
    var formSel = document.getElementById('f-session');
    var prevForm = formSel.value;
    var prevLedger = ledgerSel.value;
    await fillSessionSelect(formSel, sessions);
    await fillSessionSelect(ledgerSel, sessions);
    if (prevForm && await window.db.sessions.get(prevForm)) formSel.value = prevForm;
    if (prevLedger && await window.db.sessions.get(prevLedger)) {
      ledgerSel.value = prevLedger;
    } else if (sessions.length) {
      ledgerSel.value = sessions[0].id;
    }
    await renderLedger(ledgerSel.value);
    await renderTotals();
  }

  ledgerSel.addEventListener('change', async function () { await renderLedger(ledgerSel.value); });
  document.getElementById('payment-form').addEventListener('submit', onSubmit);
  document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);

  refresh();
})();
