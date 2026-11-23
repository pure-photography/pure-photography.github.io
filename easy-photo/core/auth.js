/* Easy Photo — auth (v1)
 *
 * Simple sign-in, local only. There is no server: accounts, password hashes,
 * and sessions live in this browser on this device.
 *
 *  - Photographers sign in with their BUSINESS EMAIL + password. Nothing
 *    else — no Google, Apple, or social sign-in.
 *  - Owner login (Mary only, purephotography6@gmail.com) signs Mary in as a
 *    photographer AND turns on the connection to her site,
 *    https://pure-photography.github.io. Her owner login is the full app,
 *    not a limited flow. When she logs out, the connection turns off.
 *    The owner password is checked only on this device: the first owner
 *    login remembers a scrambled hash of the password she types; later
 *    logins check against it. The password itself is never stored or sent
 *    anywhere, and Easy Photo cannot check it against her real photography
 *    account — there is no server that could. Mary, or Hannah acting for
 *    her, can sign in here.
 *  - Agent access: a photographer creates an agent key in Settings. Any AI
 *    (Muse, Grok, ChatGPT, or another) signs in with the photographer's
 *    business email + that key, and acts only within that photographer's
 *    account. Only a scrambled hash of each key is stored.
 *  - Forgot password is MANUAL, through Mary: the app opens the
 *    photographer's email app with a reset request addressed to Mary's
 *    inbox (purephotography6@gmail.com). Hannah replies with a reset code.
 *    The photographer enters that code in the app to set a new password.
 *    The app never generates or sends codes itself.
 *
 * Data scoping: after sign-in, EasyPhoto.db.currentOwner is the signed-in
 * email, and the data layer stamps it onto new records and hides other
 * owners' records. An agent session is scoped to its account the same way.
 */
(function (global) {
  'use strict';

  var OWNER_EMAIL = 'purephotography6@gmail.com';
  var OWNER_SITE_URL = 'https://pure-photography.github.io';
  var SITE_FORM_URL = OWNER_SITE_URL + '/booking.html';
  var SESSION_KEY = 'easy-photo:session';
  var OWNER_KEY = 'easy-photo:owner';

  /* ---------- hashing ---------- */

  function hex(buffer) {
    var bytes = new Uint8Array(buffer);
    var out = '';
    for (var i = 0; i < bytes.length; i++) {
      out += ('0' + bytes[i].toString(16)).slice(-2);
    }
    return out;
  }

  /* Fallback hash for non-secure contexts (crypto.subtle needs https).
   * The app is served over https, so this is only a safety net. */
  function fallbackHash(text) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return Promise.resolve('fnv:' + (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16));
  }

  function hashText(text) {
    try {
      var cryptoObj = global.crypto || (global.window && global.window.crypto);
      if (cryptoObj && cryptoObj.subtle && cryptoObj.subtle.digest) {
        var data = new TextEncoder().encode(text);
        return cryptoObj.subtle.digest('SHA-256', data).then(function (buf) {
          return 'sha256:' + hex(buf);
        });
      }
    } catch (e) { /* fall through */ }
    return fallbackHash(text);
  }

  function makeAgentKey() {
    var chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    var out = 'epk_';
    try {
      var cryptoObj = global.crypto || (global.window && global.window.crypto);
      var bytes = new Uint8Array(24);
      cryptoObj.getRandomValues(bytes);
      for (var i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
      return out;
    } catch (e) {
      for (var j = 0; j < 32; j++) {
        out += chars[Math.floor(Math.random() * chars.length)];
      }
      return out;
    }
  }

  function makeResetCode() {
    try {
      var cryptoObj = global.crypto || (global.window && global.window.crypto);
      var bytes = new Uint32Array(1);
      cryptoObj.getRandomValues(bytes);
      return String(100000 + (bytes[0] % 900000));
    } catch (e) {
      return String(100000 + Math.floor(Math.random() * 900000));
    }
  }

  /* ---------- sessions (localStorage) ---------- */

  function readJSON(key) {
    try {
      var raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeJSON(key, value) {
    try { global.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  function setSession(session) {
    if (!session) {
      try { global.localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
      EasyPhoto.db.setCurrentOwner(null);
      return;
    }
    writeJSON(SESSION_KEY, session);
    EasyPhoto.db.setCurrentOwner(session.email);
  }

  function getSession() { return readJSON(SESSION_KEY); }

  function setOwnerFlag(on) {
    try {
      if (on) global.localStorage.setItem(OWNER_KEY, '1');
      else global.localStorage.removeItem(OWNER_KEY);
    } catch (e) { /* ignore */ }
  }

  function currentUser() { return getSession(); }

  function isOwner() {
    var s = getSession();
    if (s && s.role === 'owner') return true;
    try { return global.localStorage.getItem(OWNER_KEY) === '1'; } catch (e) { return false; }
  }

  function isAgent() {
    var s = getSession();
    return !!(s && s.role === 'agent');
  }

  function signOut() {
    setSession(null);
    setOwnerFlag(false);
  }

  function ownerLogout() {
    var s = getSession();
    setOwnerFlag(false);
    if (s && s.role === 'owner') setSession(null);
    else if (s) EasyPhoto.db.setCurrentOwner(s.email);
  }

  /* ---------- photographer accounts ---------- */

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function signUp(name, email, password) {
    email = normalizeEmail(email);
    name = String(name || '').trim();
    if (!name) return Promise.reject(new Error('Please enter your business name.'));
    if (!email || email.indexOf('@') === -1) {
      return Promise.reject(new Error('Please enter a valid business email.'));
    }
    if (!password || password.length < 6) {
      return Promise.reject(new Error('Choose a password of at least 6 characters.'));
    }
    return EasyPhoto.db.ready.then(function (db) { return db.accounts.get(email); })
      .then(function (existing) {
        if (existing) throw new Error('An account with that email already exists — sign in instead.');
        return hashText(email + ':' + password);
      })
      .then(function (hash) {
        return EasyPhoto.db.ready.then(function (db) {
          return db.accounts.add({ email: email, name: name, passwordHash: hash });
        });
      })
      .then(function () {
        setSession({ email: email, name: name, role: 'photographer' });
        return { email: email, name: name, role: 'photographer' };
      });
  }

  function signIn(email, password) {
    email = normalizeEmail(email);
    if (!email || !password) {
      return Promise.reject(new Error('Enter your business email and password.'));
    }
    return EasyPhoto.db.ready.then(function (db) { return db.accounts.get(email); })
      .then(function (acct) {
        if (!acct) throw new Error('No account with that email. Create an account first, or check the email address.');
        return hashText(email + ':' + password).then(function (hash) {
          if (hash !== acct.passwordHash) {
            throw new Error('That password is not right. Try again, or use “Forgot password?”.');
          }
          setSession({ email: email, name: acct.name || '', role: 'photographer' });
          return { email: email, name: acct.name || '', role: 'photographer' };
        });
      });
  }

  /* ---------- owner login (Mary) ---------- */

  function ownerLogin(email, password) {
    email = normalizeEmail(email);
    if (email !== OWNER_EMAIL) {
      return Promise.reject(new Error('Owner login is for Mary only. Sign in with purephotography6@gmail.com.'));
    }
    if (!password) {
      return Promise.reject(new Error('Please enter your password.'));
    }
    var firstLogin = false;
    return hashText(email + ':' + password).then(function (hash) {
      return EasyPhoto.db.ready.then(function (db) { return db.settings.get('owner.hash'); })
        .then(function (stored) {
          if (!stored) {
            firstLogin = true;
            return EasyPhoto.db.ready.then(function (db) {
              return db.settings.set('owner.hash', hash);
            });
          }
          if (stored !== hash) {
            throw new Error('That password does not match the owner password set on this device.');
          }
          return null;
        })
        .then(function () { return hash; });
    }).then(function (hash) {
      return EasyPhoto.db.ready.then(function (db) { return db.accounts.get(OWNER_EMAIL); })
        .then(function (acct) {
          if (acct) return acct;
          return EasyPhoto.db.ready.then(function (db) {
            return db.accounts.add({
              email: OWNER_EMAIL, name: 'Mary Robinson', passwordHash: hash
            });
          });
        });
    }).then(function () {
      setSession({ email: OWNER_EMAIL, name: 'Mary Robinson', role: 'owner' });
      setOwnerFlag(true);
      return importMaryGalleries().then(function (seed) {
        // Mary's business default: proofs first (6 proofs), then the full
        // gallery — always. Other photographers choose their own way.
        return EasyPhoto.db.ready.then(function (db) {
          return db.settings.get('gallery.deliveryMode');
        }).then(function (mode) {
          if (!mode) {
            return EasyPhoto.db.ready.then(function (db) {
              return db.settings.set('gallery.deliveryMode', 'proofs-first');
            });
          }
          return null;
        }).then(function () {
          return { email: OWNER_EMAIL, name: 'Mary Robinson', role: 'owner', first: firstLogin, seed: seed };
        });
      });
    });
  }

  /* ---------- agent sign-in ---------- */

  function agentSignIn(email, key) {
    email = normalizeEmail(email);
    if (!email || !key) {
      return Promise.reject(new Error('Enter your business email and your agent key.'));
    }
    return hashText(String(key).trim()).then(function (hash) {
      return EasyPhoto.db.ready.then(function (db) {
        return db.agentKeys.query('byKeyHash', hash);
      }).then(function (found) {
        var rec = found && found[0];
        if (!rec || rec.revoked || String(rec.owner).toLowerCase() !== email) {
          throw new Error('That agent key does not match this email, or it was revoked. Check the key, or ask the photographer to create a new one.');
        }
        return EasyPhoto.db.ready.then(function (db) {
          return db.agentKeys.update(rec.id, { lastUsedAt: new Date().toISOString() });
        }).then(function () {
          return EasyPhoto.db.ready.then(function (db) {
            return db.accounts.get(email);
          }).then(function (acct) {
            setSession({
              email: email, name: (acct && acct.name) || '',
              role: 'agent', agentName: rec.name
            });
            return { email: email, name: (acct && acct.name) || '', role: 'agent', agentName: rec.name };
          });
        });
      });
    });
  }

  /* ---------- forgot password (manual, through Mary) ---------- */

  function requestReset(email) {
    email = normalizeEmail(email);
    if (!email || email.indexOf('@') === -1) {
      return Promise.reject(new Error('Enter the business email for your account.'));
    }
    return EasyPhoto.db.ready.then(function (db) { return db.accounts.get(email); })
      .then(function (acct) {
        if (!acct) {
          throw new Error('No Easy Photo account with that email. Check the email address, or create an account.');
        }
        var code = makeResetCode();
        var pending = { email: email, code: code, createdAt: new Date().toISOString() };
        return EasyPhoto.db.ready.then(function (db) {
          return db.settings.set('reset.pending', pending);
        }).then(function () { return pending; });
      })
      .then(function (pending) {
        var subject = 'Easy Photo password reset request';
        var body = 'Hello Mary,\n\n' +
          'I forgot my Easy Photo password. Please send me a reset code.\n\n' +
          'My business email: ' + pending.email + '\n' +
          'Request code: ' + pending.code + '\n' +
          'Sent: ' + pending.createdAt + '\n\n' +
          'Thank you!';
        var href = 'mailto:' + OWNER_EMAIL +
          '?subject=' + encodeURIComponent(subject) +
          '&body=' + encodeURIComponent(body);
        global.location.href = href;
        return pending;
      });
  }

  function resetWithCode(email, code, newPassword) {
    email = normalizeEmail(email);
    code = String(code || '').trim();
    if (!email || !code) {
      return Promise.reject(new Error('Enter your business email and the code Hannah sent you.'));
    }
    if (!newPassword || newPassword.length < 6) {
      return Promise.reject(new Error('Choose a new password of at least 6 characters.'));
    }
    return EasyPhoto.db.ready.then(function (db) { return db.settings.get('reset.pending'); })
      .then(function (pending) {
        if (!pending || pending.email !== email) {
          throw new Error('No reset request for that email. Send a reset request first.');
        }
        var ageMs = Date.now() - new Date(pending.createdAt).getTime();
        if (ageMs > 24 * 60 * 60 * 1000) {
          throw new Error('That reset request is more than a day old. Send a fresh request.');
        }
        if (String(pending.code) !== code) {
          throw new Error('That code does not match the one in your reset request. Check the code Hannah sent you and try again.');
        }
        return hashText(email + ':' + newPassword).then(function (hash) {
          return EasyPhoto.db.ready.then(function (db) {
            return db.accounts.update(email, { passwordHash: hash });
          }).then(function () {
            return EasyPhoto.db.ready.then(function (db) {
              return db.settings.set('reset.pending', null);
            });
          }).then(function () {
            return EasyPhoto.db.ready.then(function (db) {
              return db.accounts.get(email);
            });
          }).then(function (acct) {
            setSession({ email: email, name: (acct && acct.name) || '', role: 'photographer' });
            return { email: email };
          });
        });
      });
  }

  /* ---------- Mary's past-shoot galleries (owner seed) ---------- */

  function importMaryGalleries() {
    var seed = global.EASY_PHOTO_MARY_GALLERIES;
    if (!seed || !seed.galleries || !seed.galleries.length) {
      return Promise.resolve({ imported: false, reason: 'no seed data' });
    }
    return EasyPhoto.db.ready.then(function (db) {
      return db.settings.get('mary.seedImported');
    }).then(function (done) {
      if (done) return { imported: false, reason: 'already imported' };
      var made = 0, photos = 0;
      var chain = Promise.resolve();
      seed.galleries.forEach(function (g) {
        chain = chain.then(function () {
          return EasyPhoto.db.ready.then(function (db) {
            return db.galleries.add({
              clientId: null, clientName: g.clientName || '',
              title: g.title, slug: g.slug, isPrivate: true,
              watermark: 'Pure Photography', passwordHash: null
            });
          }).then(function (gid) {
            made += 1;
            var pchain = Promise.resolve();
            g.photos.forEach(function (p) {
              pchain = pchain.then(function () {
                return EasyPhoto.db.ready.then(function (db) {
                  return db.photos.add({
                    galleryId: gid, fileName: p.file, alt: p.alt,
                    sourceUrl: seed.siteUrl + '/img/' + p.file,
                    blob: null, type: 'image/jpeg', size: 0
                  });
                }).then(function () { photos += 1; });
              });
            });
            return pchain;
          });
        });
      });
      return chain.then(function () {
        return EasyPhoto.db.ready.then(function (db) {
          return db.settings.set('mary.seedImported', true);
        }).then(function () {
          return { imported: true, galleries: made, photos: photos };
        });
      });
    });
  }

  /* ---------- page gate + user bar ---------- */

  function pageIsPublic() {
    var path = global.location.pathname || '';
    var base = path.split('/').pop();
    var query = new URLSearchParams(global.location.search);
    if (!base || base === 'index.html') return true;
    if (base === 'booking.html' && query.get('form')) return true;
    if (base === 'galleries.html' && query.get('g')) return true;
    return false;
  }

  function requireAuth() {
    if (!getSession()) {
      var path = global.location.pathname || '';
      var base = path.split('/').pop();
      if (!base || base === 'index.html') return false;
      var query = new URLSearchParams(global.location.search);
      if (base === 'booking.html' && query.get('form')) return true;
      if (base === 'galleries.html' && query.get('g')) return true;
      global.location.href = '../index.html';
      return false;
    }
    return true;
  }

  function injectUserBar() {
    var header = global.document && global.document.querySelector('header');
    if (!header || global.document.getElementById('ep-userbar')) return;
    var session = getSession();
    var bar = global.document.createElement('div');
    bar.id = 'ep-userbar';
    bar.className = 'ep-userbar';
    var owner = isOwner();
    var who = session ?
      ('Signed in as ' + session.email +
        (session.role === 'agent' ? ' (agent “' + (session.agentName || '') + '” acting for you)' : '') +
        (session.role === 'owner' ? ' (owner)' : '')) :
      'Not signed in';
    bar.innerHTML =
      '<span>' + who + '</span> ' +
      (owner ? '<span class="ep-status" data-tone="success">✓ Connected to <a href="' + OWNER_SITE_URL + '">Pure Photography</a></span> ' : '') +
      (session ? '<button type="button" id="ep-signout-btn" class="btn">Sign out</button>' : '');
    header.appendChild(bar);
    var btn = global.document.getElementById('ep-signout-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        signOut();
        global.location.href = header.baseURI && header.baseURI.indexOf('/index.html') !== -1
          ? 'index.html' : '../index.html';
        if (global.location.pathname.split('/').pop() === 'index.html') {
          global.location.reload();
        }
      });
    }
    var ownerBadge = bar.querySelector('.ep-status a');
    if (ownerBadge) ownerBadge.setAttribute('target', '_blank');
  }

  function initAuth() {
    var session = getSession();
    if (session) EasyPhoto.db.setCurrentOwner(session.email);
    if (session && session.role === 'owner' && !isOwner()) setOwnerFlag(true);
    if (global.document) {
      injectUserBar();
      if (!pageIsPublic()) requireAuth();
    }
    // If Mary is signed in as owner, make sure her past-shoot galleries exist.
    if (session && session.role === 'owner') {
      importMaryGalleries().catch(function () { /* seed is best-effort */ });
    }
  }

  var EasyPhoto = global.EasyPhoto || (global.EasyPhoto = {});
  EasyPhoto.auth = {
    OWNER_EMAIL: OWNER_EMAIL,
    OWNER_SITE_URL: OWNER_SITE_URL,
    SITE_FORM_URL: SITE_FORM_URL,
    hashText: hashText,
    makeAgentKey: makeAgentKey,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    ownerLogin: ownerLogin,
    ownerLogout: ownerLogout,
    agentSignIn: agentSignIn,
    requestReset: requestReset,
    resetWithCode: resetWithCode,
    importMaryGalleries: importMaryGalleries,
    currentUser: currentUser,
    isOwner: isOwner,
    isAgent: isAgent,
    requireAuth: requireAuth,
    initAuth: initAuth
  };

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', initAuth);
    } else {
      initAuth();
    }
  }
})(typeof window !== 'undefined' ? window : this);
