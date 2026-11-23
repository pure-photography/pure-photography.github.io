/* EASY PHOTO — pipeline workstream shared helpers (common.js).
 * Loaded after db-shim.js on every pipeline/ screen. */
(function () {
  'use strict';

  var EP = (window.EP = window.EP || {});

  /* Money: always real text, always 2 decimals, never color-only. */
  EP.money = function (n) {
    var v = Number(n);
    if (!isFinite(v)) v = 0;
    var sign = v < 0 ? '-' : '';
    return sign + '$' + Math.abs(v).toFixed(2);
  };

  EP.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* "Oct 25, 2026" — plain text, never inferred from photo timestamps. */
  EP.fmtDate = function (iso) {
    if (!iso) return 'No date set';
    var d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso);
    if (isNaN(d)) return 'No date set';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  /* Whole days from today (start-of-day) to the given ISO date. */
  EP.daysUntil = function (iso) {
    if (!iso) return null;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso);
    if (isNaN(d)) return null;
    d.setHours(0, 0, 0, 0);
    return Math.round((d - today) / 86400000);
  };

  /* Pricing model: price = shootFee + retainer; retainer is part of the
   * total and is nonrefundable. Print payments never reduce session balance. */
  EP.sessionTotal = function (s) {
    return (Number(s.shootFee) || 0) + (Number(s.retainer) || 0);
  };

  /* Ledger math for one session. Returns real numbers, never just colors. */
  EP.ledger = async function (session) {
    var pays = await window.db.payments.bySession(session.id);
    var retainerPaid = 0, balancePaid = 0, printPaid = 0;
    pays.forEach(function (p) {
      var a = Number(p.amount) || 0;
      if (p.type === 'retainer') retainerPaid += a;
      else if (p.type === 'print') printPaid += a;
      else balancePaid += a;
    });
    var total = EP.sessionTotal(session);
    var retainerDue = Math.max(0, (Number(session.retainer) || 0) - retainerPaid);
    var balanceDue = total - retainerPaid - balancePaid;
    return {
      payments: pays,
      total: total,
      retainer: Number(session.retainer) || 0,
      shootFee: Number(session.shootFee) || 0,
      retainerPaid: retainerPaid,
      retainerDue: retainerDue,
      balancePaid: balancePaid,
      printPaid: printPaid,
      totalPaid: retainerPaid + balancePaid,
      balanceDue: balanceDue,
      paidInFull: balanceDue <= 0.009
    };
  };

  EP.balanceText = async function (session) {
    var l = await EP.ledger(session);
    if (l.paidInFull) return 'Paid in full';
    var parts = [];
    if (l.retainerDue > 0.009) parts.push(EP.money(l.retainerDue) + ' retainer');
    var rest = l.balanceDue - l.retainerDue;
    if (rest > 0.009) parts.push(EP.money(rest) + ' balance');
    else if (rest < -0.009) parts.push('overpaid by ' + EP.money(-rest));
    return 'Balance due: ' + EP.money(Math.max(0, l.balanceDue)) +
           (parts.length ? ' (' + parts.join(', ') + ')' : '');
  };

  /* Polite screen-reader announcements for stage moves, payments, etc. */
  EP.announce = function (msg) {
    var live = document.getElementById('live');
    if (!live) return;
    live.textContent = '';
    window.setTimeout(function () { live.textContent = msg; }, 30);
  };

  EP.methodLabel = function (m) {
    return { cash: 'Cash', cashapp: 'Cash App', venmo: 'Venmo', card: 'Card', other: 'Other' }[m] || 'Other';
  };
  EP.typeLabel = function (t) {
    return { retainer: 'Retainer', balance: 'Balance', print: 'Print' }[t] || t;
  };
  EP.statusLabel = function (s) {
    return { inquiry: 'Inquiry', booked: 'Booked', shot: 'Shot',
             delivered: 'Delivered', paid: 'Paid',
             lost: 'Lost', cancelled: 'Cancelled' }[s] || s;
  };
})();
