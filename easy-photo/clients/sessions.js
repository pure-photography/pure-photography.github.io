/* ============================================================================
 * EASY PHOTO — Session helpers (shared)
 * ----------------------------------------------------------------------------
 * Small CRUD helper layer over db.sessions / db.payments, shared by every
 * page that touches sessions (Clients screen today; Sessions/Calendar
 * screens later). All functions return Promises.
 *
 *   SessionHelpers.createSession(data)        -> Promise<sessionId>
 *   SessionHelpers.updateSessionStatus(id, status) -> Promise<void>
 *   SessionHelpers.listSessionsByClient(clientId)  -> Promise<Session[]>
 *   SessionHelpers.listUpcomingSessions()          -> Promise<Session[]>
 *   SessionHelpers.getSession(id)                  -> Promise<Session|undefined>
 *   SessionHelpers.getSessionBalance(sessionId)
 *        -> Promise<{ price, paid, balance }> | null when session missing
 *   SessionHelpers.removeSession(id)               -> Promise<void>
 *        (also removes that session's payments — a session delete is a
 *        full cleanup, confirmed by the caller first)
 * ========================================================================== */
window.SessionHelpers = (function () {
  'use strict';

  function createSession(data) {
    var record = Object.assign(
      { status: 'booked', createdAt: new Date().toISOString() },
      data
    );
    return window.db.sessions.add(record);
  }

  function updateSessionStatus(id, status) {
    return window.db.sessions.update(id, { status: status });
  }

  function listSessionsByClient(clientId) {
    return window.db.sessions.byClient(clientId);
  }

  function listUpcomingSessions() {
    return window.db.sessions.upcoming();
  }

  function getSession(id) {
    return window.db.sessions.get(id);
  }

  // Balance is always derived from payment records — the single source of
  // truth — so it can never drift out of sync with what was actually paid.
  function getSessionBalance(sessionId) {
    return getSession(sessionId).then(function (session) {
      if (!session) return null;
      return window.db.payments.bySession(sessionId).then(function (payments) {
        var paid = payments.reduce(function (sum, p) {
          return sum + Number(p.amount || 0);
        }, 0);
        var price = Number(session.price || 0);
        return { price: price, paid: paid, balance: price - paid };
      });
    });
  }

  function removeSession(id) {
    return window.db.payments
      .bySession(id)
      .then(function (payments) {
        var chain = Promise.resolve();
        payments.forEach(function (p) {
          chain = chain.then(function () {
            return window.db.payments.remove(p.id);
          });
        });
        return chain;
      })
      .then(function () {
        return window.db.sessions.remove(id);
      });
  }

  return {
    createSession: createSession,
    updateSessionStatus: updateSessionStatus,
    listSessionsByClient: listSessionsByClient,
    listUpcomingSessions: listUpcomingSessions,
    getSession: getSession,
    getSessionBalance: getSessionBalance,
    removeSession: removeSession
  };
})();
