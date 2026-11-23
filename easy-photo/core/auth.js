/* Easy Photo — auth (v1)
 *
 * Simple sign-in, local only. There is no server: accounts, password hashes,
 * and sessions live in this browser on this device.
 *
 *  - Photographers sign in with their BUSINESS EMAIL + password, or with
 *    Google (see GOOGLE_CLIENT_ID below). The sign-in screen looks the
 *    same for everyone: email + password, Google, and a create-account
 *    path. There is no separate owner or agent sign-in on screen.
 *  - The app owner (purephotography6@gmail.com) is recognised by her
 *    email behind the scenes only: she signs in with the same email +
 *    password as anyone else, and the app gives her the full photographer
 *    experience AND turns on the connection to her site,
 *    https://pure-photography.github.io. When she logs out, the
 *    connection turns off. Her password is checked only on this device:
 *    the first login with her email remembers a scrambled hash of the
 *    password she types; later logins check against it. The password
 *    itself is never stored or sent anywhere, and Easy Photo cannot check
 *    it against her real photography account — there is no server that
 *    could.
 *  - Agent access (kept for programmatic use; no sign-in form on screen):
 *    a photographer creates an agent key in Settings. Any AI signs in
 *    with the photographer's business email + that key, and acts only
 *    within that photographer's account. Only a scrambled hash of each
 *    key is stored.
 *  - "Remember me" (on by default): a remembered session lives in
 *    localStorage and survives closing the browser; an unremembered
 *    session lives in sessionStorage and ends when the tab closes.
 *  - Forgot password is MANUAL: the app opens the photographer's email
 *    app with a reset request addressed to the Easy Photo team inbox
 *    (purephotography6@gmail.com). A reset code is replied to them. The
 *    photographer enters that code in the app to set a new password. The
 *    app never generates or sends codes itself.
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

  /* Google sign-in (Google Identity Services, client-side only).
   * EMPTY means Google sign-in is not set up yet: the button is shown,
   * but signing in with Google reports that a client ID is needed.
   * To enable it, create a Web-application OAuth client ID in Google
   * Cloud Console (APIs & Services > Credentials) for the Easy Photo
   * origin, and paste the client ID here. Never invent or guess one. */
  var GOOGLE_CLIENT_ID = '';

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

  /* ---------- sessions: localStorage when remembered, sessionStorage when not ---------- */

  function readJSONFrom(store, key) {
    try {
      var raw = store.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function readJSON(key) {
    return readJSONFrom(global.localStorage, key) || readJSONFrom(global.sessionStorage, key);
  }

  function writeJSON(key, value) {
    try { global.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  function sessionStore() {
    /* The store the current session lives in: remembered sessions are in
     * localStorage, unremembered ones in sessionStorage. */
    try {
      if (global.sessionStorage.getItem(SESSION_KEY)) return global.sessionStorage;
    } catch (e) { /* ignore */ }
    return global.localStorage;
  }

  function setSession(session, remember) {
    if (!session) {
      try { global.localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
      try { global.sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
      setOwnerFlag(false);
      EasyPhoto.db.setCurrentOwner(null);
      return;
    }
    if (remember === false) {
      try { global.localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
      try { global.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) { /* ignore */ }
    } else {
      try { global.sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
      writeJSON(SESSION_KEY, session);
    }
    EasyPhoto.db.setCurrentOwner(session.email);
  }

  function getSession() { return readJSON(SESSION_KEY); }

  function setOwnerFlag(on) {
    try {
      if (on) {
        sessionStore().setItem(OWNER_KEY, '1');
      } else {
        global.localStorage.removeItem(OWNER_KEY);
        global.sessionStorage.removeItem(OWNER_KEY);
      }
    } catch (e) { /* ignore */ }
  }

  function currentUser() { return getSession(); }

  function isOwner() {
    var s = getSession();
    if (!s) return false;
    if (s.role === 'owner') return true;
    try { return sessionStore().getItem(OWNER_KEY) === '1'; } catch (e) { return false; }
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

  /* Steps shared by every owner sign-in path: owner session + flag, seed
   * galleries, and the proofs-first delivery default. The owner is
   * recognised by her email behind the scenes only — there is no separate
   * owner sign-in on screen. */
  function applyOwnerSession(remember) {
    setSession({ email: OWNER_EMAIL, name: 'Mary Robinson', role: 'owner' }, remember);
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
        return { email: OWNER_EMAIL, name: 'Mary Robinson', role: 'owner', seed: seed };
      });
    });
  }

  /* ---------- photographer accounts ---------- */

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function signUp(name, email, password, remember) {
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
        if (email === OWNER_EMAIL) {
          return applyOwnerSession(remember);
        }
        setSession({ email: email, name: name, role: 'photographer' }, remember);
        return { email: email, name: name, role: 'photographer' };
      });
  }

  function signIn(email, password, remember) {
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
          if (email === OWNER_EMAIL) {
            return applyOwnerSession(remember);
          }
          setSession({ email: email, name: acct.name || '', role: 'photographer' }, remember);
          return { email: email, name: acct.name || '', role: 'photographer' };
        });
      });
  }

  /* ---------- owner login (Mary) — kept for programmatic use; no form on screen ----------
   * The owner now signs in through the ordinary sign-in form: signIn()
   * recognises her email and applies the same owner session. This function
   * stays so existing callers (and the harness) keep working. */

  function ownerLogin(email, password, remember) {
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
      return applyOwnerSession(remember);
    }).then(function (result) {
      result.first = firstLogin;
      return result;
    });
  }

  /* ---------- agent sign-in — kept for programmatic use; no form on screen ---------- */

  function agentSignIn(email, key, remember) {
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
            }, remember);
            return { email: email, name: (acct && acct.name) || '', role: 'agent', agentName: rec.name };
          });
        });
      });
    });
  }

  /* ---------- Sign in with Google (Google Identity Services) ----------
   *
   * The button on the sign-in screen calls this with the ID-token
   * credential Google returns. The token is decoded client-side (there is
   * no server to verify it against) and the email inside it is trusted
   * the way a password would be: Google only issues that token for the
   * account that just signed in. First Google sign-in creates the local
   * account with a random, unusable password hash — that account can only
   * ever sign in with Google. The owner email gets the owner session.
   *
   * Requires GOOGLE_CLIENT_ID above. With it empty, this rejects with a
   * plain message saying Google sign-in is not set up yet. */

  function decodeJwtPayload(token) {
    var parts = String(token || '').split('.');
    if (parts.length !== 3) throw new Error('bad token');
    var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var binary;
    if (typeof global.atob === 'function') {
      binary = global.atob(b64);
    } else if (global.Buffer) {
      binary = global.Buffer.from(b64, 'base64').toString('binary');
    } else {
      throw new Error('no decoder');
    }
    var json = decodeURIComponent(Array.prototype.map.call(binary, function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(json);
  }

  function signInWithGoogle(credential, remember) {
    if (!GOOGLE_CLIENT_ID) {
      return Promise.reject(new Error('Google sign-in is not set up yet. The app owner needs to add a Google Cloud OAuth client ID.'));
    }
    var payload;
    try {
      payload = decodeJwtPayload(credential);
    } catch (e) {
      return Promise.reject(new Error('That Google sign-in did not return a usable account. Try again.'));
    }
    var email = normalizeEmail(payload && payload.email);
    if (!email || email.indexOf('@') === -1) {
      return Promise.reject(new Error('Google did not share an email address for that account. Try signing in with your email and password instead.'));
    }
    var name = String((payload && payload.name) || '').trim();
    return EasyPhoto.db.ready.then(function (db) { return db.accounts.get(email); })
      .then(function (acct) {
        if (acct) return acct;
        var random = 'google:' + (payload.sub || '') + ':' + Date.now() + ':' + Math.random();
        return hashText(random).then(function (hash) {
          return EasyPhoto.db.ready.then(function (db) {
            return db.accounts.add({ email: email, name: name, passwordHash: hash });
          });
        });
      })
      .then(function () {
        if (email === OWNER_EMAIL) {
          return applyOwnerSession(remember);
        }
        setSession({ email: email, name: name, role: 'photographer' }, remember);
        return { email: email, name: name, role: 'photographer' };
      });
  }

  /* ---------- forgot password (manual, through the Easy Photo team) ---------- */

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
        var body = 'Hello Easy Photo team,\n\n' +
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
    GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID,
    hashText: hashText,
    makeAgentKey: makeAgentKey,
    signUp: signUp,
    signIn: signIn,
    signInWithGoogle: signInWithGoogle,
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
