/* Easy Photo — IndexedDB persistence layer (FOUNDATION workstream)
 *
 * Vanilla JS, no build step, no backend. Promise-based CRUD over five stores.
 *
 *   EasyPhoto.db.ready.then(db => db.clients.add({ name, email, ... }))
 *
 * Field names below are the shared contract — other workstreams code against
 * them, so do NOT rename fields without bumping DB_VERSION and migrating.
 *
 * A `window.db` alias exposes the same stores for page code written against
 * the temporary shims (each call waits for the database to open). New code
 * should prefer EasyPhoto.db.ready.
 *
 * Convenience queries (all Promise-based, index-backed):
 *   db.clients.search(query)        substring over name/email/phone
 *   db.clients.addNote(id, text)    append timestamped note
 *   db.sessions.byClient(id)        newest date first
 *   db.sessions.byStatus(status)
 *   db.sessions.upcoming()          inquiry/booked, date >= today, soonest first
 *   db.payments.byClient(id)         newest first
 *   db.payments.bySession(id)       newest first
 *   db.availability.set(date, status, note)  — or set(date, {status, note})
 *
 * Stores:
 *   clients      id (auto) | name, email, phone, address, source, notes,
 *                            tags[], createdAt
 *   sessions     id (auto) | clientId, type, date (ISO), time, location,
 *                            status ('inquiry'|'booked'|'shot'|'delivered'|'paid'),
 *                            price, retainerPaid, balanceDue, notes, createdAt
 *   leads        id (auto) | name, contact, channel ('sms'|'email'|'dm'),
 *                            requestedDate (ISO), message, availabilityChecked (bool),
 *                            status ('new'|'contacted'|'converted'|'lost'), createdAt
 *   payments     id (auto) | sessionId, clientId, amount, method, date (ISO),
 *                            type ('retainer'|'balance'|'print'), note
 *   availability date (ISO, key) | status ('free'|'booked'|'blocked'), note
 *   galleries    id (auto) | clientId, title, slug (unique), isPrivate,
 *                            createdAt
 *   photos       id (auto) | galleryId, fileName, alt, blob, type, size,
 *                            createdAt
 *   subscribers  id (auto) | email (unique), name, source,
 *                            status ('subscribed'|'unsubscribed'), createdAt
 *   settings     key | value   (connections, website, print store, AI choice)
 *   accounts     email (key) | name, passwordHash, createdAt
 *   agentKeys    id (auto) | owner (email), name, keyHash (unique), revoked,
 *                            lastUsedAt, createdAt
 *   bookingForms id (auto) | owner (email), title, businessName,
 *                            shootTypes[], createdAt
 *
 * ACCOUNTS AND SCOPING: accounts live on this device only. When somebody is
 * signed in, EasyPhoto.db.currentOwner is their business email, and the data
 * layer stamps it onto new records in the owned stores (clients, sessions,
 * leads, payments, galleries, photos, subscribers, bookingForms, agentKeys)
 * and hides other owners' records from reads. Records with no owner (made
 * before sign-in, e.g. demo data) stay visible to everyone. Settings and
 * availability are device-level and are never scoped.
 *
 * Photos are stored as Blobs in IndexedDB on this device. They are NOT
 * uploaded anywhere: Easy Photo has no server. A JSON backup (exportAll)
 * cannot carry photo files — use each gallery's Download flow for those.
 */
(function (global) {
  'use strict';

  var DB_NAME = 'easy-photo-db';
  var DB_VERSION = 3;

  /* Signed-in owner's email (set by EasyPhoto.auth). Null when signed out.
   * The data layer stamps it onto new records in owned stores and hides
   * other owners' records from reads. See the header comment. */
  var currentOwner = null;

  function setCurrentOwner(email) {
    currentOwner = email ? String(email).toLowerCase() : null;
  }
  function getCurrentOwner() { return currentOwner; }

  /* Canonical enum values. Validation warns (never throws) on unknown values
   * so a future workstream can extend a list without breaking the data layer. */
  var SESSION_STATUSES = ['inquiry', 'booked', 'shot', 'delivered', 'paid'];
  var LEAD_STATUSES = ['new', 'contacted', 'converted', 'lost'];
  var LEAD_CHANNELS = ['sms', 'email', 'dm', 'form'];
  var PAYMENT_TYPES = ['retainer', 'balance', 'print'];
  var AVAILABILITY_STATUSES = ['free', 'booked', 'blocked'];
  var SUBSCRIBER_STATUSES = ['subscribed', 'unsubscribed'];

  var SCHEMA = {
    clients: {
      keyPath: 'id', autoIncrement: true, timestamps: true,
      indexes: [
        { name: 'byEmail', keyPath: 'email', unique: true },
        { name: 'byName', keyPath: 'name' },
        { name: 'byCreatedAt', keyPath: 'createdAt' },
        { name: 'byTag', keyPath: 'tags', multiEntry: true }
      ]
    },
    sessions: {
      keyPath: 'id', autoIncrement: true, timestamps: true,
      indexes: [
        { name: 'byClient', keyPath: 'clientId' },
        { name: 'byDate', keyPath: 'date' },
        { name: 'byStatus', keyPath: 'status' },
        { name: 'byCreatedAt', keyPath: 'createdAt' }
      ]
    },
    leads: {
      keyPath: 'id', autoIncrement: true, timestamps: true,
      indexes: [
        { name: 'byStatus', keyPath: 'status' },
        { name: 'byRequestedDate', keyPath: 'requestedDate' },
        { name: 'byChannel', keyPath: 'channel' },
        { name: 'byCreatedAt', keyPath: 'createdAt' }
      ]
    },
    payments: {
      keyPath: 'id', autoIncrement: true, timestamps: false,
      indexes: [
        { name: 'bySession', keyPath: 'sessionId' },
        { name: 'byClient', keyPath: 'clientId' },
        { name: 'byDate', keyPath: 'date' },
        { name: 'byType', keyPath: 'type' }
      ]
    },
    availability: {
      keyPath: 'date', autoIncrement: false, timestamps: false,
      indexes: [
        { name: 'byStatus', keyPath: 'status' }
      ]
    },
    galleries: {
      keyPath: 'id', autoIncrement: true, timestamps: true,
      indexes: [
        { name: 'byClient', keyPath: 'clientId' },
        { name: 'bySlug', keyPath: 'slug', unique: true },
        { name: 'byCreatedAt', keyPath: 'createdAt' }
      ]
    },
    photos: {
      keyPath: 'id', autoIncrement: true, timestamps: true,
      indexes: [
        { name: 'byGallery', keyPath: 'galleryId' },
        { name: 'byCreatedAt', keyPath: 'createdAt' }
      ]
    },
    subscribers: {
      keyPath: 'id', autoIncrement: true, timestamps: true,
      indexes: [
        { name: 'byEmail', keyPath: 'email', unique: true },
        { name: 'byStatus', keyPath: 'status' },
        { name: 'byCreatedAt', keyPath: 'createdAt' }
      ]
    },
    settings: {
      keyPath: 'key', autoIncrement: false, timestamps: false,
      indexes: []
    },
    accounts: {
      keyPath: 'email', autoIncrement: false, timestamps: true,
      indexes: [
        { name: 'byCreatedAt', keyPath: 'createdAt' }
      ]
    },
    agentKeys: {
      keyPath: 'id', autoIncrement: true, timestamps: true,
      indexes: [
        { name: 'byOwner', keyPath: 'owner' },
        { name: 'byKeyHash', keyPath: 'keyHash', unique: true },
        { name: 'byCreatedAt', keyPath: 'createdAt' }
      ]
    },
    bookingForms: {
      keyPath: 'id', autoIncrement: true, timestamps: true,
      indexes: [
        { name: 'byOwner', keyPath: 'owner' },
        { name: 'byCreatedAt', keyPath: 'createdAt' }
      ]
    }
  };

  var ENUM_CHECKS = {
    sessions: { status: SESSION_STATUSES },
    leads: { status: LEAD_STATUSES, channel: LEAD_CHANNELS },
    payments: { type: PAYMENT_TYPES },
    availability: { status: AVAILABILITY_STATUSES },
    subscribers: { status: SUBSCRIBER_STATUSES }
  };

  function warnEnum(storeName, record) {
    var checks = ENUM_CHECKS[storeName];
    if (!checks) return;
    Object.keys(checks).forEach(function (field) {
      var v = record[field];
      if (v !== undefined && v !== null && checks[field].indexOf(v) === -1) {
        // eslint-disable-next-line no-console
        console.warn('[EasyPhoto.db] unexpected ' + storeName + '.' + field +
          ' value: ' + JSON.stringify(v) + ' (expected one of ' +
          checks[field].join(', ') + ')');
      }
    });
  }

  function reqToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () {
        reject(req.error || new Error('IndexedDB request failed'));
      };
    });
  }

  function openDatabase() {
    return new Promise(function (resolve, reject) {
      if (!('indexedDB' in global)) {
        reject(new Error('IndexedDB is not available in this browser.'));
        return;
      }
      var req = global.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        Object.keys(SCHEMA).forEach(function (storeName) {
          var def = SCHEMA[storeName];
          if (db.objectStoreNames.contains(storeName)) return;
          var store = db.createObjectStore(storeName, {
            keyPath: def.keyPath,
            autoIncrement: !!def.autoIncrement
          });
          (def.indexes || []).forEach(function (idx) {
            store.createIndex(idx.name, idx.keyPath, {
              unique: !!idx.unique,
              multiEntry: !!idx.multiEntry
            });
          });
        });
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function () {
        reject(req.error || new Error('Could not open Easy Photo database.'));
      };
      req.onblocked = function () {
        // eslint-disable-next-line no-console
        console.warn('[EasyPhoto.db] database open blocked by another tab.');
      };
    });
  }

  function collectAll(store, indexName, key, direction, limit) {
    return new Promise(function (resolve, reject) {
      var out = [];
      var source = indexName ? store.index(indexName) : store;
      var req = source.openCursor(key === undefined ? null : key,
        direction || 'next');
      req.onsuccess = function () {
        var cursor = req.result;
        if (!cursor || (limit && out.length >= limit)) {
          resolve(out);
          return;
        }
        out.push(cursor.value);
        cursor.continue();
      };
      req.onerror = function () {
        reject(req.error || new Error('IndexedDB cursor failed'));
      };
    });
  }

  function byDateDesc(a, b) {
    return String(b.date || '').localeCompare(String(a.date || ''));
  }
  function byDateAsc(a, b) {
    return String(a.date || '').localeCompare(String(b.date || ''));
  }
  function todayISODate() {
    var d = new Date();
    function pad(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function makeStore(db, storeName) {
    var def = SCHEMA[storeName];

    /* Per-account scoping (see header). Set by EasyPhoto.auth after sign-in.
     * Records in the owned stores are stamped with the signed-in owner's
     * email on write and hidden from other owners on read. */
    var OWNED_STORES = ['clients', 'sessions', 'leads', 'payments',
      'galleries', 'photos', 'subscribers', 'bookingForms', 'agentKeys'];
    var isOwned = OWNED_STORES.indexOf(storeName) !== -1;

    function visible(rec) {
      if (!isOwned || !currentOwner || !rec) return true;
      return !rec.owner || rec.owner === currentOwner;
    }

    function stamp(rec) {
      if (isOwned && currentOwner && rec.owner == null) {
        rec.owner = currentOwner;
      }
      return rec;
    }

    function store(mode) {
      return db.transaction(storeName, mode).objectStore(storeName);
    }

    return {
      /** add(record) -> Promise<id>. Sets createdAt when the store uses it. */
      add: function (record) {
        var rec = stamp(Object.assign({}, record));
        if (def.timestamps && rec.createdAt == null) {
          rec.createdAt = new Date().toISOString();
        }
        warnEnum(storeName, rec);
        return reqToPromise(store('readwrite').add(rec));
      },

      /** put(record) -> Promise<key>. Upsert: inserts or replaces by key. */
      put: function (record) {
        var rec = stamp(Object.assign({}, record));
        warnEnum(storeName, rec);
        return reqToPromise(store('readwrite').put(rec));
      },

      /** get(id) -> Promise<record|undefined> */
      get: function (id) {
        return reqToPromise(store('readonly').get(id)).then(function (rec) {
          return visible(rec) ? rec : undefined;
        });
      },

      /**
       * all() -> every record.
       * all(indexName) -> every record ordered by that index.
       * all(indexName, key) -> records matching key (or IDBKeyRange).
       * all(indexName, key, direction) -> 'next' | 'prev' for newest-first etc.
       */
      all: function (indexName, key, direction) {
        return collectAll(store('readonly'), indexName, key, direction)
          .then(function (rows) { return rows.filter(visible); });
      },

      /** query(indexName, key) -> records matching an index key. Readable alias. */
      query: function (indexName, key) {
        return collectAll(store('readonly'), indexName, key)
          .then(function (rows) { return rows.filter(visible); });
      },

      /**
       * update(id, patch) -> Promise<merged record>.
       * Merges patch onto the stored record; the key field is never changed.
       */
      update: function (id, patch) {
        var s = store('readwrite');
        return reqToPromise(s.get(id)).then(function (existing) {
          if (existing === undefined || !visible(existing)) {
            throw new Error(storeName + ' record not found: ' + id);
          }
          var merged = Object.assign({}, existing, patch);
          merged[def.keyPath] = existing[def.keyPath];
          warnEnum(storeName, merged);
          return reqToPromise(s.put(merged)).then(function () { return merged; });
        });
      },

      /** remove(id) -> Promise<void> */
      remove: function (id) {
        var s = store('readwrite');
        return reqToPromise(s.get(id)).then(function (existing) {
          if (existing === undefined || !visible(existing)) return;
          return reqToPromise(s.delete(id));
        }).then(function () {});
      },

      /** count(key?) -> Promise<number> */
      count: function (key) {
        if (isOwned && currentOwner) {
          return collectAll(store('readonly'))
            .then(function (rows) { return rows.filter(visible).length; });
        }
        return reqToPromise(store('readonly').count(key === undefined ? undefined : key));
      },

      /** clear() -> Promise<void>. Removes every record in the store. */
      clear: function () {
        return reqToPromise(store('readwrite').clear()).then(function () {});
      }
    };
  }

  var api = null;

  function buildApi(db) {
    var stores = {};
    Object.keys(SCHEMA).forEach(function (name) {
      stores[name] = makeStore(db, name);
    });

    /* Availability convenience: set('2026-10-20', 'booked', 'Diana session')
     * or the object form set('2026-10-20', { status: 'booked', note: '...' }) */
    var availability = stores.availability;
    availability.set = function (dateISO, statusOrObj, note) {
      var status, noteText;
      if (statusOrObj && typeof statusOrObj === 'object') {
        status = statusOrObj.status;
        noteText = statusOrObj.note || '';
      } else {
        status = statusOrObj;
        noteText = note || '';
      }
      return availability.put({ date: dateISO, status: status, note: noteText });
    };

    /* Convenience queries (thin, index-backed). These mirror the helpers the
     * sibling workstreams used in their temporary shims, so swapping a shim
     * <script> for core/db.js keeps page code working. */
    var clients = stores.clients;
    var sessions = stores.sessions;
    var payments = stores.payments;
    var galleries = stores.galleries;
    var photos = stores.photos;
    var subscribers = stores.subscribers;
    var settings = stores.settings;

    /** galleries.byClient(id) -> that client's galleries, newest first. */
    galleries.byClient = function (clientId) {
      return galleries.query('byClient', clientId).then(function (rows) {
        return rows.sort(function (a, b) {
          return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        });
      });
    };

    /** galleries.bySlug('smith-family') -> the gallery, or undefined. */
    galleries.bySlug = function (slug) {
      return galleries.query('bySlug', slug).then(function (rows) {
        return rows[0];
      });
    };

    /** photos.byGallery(id) -> photos in upload order. */
    photos.byGallery = function (galleryId) {
      return photos.query('byGallery', galleryId).then(function (rows) {
        return rows.sort(function (a, b) {
          return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
        });
      });
    };

    /** subscribers.byStatus('subscribed') -> subscribers with that status. */
    subscribers.byStatus = function (status) {
      return subscribers.query('byStatus', status);
    };

    /** settings.get('ai.provider') -> the stored value, or undefined. */
    settings.get = function (key) {
      return reqToPromise(
        settingsStore('readonly').get(key)).then(function (rec) {
        return rec === undefined ? undefined : rec.value;
      });
      function settingsStore(mode) {
        return db.transaction('settings', mode).objectStore('settings');
      }
    };

    /** settings.set('ai.provider', 'claude') -> stores the value. */
    settings.set = function (key, value) {
      return reqToPromise(
        db.transaction('settings', 'readwrite').objectStore('settings')
          .put({ key: key, value: value })).then(function () {});
    };

    /** clients.search('dia') -> clients whose name/email/phone contains it. */
    clients.search = function (query) {
      var needle = String(query || '').trim().toLowerCase();
      return clients.all().then(function (rows) {
        if (!needle) return rows;
        return rows.filter(function (c) {
          return [c.name, c.email, c.phone].some(function (v) {
            return String(v || '').toLowerCase().indexOf(needle) !== -1;
          });
        });
      });
    };

    /** clients.addNote(id, text) -> appends a timestamped note. */
    clients.addNote = function (clientId, text) {
      return clients.get(clientId).then(function (c) {
        if (c === undefined) throw new Error('clients record not found: ' + clientId);
        var entry = '[' + new Date().toISOString() + '] ' + String(text || '');
        return clients.update(clientId, { notes: c.notes ? c.notes + '\n' + entry : entry });
      });
    };

    /** sessions.byClient(id) -> that client's sessions, newest date first. */
    sessions.byClient = function (clientId) {
      return sessions.query('byClient', clientId).then(function (rows) {
        return rows.sort(byDateDesc);
      });
    };

    /** sessions.byStatus('booked') -> sessions with that status. */
    sessions.byStatus = function (status) {
      return sessions.query('byStatus', status);
    };

    /** sessions.upcoming() -> inquiry/booked sessions on/after today, soonest first. */
    sessions.upcoming = function () {
      var t = todayISODate();
      return sessions.all().then(function (rows) {
        return rows.filter(function (s) {
          return (s.status === 'inquiry' || s.status === 'booked') &&
            String(s.date || '') >= t;
        }).sort(byDateAsc);
      });
    };

    /** payments.byClient(id) -> that client's payments, newest first. */
    payments.byClient = function (clientId) {
      return payments.query('byClient', clientId).then(function (rows) {
        return rows.sort(byDateDesc);
      });
    };

    /** payments.bySession(id) -> payments for a session, newest first. */
    payments.bySession = function (sessionId) {
      return payments.query('bySession', sessionId).then(function (rows) {
        return rows.sort(byDateDesc);
      });
    };

    return Object.assign({
      dbName: DB_NAME,
      version: DB_VERSION,
      schema: SCHEMA,
      setCurrentOwner: setCurrentOwner,
      getCurrentOwner: getCurrentOwner,
      SESSION_STATUSES: SESSION_STATUSES,
      LEAD_STATUSES: LEAD_STATUSES,
      LEAD_CHANNELS: LEAD_CHANNELS,
      PAYMENT_TYPES: PAYMENT_TYPES,
      AVAILABILITY_STATUSES: AVAILABILITY_STATUSES,
      SUBSCRIBER_STATUSES: SUBSCRIBER_STATUSES,

      /** IDBKeyRange helpers for range queries, e.g. db.range('2026-10-01','2026-10-31') */
      range: function (lower, upper, opts) {
        opts = opts || {};
        if (lower !== undefined && upper !== undefined) {
          return IDBKeyRange.bound(lower, upper, !!opts.lowerOpen, !!opts.upperOpen);
        }
        if (lower !== undefined) return IDBKeyRange.lowerBound(lower, !!opts.lowerOpen);
        return IDBKeyRange.upperBound(upper, !!opts.upperOpen);
      },
      only: function (key) { return IDBKeyRange.only(key); },

      /** exportAll() -> Promise<{version, exportedAt, stores:{...}}}.
       *  Use for backups and for migrating photographers off other tools. */
      exportAll: function () {
        var out = { version: DB_VERSION, exportedAt: new Date().toISOString(), stores: {} };
        var names = Object.keys(SCHEMA);
        return names.reduce(function (p, name) {
          return p.then(function () {
            return stores[name].all().then(function (rows) { out.stores[name] = rows; });
          });
        }, Promise.resolve()).then(function () { return out; });
      },

      /** importAll(data, {clearFirst:false}) -> Promise<void>. Upserts every record. */
      importAll: function (data, opts) {
        opts = opts || {};
        var names = Object.keys(SCHEMA).filter(function (n) { return data.stores && data.stores[n]; });
        return names.reduce(function (p, name) {
          return p.then(function () {
            var chain = opts.clearFirst ? stores[name].clear() : Promise.resolve();
            return chain.then(function () {
              return data.stores[name].reduce(function (q, rec) {
                return q.then(function () { return stores[name].put(rec); });
              }, Promise.resolve());
            });
          });
        }, Promise.resolve()).then(function () {});
      },

      /** close() the underlying database connection. */
      close: function () { db.close(); }
    }, stores);
  }

  var readyPromise = openDatabase().then(function (db) {
    api = buildApi(db);
    return api;
  });

  var EasyPhoto = global.EasyPhoto || (global.EasyPhoto = {});
  EasyPhoto.db = {
    /** Promise resolving to the full store API once IndexedDB is open. */
    ready: readyPromise,
    /** Synchronous access after ready resolves (null until then). */
    api: null,
    setCurrentOwner: setCurrentOwner,
    getCurrentOwner: getCurrentOwner,
    SESSION_STATUSES: SESSION_STATUSES,
    LEAD_STATUSES: LEAD_STATUSES,
    LEAD_CHANNELS: LEAD_CHANNELS,
    PAYMENT_TYPES: PAYMENT_TYPES,
    AVAILABILITY_STATUSES: AVAILABILITY_STATUSES,
    SUBSCRIBER_STATUSES: SUBSCRIBER_STATUSES
  };
  readyPromise.then(function (a) { EasyPhoto.db.api = a; });

  /* ------------------------------------------------------------------
   * window.db — drop-in compatibility alias for the temporary shims.
   *
   * Sibling workstreams wrote shims exposing `window.db` (same store and
   * method names) while this file was being built; their page code calls
   * window.db.clients.add(...), window.db.sessions.byClient(...), etc.
   * This alias exposes the identical surface on the REAL database: every
   * method waits for the database to open, then delegates, so it is safe
   * to call at page load. Swapping a shim <script> for core/db.js keeps
   * page code working with no call-site edits.
   *
   * New code should prefer EasyPhoto.db.ready (full API: ranges,
   * export/import, enum constants) over this alias.
   * ------------------------------------------------------------------ */
  (function attachLegacyAlias() {
    var BASE_METHODS = ['add', 'put', 'get', 'all', 'query', 'update',
      'remove', 'count', 'clear'];
    var EXTRA_METHODS = {
      clients: ['search', 'addNote'],
      sessions: ['byClient', 'byStatus', 'upcoming'],
      leads: [],
      payments: ['byClient', 'bySession'],
      availability: ['set'],
      galleries: ['byClient', 'bySlug'],
      photos: ['byGallery'],
      subscribers: ['byStatus'],
      settings: ['get', 'set'],
      accounts: [],
      agentKeys: [],
      bookingForms: []
    };
    var alias = {};
    Object.keys(SCHEMA).forEach(function (storeName) {
      var methods = BASE_METHODS.concat(EXTRA_METHODS[storeName] || []);
      var storeAlias = {};
      methods.forEach(function (m) {
        storeAlias[m] = function () {
          var args = Array.prototype.slice.call(arguments);
          return readyPromise.then(function (api) {
            if (typeof api[storeName][m] !== 'function') {
              throw new Error('window.db.' + storeName + '.' + m + ' is not available');
            }
            return api[storeName][m].apply(api[storeName], args);
          });
        };
      });
      alias[storeName] = storeAlias;
    });
    alias.SESSION_STATUSES = SESSION_STATUSES;
    alias.LEAD_STATUSES = LEAD_STATUSES;
    alias.LEAD_CHANNELS = LEAD_CHANNELS;
    alias.PAYMENT_TYPES = PAYMENT_TYPES;
    alias.AVAILABILITY_STATUSES = AVAILABILITY_STATUSES;
    alias.SUBSCRIBER_STATUSES = SUBSCRIBER_STATUSES;
    alias.ready = readyPromise;
    global.db = alias;
  })();
})(typeof window !== 'undefined' ? window : this);
