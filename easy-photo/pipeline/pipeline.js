/* EASY PHOTO — Booking pipeline screen (pipeline.js).
 * No drag-and-drop: every stage move is a real button, fully keyboard
 * operable, with a polite aria-live announcement on each move.
 *
 * STAGE GUARDS
 *   inquiry -> booked    : a session date is required before booking.
 *                          Warns (non-blocking) if the retainer is not yet paid.
 *   booked  -> shot      : no hard guard (mark after the shoot happens).
 *   shot    -> delivered : no hard guard.
 *   delivered -> paid    : BLOCKED while balance due > $0. The card tells you
 *                          exactly what is owed (retainer vs balance).
 *   any (except paid) -> lost/cancelled : requires a reason; previous stage
 *                          is kept so the session can be restored.
 */
(function () {
  'use strict';

  var STAGES = [
    { key: 'inquiry',   label: 'Inquiry' },
    { key: 'booked',    label: 'Booked' },
    { key: 'shot',      label: 'Shot' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'paid',      label: 'Paid' }
  ];
  var CLOSE_REASONS = [
    'No response to follow-up',
    'Chose another photographer',
    'Price',
    'Client cancelled',
    'Rescheduling — date to be set',
    'Other'
  ];

  function stageIndex(key) {
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].key === key) return i;
    return -1;
  }

  function cardMsg(article, kind, text) {
    var p = article.querySelector('.card-msg');
    p.hidden = false;
    p.className = 'card-msg ' + kind;
    p.textContent = text;
  }
  function clearMsg(article) {
    var p = article.querySelector('.card-msg');
    p.hidden = true;
    p.textContent = '';
    p.className = 'card-msg';
  }

  /* ---------- guards ---------- */
  async function guardAdvance(session, nextKey) {
    if (nextKey === 'booked' && !session.date) {
      return { ok: false, kind: 'error',
               text: 'Set a session date before booking — a booking needs a date.' };
    }
    if (nextKey === 'paid') {
      var l = await EP.ledger(session);
      if (!l.paidInFull) {
        var parts = [];
        if (l.retainerDue > 0.009) parts.push(EP.money(l.retainerDue) + ' retainer');
        var rest = l.balanceDue - l.retainerDue;
        if (rest > 0.009) parts.push(EP.money(rest) + ' balance');
        return { ok: false, kind: 'error',
                 text: 'Cannot mark Paid — ' + EP.money(Math.max(0, l.balanceDue)) +
                       ' is still owed' + (parts.length ? ' (' + parts.join(' + ') + ')' : '') +
                       '. Record the payment first.' };
      }
    }
    if (nextKey === 'booked') {
      var led = await EP.ledger(session);
      if (led.retainerDue > 0.009) {
        return { ok: true, kind: 'warn',
                 text: 'Booked. Note: the ' + EP.money(led.retainerDue) +
                       ' nonrefundable retainer is still owed — collect it at booking.' };
      }
    }
    return { ok: true, kind: null, text: '' };
  }

  /* ---------- card builders ---------- */
  async function buildCard(session) {
    var li = document.createElement('li');
    var a = document.createElement('article');
    a.className = 'card';
    a.dataset.sessionId = session.id;
    var nameId = 'card-' + session.id + '-name';
    a.setAttribute('aria-labelledby', nameId);

    var l = await EP.ledger(session);
    var idx = stageIndex(session.status);
    var next = STAGES[idx + 1];
    var prev = STAGES[idx - 1];
    var isClosed = session.status === 'lost' || session.status === 'cancelled';

    var html = '<h3 id="' + nameId + '">' + EP.esc(session.clientName || 'Unnamed client') + '</h3>' +
      '<dl>' +
      '<dt>Type</dt><dd>' + EP.esc(session.sessionType || '—') + '</dd>' +
      '<dt>Date</dt><dd>' + EP.esc(EP.fmtDate(session.date)) + '</dd>' +
      '<dt>Price</dt><dd>' + EP.money(l.total) +
        ' (' + EP.money(l.shootFee) + ' shoot + ' + EP.money(l.retainer) + ' retainer)</dd>' +
      '<dt>Retainer</dt><dd>' + EP.money(l.retainerPaid) + ' paid of ' + EP.money(l.retainer) +
        ' (nonrefundable)' + (l.retainerDue > 0.009 ? ' — ' + EP.money(l.retainerDue) + ' owed' : '') + '</dd>' +
      '<dt>Balance</dt><dd class="' + (l.paidInFull ? 'paid-full' : 'balance-due') + '">' +
        EP.esc(await EP.balanceText(session)) + '</dd>';

    if (isClosed) {
      html += '<dt>Status</dt><dd>' + EP.esc(EP.statusLabel(session.status)) +
              (session.lostReason ? ' — ' + EP.esc(session.lostReason) : '') + '</dd>';
    }
    html += '</dl>';

    html += '<div class="card-actions">';
    if (!isClosed) {
      if (next) html += '<button type="button" class="primary" data-act="advance">Advance to ' + next.label + '</button>';
      if (prev) html += '<button type="button" data-act="back">Move back to ' + prev.label + '</button>';
      html += '<button type="button" class="danger" data-act="close">Mark lost / cancelled</button>';
      if (session.status === 'inquiry' && !session.date) {
        html += '<button type="button" data-act="setdate">Set session date</button>';
      }
    } else {
      html += '<button type="button" data-act="restore">Restore to ' +
              EP.esc(EP.statusLabel(session.previousStatus || 'inquiry')) + '</button>';
    }
    html += '</div>';

    html += '<p class="card-msg" role="alert" hidden></p>';

    // inline date form (inquiry cards missing a date)
    html += '<form class="date-form" data-form="date" hidden>' +
      '<div class="field-row"><label for="date-' + session.id + '">Session date</label>' +
      '<input type="date" id="date-' + session.id + '" name="date" required></div>' +
      '<div class="form-actions">' +
      '<button type="submit" class="primary">Save date</button>' +
      '<button type="button" data-act="canceldate">Cancel</button></div></form>';

    // inline lost/cancelled form
    var closeLabel = session.status === 'inquiry' ? 'Lost' : 'Cancelled';
    html += '<form class="close-form" data-form="close" hidden>' +
      '<div class="field-row"><label for="reason-' + session.id + '">Reason (' + closeLabel.toLowerCase() + ')</label>' +
      '<select id="reason-' + session.id + '" name="reason" required>' +
      '<option value="">Choose a reason…</option>' +
      CLOSE_REASONS.map(function (r) { return '<option>' + EP.esc(r) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field-row"><label for="note-' + session.id + '">Note (optional)</label>' +
      '<input type="text" id="note-' + session.id + '" name="note" maxlength="200"></div>' +
      '<div class="form-actions">' +
      '<button type="submit" class="danger">Confirm ' + closeLabel.toLowerCase() + '</button>' +
      '<button type="button" data-act="cancelclose">Cancel</button></div></form>';

    a.innerHTML = html;
    li.appendChild(a);
    wireCard(a, session);
    return li;
  }

  function wireCard(article, session) {
    var id = session.id;

    async function refresh() { await render(); }

    article.addEventListener('click', async function (ev) {
      var btn = ev.target.closest('button[data-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      clearMsg(article);

      if (act === 'advance') {
        var next = STAGES[stageIndex(session.status) + 1];
        var g = await guardAdvance(session, next.key);
        if (!g.ok) {
          cardMsg(article, g.kind, g.text);
          EP.announce('Cannot advance. ' + g.text);
          return;
        }
        await window.db.sessions.update(id, { status: next.key });
        var msg = 'Session for ' + (session.clientName || 'unnamed client') +
                  ' moved to ' + next.label + '.';
        EP.announce(g.text ? msg + ' ' + g.text : msg);
        if (g.kind === 'warn') cardMsg(article, 'warn', g.text); // flash before re-render
        refresh();
      }
      else if (act === 'back') {
        var prev = STAGES[stageIndex(session.status) - 1];
        window.db.sessions.update(id, { status: prev.key });
        EP.announce('Session for ' + (session.clientName || 'unnamed client') +
                    ' moved back to ' + prev.label + '.');
        refresh();
      }
      else if (act === 'close') {
        article.querySelector('[data-form="close"]').hidden = false;
        article.querySelector('[data-form="close"] select').focus();
      }
      else if (act === 'cancelclose') {
        article.querySelector('[data-form="close"]').hidden = true;
      }
      else if (act === 'setdate') {
        article.querySelector('[data-form="date"]').hidden = false;
        article.querySelector('[data-form="date"] input').focus();
      }
      else if (act === 'canceldate') {
        article.querySelector('[data-form="date"]').hidden = true;
      }
      else if (act === 'restore') {
        var backTo = session.previousStatus && stageIndex(session.previousStatus) > -1
                     ? session.previousStatus : 'inquiry';
        window.db.sessions.update(id, { status: backTo, previousStatus: null, lostReason: '' });
        EP.announce('Session for ' + (session.clientName || 'unnamed client') +
                    ' restored to ' + EP.statusLabel(backTo) + '.');
        refresh();
      }
    });

    article.querySelector('[data-form="date"]').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var val = this.date.value;
      if (!val) { cardMsg(article, 'error', 'Pick a date first.'); return; }
      window.db.sessions.update(id, { date: val });
      EP.announce('Session date set to ' + EP.fmtDate(val) + '.');
      refresh();
    });

    article.querySelector('[data-form="close"]').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var reason = this.reason.value;
      if (!reason) { cardMsg(article, 'error', 'Choose a reason — it keeps the records honest.'); return; }
      var note = this.note.value.trim();
      var full = note ? reason + ' — ' + note : reason;
      var newStatus = session.status === 'inquiry' ? 'lost' : 'cancelled';
      window.db.sessions.update(id, {
        status: newStatus, previousStatus: session.status, lostReason: full
      });
      EP.announce('Session for ' + (session.clientName || 'unnamed client') +
                  ' marked ' + EP.statusLabel(newStatus) + ': ' + full);
      refresh();
    });
  }

  /* ---------- render ---------- */
  async function render() {
    for (var st of STAGES) {
      var list = document.getElementById('list-' + st.key);
      var rows = await window.db.sessions.byStatus(st.key);
      document.getElementById('count-' + st.key).textContent = String(rows.length);
      list.innerHTML = '';
      if (!rows.length) {
        var li = document.createElement('li');
        li.innerHTML = '<p class="reminder-empty">No sessions here.</p>';
        list.appendChild(li);
      } else {
        for (var s of rows) { list.appendChild(await buildCard(s)); }
      }
    }

    var closed = (await window.db.sessions.all()).filter(function (s) {
      return s.status === 'lost' || s.status === 'cancelled';
    });
    var cl = document.getElementById('list-closed');
    document.getElementById('count-closed').textContent = String(closed.length);
    cl.innerHTML = '';
    if (!closed.length) {
      cl.innerHTML = '<li><p class="reminder-empty">No lost or cancelled sessions.</p></li>';
    } else {
      for (var cs of closed) { cl.appendChild(await buildCard(cs)); }
    }

    var seedBtn = document.getElementById('seed-btn');
    seedBtn.hidden = (await window.db.sessions.all()).length > 0;

    EasyPhotoReminders.renderPanel(document.getElementById('reminders-list'), {
      emptyEl: document.getElementById('reminders-empty'),
      countEl: document.getElementById('reminders-count')
    });
  }

  document.getElementById('seed-btn').addEventListener('click', function () {
    var r = window.EasyPhotoSeed.loadDemo();
    EP.announce(r.seeded ? 'Demo data loaded.' : 'Demo data not loaded: ' + r.reason);
    render();
  });

  render();
})();
