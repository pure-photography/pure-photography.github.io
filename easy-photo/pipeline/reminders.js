/* EASY PHOTO — Reminder engine (reminders.js).
 * Local-only: rules run against the db shim (or real db.js), reminder
 * dismiss/snooze state lives in localStorage. No backend, no network.
 *
 * REMINDER RULES
 *   1. confirm  — session in 0–3 days and status = booked → remind to confirm
 *                 (includes a note when the retainer is still owed).
 *   2. collect  — status = delivered and balance due > $0 → remind to collect
 *                 (breaks down retainer vs balance owed).
 *   3. lead     — lead still "new" for 48h+ → follow up.
 *   4. overdue  — status = booked but the date has passed → mark shot or fix date.
 *
 * Each reminder has a stable id ("rule:entityId") so done/snooze sticks.
 * Panel actions: Done (dismiss for good) / Snooze (hide for 24h).
 */
(function () {
  'use strict';

  var STATE_KEY = 'ep.reminderState';
  var SNOOZE_HOURS = 24;

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveState(st) {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(st)); } catch (e) { /* full */ }
  }

  function nameOf(s) { return s.clientName || 'Unnamed client'; }

  async function getDue(now) {
    now = now || new Date();
    var due = [];

    for (var s of await window.db.sessions.all()) {
      if (s.status === 'booked' && s.date) {
        var days = EP.daysUntil(s.date);
        if (days !== null && days >= 0 && days <= 3) {
          var l = await EP.ledger(s);
          var when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'in ' + days + ' days';
          due.push({
            id: 'confirm:' + s.id,
            title: 'Confirm session: ' + nameOf(s),
            detail: (s.sessionType || 'Session') + ' on ' + EP.fmtDate(s.date) + ' (' + when + ').' +
                    (l.retainerDue > 0.009 ? ' Retainer of ' + EP.money(l.retainerDue) + ' still owed.' : '')
          });
        } else if (days !== null && days < 0) {
          due.push({
            id: 'overdue:' + s.id,
            title: 'Session date passed: ' + nameOf(s),
            detail: (s.sessionType || 'Session') + ' was ' + EP.fmtDate(s.date) +
                    ' — mark it Shot or update the date.'
          });
        }
      }
      if (s.status === 'delivered') {
        var led = await EP.ledger(s);
        if (!led.paidInFull) {
          var parts = [];
          if (led.retainerDue > 0.009) parts.push(EP.money(led.retainerDue) + ' retainer');
          var rest = led.balanceDue - led.retainerDue;
          if (rest > 0.009) parts.push(EP.money(rest) + ' balance');
          due.push({
            id: 'collect:' + s.id,
            title: 'Collect payment: ' + nameOf(s),
            detail: EP.money(Math.max(0, led.balanceDue)) + ' still owed' +
                    (parts.length ? ' (' + parts.join(' + ') + ')' : '') + '.'
          });
        }
      }
    }

    for (var l of await window.db.leads.all()) {
      if (l.status === 'new') {
        var ageMs = now - new Date(l.createdAt);
        if (ageMs >= 48 * 3600000) {
          var hrs = Math.round(ageMs / 3600000);
          due.push({
            id: 'lead:' + l.id,
            title: 'Follow up with lead: ' + (l.name || 'Unnamed lead'),
            detail: 'New for ' + (hrs >= 48 ? Math.floor(hrs / 24) + ' days' : hrs + ' hours') +
                    (l.contact ? ' — ' + l.contact : '') + '.'
          });
        }
      }
    }

    var state = loadState();
    return due.filter(function (r) {
      var st = state[r.id];
      if (!st) return true;
      if (st.state === 'done') return false;
      if (st.state === 'snoozed' && now.getTime() < st.until) return false;
      return true;
    });
  }

  function setState(id, patch) {
    var st = loadState();
    st[id] = Object.assign(st[id] || {}, patch);
    saveState(st);
  }

  async function renderPanel(container, opts) {
    opts = opts || {};
    var due = await getDue();
    container.innerHTML = '';
    due.forEach(function (r) {
      var li = document.createElement('li');
      li.className = 'reminder';
      li.innerHTML =
        '<div class="rem-text"><strong>' + EP.esc(r.title) + '</strong>' +
        '<small>' + EP.esc(r.detail) + '</small></div>' +
        '<div class="rem-actions">' +
        '<button type="button" class="small" data-rem="snooze" data-id="' + EP.esc(r.id) + '">Snooze 24h</button>' +
        '<button type="button" class="small primary" data-rem="done" data-id="' + EP.esc(r.id) + '">Done</button>' +
        '</div>';
      container.appendChild(li);
    });
    if (opts.countEl) opts.countEl.textContent = String(due.length);
    if (opts.emptyEl) opts.emptyEl.hidden = due.length > 0;

    container.onclick = function (ev) {
      var btn = ev.target.closest('button[data-rem]');
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      var action = btn.getAttribute('data-rem');
      if (action === 'done') {
        setState(id, { state: 'done' });
        EP.announce('Reminder marked done.');
      } else {
        setState(id, { state: 'snoozed', until: Date.now() + SNOOZE_HOURS * 3600000 });
        EP.announce('Reminder snoozed for 24 hours.');
      }
      renderPanel(container, opts);
    };
  }

  window.EasyPhotoReminders = {
    getDue: getDue,
    renderPanel: renderPanel,
    done: function (id) { setState(id, { state: 'done' }); },
    snooze: function (id, hours) {
      setState(id, { state: 'snoozed', until: Date.now() + (hours || SNOOZE_HOURS) * 3600000 });
    },
    /* Testing hook: clear all dismiss/snooze state. */
    resetState: function () { try { localStorage.removeItem(STATE_KEY); } catch (e) {} }
  };
})();
