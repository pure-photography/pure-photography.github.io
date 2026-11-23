/* ============================================================================
 * EASY PHOTO — Demo seed data (clients workstream)
 * ----------------------------------------------------------------------------
 * Creates 3 realistic sample clients with sessions, payments and notes so
 * Mary can see the Clients screen working immediately.
 *
 * Everything created here is clearly marked DEMO DATA:
 *   - every client, session and payment gets `demo: true`
 *   - every demo client gets the "demo" tag
 *   - the Clients screen labels it as demo and offers one-tap
 *     "Clear demo data", which removes ALL demo records.
 *
 * Dates are relative to today so the demo always looks sensible:
 *   - Sharon Mitchell: completed couples session, fully paid (past)
 *   - Jill McAllister: completed family session, $10 balance still due (past)
 *   - Tonia Williams:  upcoming portrait session, nothing paid yet (future)
 *
 * Uses ONLY the agreed db contract (no shim extras), so it keeps working
 * when the real shared db.js replaces the shim.
 *
 * API:
 *   SeedDemo.load()   -> Promise<{ loaded: boolean, reason?: string }>
 *   SeedDemo.clear()  -> Promise<{ clients: n, sessions: n, payments: n }>
 *   SeedDemo.hasDemo() -> Promise<boolean>
 * ========================================================================== */
window.SeedDemo = (function () {
  'use strict';

  function isoDaysFromNow(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  function hoursAgo(h) {
    return new Date(Date.now() - h * 3600 * 1000).toISOString();
  }

  var DEMO_CLIENTS = [
    {
      name: 'Sharon Mitchell',
      email: 'sharon.mitchell@example.com',
      phone: '(803) 555-0142',
      address: '42 Magnolia Lane, York, SC 29745',
      source: 'Referral',
      notes: 'Prefers golden-hour light. Bring the long lens for the park shots.',
      tags: ['couples', 'repeat'],
      sessions: [
        {
          type: 'Couples session',
          date: isoDaysFromNow(-21),
          time: '17:30',
          location: 'York City Park',
          status: 'paid',
          price: 30,
          retainerPaid: 20,
          notes: 'Sweet light, great session. They want holiday cards from these photos.',
          payments: [
            { amount: 20, method: 'Cash App', date: isoDaysFromNow(-28), type: 'retainer', note: 'Nonrefundable retainer' },
            { amount: 10, method: 'Cash App', date: isoDaysFromNow(-21), type: 'payment', note: 'Final payment after session' }
          ]
        }
      ],
      extraNotes: [
        { text: 'Sharon texted that she loved the gallery — ask for a review next week.', createdAt: hoursAgo(30) }
      ]
    },
    {
      name: 'Jill McAllister',
      email: 'jill.mcallister@example.com',
      phone: '(803) 555-0198',
      address: '17 Dogwood Court, York, SC 29745',
      source: 'Instagram',
      notes: 'First-time client. Two kids, ages 4 and 7 — keep sessions short and playful.',
      tags: ['family', 'new'],
      sessions: [
        {
          type: 'Family session',
          date: isoDaysFromNow(-5),
          time: '10:00',
          location: 'Downtown York',
          status: 'paid',
          price: 30,
          retainerPaid: 20,
          notes: 'Kids did great. Gallery delivered.',
          payments: [
            { amount: 20, method: 'PayPal', date: isoDaysFromNow(-12), type: 'retainer', note: 'Nonrefundable retainer' }
          ]
        }
      ],
      extraNotes: [
        { text: 'Balance of $10 still due — send a friendly reminder text.', createdAt: hoursAgo(50) }
      ]
    },
    {
      name: 'Tonia Williams',
      email: 'tonia.williams@example.com',
      phone: '(704) 555-0117',
      address: '890 Pinecrest Drive, Clover, SC 29710',
      source: 'Google',
      notes: 'Found the site through Google search. Wants classic headshot-style portraits.',
      tags: ['portraits', 'new'],
      sessions: [
        {
          type: 'Portrait session',
          date: isoDaysFromNow(6),
          time: '14:00',
          location: 'Downtown York',
          status: 'booked',
          price: 30,
          retainerPaid: 0,
          notes: 'First session — send the prep checklist the day before.',
          payments: []
        }
      ],
      extraNotes: [
        { text: 'Tonia asked about bringing her dog for one photo — confirmed okay (on leash).', createdAt: hoursAgo(5) }
      ]
    }
  ];

  function hasDemo() {
    return window.db.clients.all().then(function (clients) {
      return clients.some(function (c) { return c.demo === true; });
    });
  }

  // Append a timestamped note with an exact timestamp (demo data is
  // back-dated so the timeline looks real). Uses only contract calls.
  function appendNoteWithDate(clientId, text, createdAt) {
    return window.db.clients.get(clientId).then(function (rec) {
      var log = (rec.notesLog || []).slice();
      log.push({
        id: 'demo-' + Math.random().toString(36).slice(2, 10),
        text: text,
        createdAt: createdAt
      });
      return window.db.clients.update(clientId, { notesLog: log });
    });
  }

  function load() {
    return hasDemo().then(function (exists) {
      if (exists) return { loaded: false, reason: 'already-loaded' };
      var chain = Promise.resolve();
      DEMO_CLIENTS.forEach(function (demo) {
        chain = chain.then(function () {
          var tags = (demo.tags || []).slice();
          if (tags.indexOf('demo') === -1) tags.push('demo');
          return window.db.clients
            .add({
              name: demo.name,
              email: demo.email,
              phone: demo.phone,
              address: demo.address,
              source: demo.source,
              notes: demo.notes, // shim stores this as the first timeline note
              tags: tags
            })
            .then(function (clientId) {
              return window.db.clients
                .update(clientId, { demo: true })
                .then(function () {
                  var inner = Promise.resolve();
                  (demo.sessions || []).forEach(function (s) {
                    inner = inner.then(function () {
                      return window.SessionHelpers.createSession({
                        clientId: clientId,
                        type: s.type,
                        date: s.date,
                        time: s.time,
                        location: s.location,
                        status: s.status,
                        price: s.price,
                        retainerPaid: s.retainerPaid,
                        balanceDue: s.price - s.retainerPaid,
                        notes: s.notes,
                        demo: true
                      }).then(function (sessionId) {
                        var payChain = Promise.resolve();
                        (s.payments || []).forEach(function (p) {
                          payChain = payChain.then(function () {
                            return window.db.payments.add({
                              sessionId: sessionId,
                              clientId: clientId,
                              amount: p.amount,
                              method: p.method,
                              date: p.date,
                              type: p.type,
                              note: p.note,
                              demo: true
                            });
                          });
                        });
                        return payChain;
                      });
                    });
                  });
                  (demo.extraNotes || []).forEach(function (n) {
                    inner = inner.then(function () {
                      return appendNoteWithDate(clientId, n.text, n.createdAt);
                    });
                  });
                  return inner;
                });
            });
        });
      });
      return chain.then(function () { return { loaded: true }; });
    });
  }

  // One-tap demo cleanup. Walks every client via the contract and removes
  // demo-flagged payments, sessions and clients. Nothing else is touched.
  function clear() {
    var counts = { clients: 0, sessions: 0, payments: 0 };
    return window.db.clients.all().then(function (clients) {
      var chain = Promise.resolve();
      clients.forEach(function (client) {
        chain = chain.then(function () {
          if (client.demo !== true) return null;
          return window.db.payments.byClient(client.id).then(function (payments) {
            var inner = Promise.resolve();
            payments.forEach(function (p) {
              inner = inner.then(function () {
                if (p.demo !== true) return null;
                counts.payments += 1;
                return window.db.payments.remove(p.id);
              });
            });
            return inner;
          }).then(function () {
            return window.db.sessions.byClient(client.id);
          }).then(function (sessions) {
            var inner = Promise.resolve();
            sessions.forEach(function (s) {
              inner = inner.then(function () {
                if (s.demo !== true) return null;
                counts.sessions += 1;
                return window.SessionHelpers.removeSession(s.id);
              });
            });
            return inner;
          }).then(function () {
            counts.clients += 1;
            return window.db.clients.remove(client.id);
          });
        });
      });
      return chain.then(function () { return counts; });
    });
  }

  return {
    load: load,
    clear: clear,
    hasDemo: hasDemo
  };
})();
