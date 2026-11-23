/* Easy Photo — Galleries (v1)
 *
 * Client galleries, Pixieset-style, with no server behind them.
 * Photos live in IndexedDB on THIS device. Sharing works three ways:
 *   1. A link that opens the gallery on this device (showing a client
 *      on your own screen), and
 *   2. True AI sends the gallery by branded email or by text — True AI
 *      composes the message; it goes out through the photographer's own
 *      email app or phone texting app (see core/trueai.js), and
 *   3. "Download gallery as one file" — a self-contained HTML file you
 *      send to your client by text or email; they open it in any browser.
 *
 * Delivery is two stages when the photographer chose proofs-first:
 * proofs (exactly six photos), then the full gallery — always, no matter
 * what the client says about the proofs. Photographers who chose
 * full-gallery delivery send the full gallery straight away.
 * Mary's owner account defaults to proofs-first; other photographers
 * pick their own way in Settings or the first time they send a gallery.
 *
 * Proofing: a client who opens a proofs link picks favorites and leaves
 * notes on photos, then sends them to the photographer by email.
 * Watermark: every photo in a gallery shows the photographer's watermark
 * text ("Pure Photography" on Mary's galleries; other photographers use
 * their own brand). Password protection: a photographer can set a gallery
 * password; the client just types that password — no account, no sign-in.
 *
 * Download flow: Downloads folder or an external hard drive. A website
 * cannot detect a plugged-in drive or write to it silently, so the
 * photographer picks the folder after inserting the drive.
 */
(function () {
  'use strict';

  var listView = document.getElementById('view-list');
  var detailView = document.getElementById('view-gallery');
  var clientView = document.getElementById('view-client');
  var galleryList = document.getElementById('gallery-list');
  var galleryCount = document.getElementById('gallery-count');
  var galleryEmpty = document.getElementById('gallery-list-empty');
  var galleryForm = document.getElementById('gallery-form');
  var titleInput = document.getElementById('gf-title');
  var titleError = document.getElementById('gf-title-error');
  var clientSelect = document.getElementById('gf-client');
  var privateInput = document.getElementById('gf-private');

  var galleryTitle = document.getElementById('gallery-title');
  var galleryMeta = document.getElementById('gallery-meta');
  var galleryPrivacy = document.getElementById('gallery-privacy');
  var shareLinkInput = document.getElementById('share-link');
  var textClientBtn = document.getElementById('text-client-btn');
  var photoList = document.getElementById('photo-list');
  var photoCount = document.getElementById('photo-count');
  var photoEmpty = document.getElementById('photo-list-empty');
  var uploadForm = document.getElementById('upload-form');
  var fileInput = document.getElementById('uf-files');
  var fileError = document.getElementById('uf-files-error');
  var altFields = document.getElementById('alt-fields');
  var downloadForm = document.getElementById('download-form');
  var driveStep = document.getElementById('drive-step');
  var downloadStatus = document.getElementById('download-status');
  var fallbackNote = document.getElementById('download-fallback-note');

  var currentGallery = null;
  var pendingFiles = [];
  var thumbCache = {};
  var businessName = '';
  var connectedEmail = '';
  var deliveryMode = null; // 'proofs-first' | 'full' | null (not chosen yet)

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function announce(msg, priority) {
    EasyPhoto.a11y.announce(msg, priority);
  }

  function slugify(title) {
    return String(title || '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'gallery';
  }

  function safeFileName(name) {
    return String(name || 'photo').replace(/[\\/:*?"<>|]/g, '_');
  }

  function showView(which) {
    listView.hidden = which !== 'list';
    detailView.hidden = which !== 'detail';
    clientView.hidden = which !== 'client';
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error || new Error('Could not read photo.')); };
      reader.readAsDataURL(blob);
    });
  }

  /* A photo's bytes: the stored Blob, or the live site URL for seed photos
   * (Mary's past shoots load from her site — they were never uploaded here). */
  function photoBlob(photo) {
    if (photo.blob) return Promise.resolve(photo.blob);
    if (photo.sourceUrl) {
      return fetch(photo.sourceUrl).then(function (res) {
        if (!res.ok) throw new Error('Could not load ' + photo.fileName + ' from the site.');
        return res.blob();
      });
    }
    return Promise.reject(new Error('No photo file for ' + photo.fileName + '.'));
  }

  function thumbFor(photo) {
    if (thumbCache[photo.id]) return Promise.resolve(thumbCache[photo.id]);
    if (photo.blob) {
      return blobToDataUrl(photo.blob).then(function (url) {
        thumbCache[photo.id] = url;
        return url;
      });
    }
    if (photo.sourceUrl) return Promise.resolve(photo.sourceUrl);
    return Promise.resolve('');
  }

  function galleryLink(slug, stage) {
    var url = window.location.origin + window.location.pathname +
      '?g=' + encodeURIComponent(slug);
    if (stage === 'proofs') url += '&proofs=1';
    return url;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US',
      { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* ---------------- list view ---------------- */

  function loadClientsIntoSelect() {
    return window.db.clients.all().then(function (clients) {
      clients.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = String(c.id);
        opt.textContent = c.name + (c.email ? ' — ' + c.email : '');
        clientSelect.appendChild(opt);
      });
    });
  }

  function renderList() {
    return window.db.galleries.all().then(function (galleries) {
      galleries.sort(function (a, b) {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
      galleryCount.textContent = galleries.length ? '(' + galleries.length + ')' : '';
      galleryEmpty.hidden = galleries.length !== 0;
      galleryList.innerHTML = '';
      galleries.forEach(function (g) {
        var li = document.createElement('li');
        var clientName = g.clientName ? ' — ' + esc(g.clientName) : '';
        var link = galleryLink(g.slug, 'full');
        li.innerHTML =
          '<strong>' + esc(g.title) + '</strong>' + clientName +
          ' <span class="ep-status" data-tone="' + (g.isPrivate ? 'success' : 'warning') + '">' +
          (g.isPrivate ? '✓ Private — link only' : 'Open link') + '</span>' +
          ' <span data-photo-count="' + g.id + '"></span><br>' +
          '<button type="button" class="btn" data-open="' + g.id + '">Open gallery</button> ' +
          '<button type="button" class="btn" data-get-link="' + g.id + '">Get link</button> ' +
          '<button type="button" class="btn" data-text-send="' + g.id + '">Send by text</button> ' +
          '<button type="button" class="btn btn-danger" data-delete="' + g.id + '">Delete gallery</button>';
        galleryList.appendChild(li);
        window.db.photos.byGallery(g.id).then(function (photos) {
          var slot = li.querySelector('[data-photo-count="' + g.id + '"]');
          if (slot) slot.textContent = photos.length + (photos.length === 1 ? ' photo' : ' photos');
        });
      });
    });
  }

  galleryList.addEventListener('click', function (e) {
    var openBtn = e.target.closest('[data-open]');
    var linkBtn = e.target.closest('[data-get-link]');
    var textBtn = e.target.closest('[data-text-send]');
    var delBtn = e.target.closest('[data-delete]');
    if (openBtn) { openGallery(Number(openBtn.getAttribute('data-open'))); return; }
    if (textBtn) {
      var tgid = Number(textBtn.getAttribute('data-text-send'));
      window.db.galleries.get(tgid).then(function (g) {
        if (!g) return;
        // True AI text: proofs first when that is the photographer's way.
        var stage = deliveryMode === 'proofs-first' ? 'proofs' : 'full';
        var href = EasyPhoto.trueAI.textHref({
          gallery: g, client: {}, stage: stage,
          businessName: businessName || 'Your photographer',
          baseUrl: window.location.origin + window.location.pathname.replace(/[^/]+$/, '')
        });
        announce('True AI opened your phone\u2019s texting app with the gallery message. Choose your client and press send.');
        window.location.href = href;
      });
      return;
    }
    if (linkBtn) {
      var gid = Number(linkBtn.getAttribute('data-get-link'));
      window.db.galleries.get(gid).then(function (g) {
        if (!g) return;
        var link = galleryLink(g.slug, 'full');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(link).then(function () {
            announce('Gallery link copied: ' + link);
          }, function () { announce('Gallery link: ' + link, 'assertive'); });
        } else {
          announce('Gallery link: ' + link, 'assertive');
        }
      });
      return;
    }
    if (delBtn) {
      var id = Number(delBtn.getAttribute('data-delete'));
      if (!window.confirm('Delete this gallery and all its photos? This cannot be undone.')) return;
      window.db.photos.byGallery(id).then(function (photos) {
        return Promise.all(photos.map(function (p) { return window.db.photos.remove(p.id); }));
      }).then(function () { return window.db.galleries.remove(id); })
        .then(function () { announce('Gallery deleted.'); return renderList(); });
    }
  });

  galleryForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var title = titleInput.value.trim();
    if (!title) {
      titleError.textContent = 'Please enter a gallery title.';
      titleError.hidden = false;
      titleInput.setAttribute('aria-invalid', 'true');
      titleInput.focus();
      return;
    }
    titleError.hidden = true;
    titleInput.removeAttribute('aria-invalid');
    var clientId = clientSelect.value ? Number(clientSelect.value) : null;
    var clientName = '';
    var baseSlug = slugify(title);
    var slug = baseSlug;
    var attempt = 0;
    function uniqueSlug() {
      return window.db.galleries.bySlug(slug).then(function (existing) {
        if (!existing) return slug;
        attempt += 1;
        slug = baseSlug + '-' + attempt;
        return uniqueSlug();
      });
    }
    Promise.resolve()
      .then(function () {
        if (!clientId) return null;
        return window.db.clients.get(clientId);
      })
      .then(function (client) { clientName = client ? client.name : ''; })
      .then(uniqueSlug)
      .then(function (finalSlug) {
        /* Watermark default: "Pure Photography" on Mary's galleries,
         * the photographer's own business name otherwise. */
        var watermark = EasyPhoto.auth.isOwner() ? 'Pure Photography' : (businessName || '');
        return window.db.galleries.add({
          clientId: clientId, clientName: clientName, title: title,
          slug: finalSlug, isPrivate: privateInput.checked,
          watermark: watermark, passwordHash: null
        });
      })
      .then(function (id) {
        galleryForm.reset();
        announce('Gallery "' + title + '" created.');
        return renderList().then(function () { openGallery(id); });
      })
      .catch(function (err) {
        announce('Could not create gallery: ' + err.message, 'assertive');
      });
  });

  /* ---------------- gallery detail ---------------- */

  function openGallery(id) {
    window.db.galleries.get(id).then(function (g) {
      if (!g) { announce('Gallery not found.', 'assertive'); return; }
      currentGallery = g;
      galleryTitle.textContent = g.title;
      galleryMeta.textContent = (g.clientName ? 'Client: ' + g.clientName + '. ' : '') +
        'Created ' + fmtDate(g.createdAt) + '.';
      galleryPrivacy.textContent = g.isPrivate ? '✓ Private — link only' : 'Open link';
      galleryPrivacy.setAttribute('data-tone', g.isPrivate ? 'success' : 'warning');
      shareLinkInput.value = galleryLink(g.slug, 'full');
      textClientBtn.href = '#trueai-heading';
      textClientBtn.textContent = 'Send with True AI';
      document.getElementById('wm-text').value = g.watermark || '';
      document.getElementById('gp-status').textContent = g.passwordHash
        ? 'Password protection is ON. Your client types the password to open the gallery.'
        : 'No password set — anyone with the link can open this gallery.';
      document.getElementById('gp-password').value = '';
      showView('detail');
      galleryTitle.focus();
      renderPhotos();
      setupTrueAI();
    });
  }

  document.getElementById('back-to-list').addEventListener('click', function () {
    currentGallery = null;
    showView('list');
    renderList();
    document.getElementById('list-heading').focus();
  });

  document.getElementById('copy-link-btn').addEventListener('click', function () {
    var link = shareLinkInput.value;
    function done() { announce('Gallery link copied.'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(done, function () { fallbackCopy(); });
    } else { fallbackCopy(); }
    function fallbackCopy() {
      shareLinkInput.select();
      try { document.execCommand('copy'); done(); }
      catch (err) { announce('Copy did not work — the link is in the text box above.', 'assertive'); }
    }
  });

  function photoItem(photo, removable) {
    var li = document.createElement('li');
    var img = document.createElement('img');
    img.alt = photo.alt || '';
    img.width = 400;
    img.height = 300;
    var meta = document.createElement('div');
    meta.className = 'photo-meta';
    meta.innerHTML = '<p><strong>' + esc(photo.fileName) + '</strong></p>' +
      '<p class="photo-alt">Alt text: ' + esc(photo.alt || 'No alt text') + '</p>' +
      (removable ? '<p><button type="button" class="btn btn-danger" data-remove-photo="' + photo.id + '">Delete photo</button></p>' : '');
    li.appendChild(img);
    li.appendChild(meta);
    thumbFor(photo).then(function (url) { if (url) img.src = url; });
    return li;
  }

  function renderPhotos() {
    if (!currentGallery) return;
    window.db.photos.byGallery(currentGallery.id).then(function (photos) {
      photoCount.textContent = photos.length ? '(' + photos.length + ')' : '';
      photoEmpty.hidden = photos.length !== 0;
      photoList.innerHTML = '';
      photos.forEach(function (p) { photoList.appendChild(photoItem(p, true)); });
    });
  }

  photoList.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-remove-photo]');
    if (!btn) return;
    var id = Number(btn.getAttribute('data-remove-photo'));
    if (!window.confirm('Delete this photo from the gallery?')) return;
    delete thumbCache[id];
    window.db.photos.remove(id).then(function () {
      announce('Photo deleted.');
      renderPhotos();
    });
  });

  /* Upload: alt text is required for every photo before saving. */
  fileInput.addEventListener('change', function () {
    pendingFiles = Array.prototype.slice.call(fileInput.files || []);
    altFields.innerHTML = '';
    fileError.hidden = true;
    pendingFiles.forEach(function (file, i) {
      var div = document.createElement('div');
      div.className = 'field';
      var label = document.createElement('label');
      label.setAttribute('for', 'alt-' + i);
      label.innerHTML = 'Alt text for ' + esc(file.name) + ' <span class="required" aria-hidden="true">*</span>';
      var input = document.createElement('input');
      input.type = 'text';
      input.id = 'alt-' + i;
      input.required = true;
      input.setAttribute('data-alt-index', String(i));
      input.setAttribute('aria-describedby', 'alt-hint-' + i);
      var hint = document.createElement('p');
      hint.className = 'hint';
      hint.id = 'alt-hint-' + i;
      hint.textContent = 'Describe what the photo shows, for example: couple laughing under oak trees at golden hour.';
      var err = document.createElement('p');
      err.className = 'error';
      err.id = 'alt-error-' + i;
      err.setAttribute('role', 'alert');
      err.hidden = true;
      div.appendChild(label);
      div.appendChild(input);
      div.appendChild(hint);
      div.appendChild(err);
      altFields.appendChild(div);
    });
  });

  uploadForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!currentGallery) return;
    if (!pendingFiles.length) {
      fileError.textContent = 'Choose at least one photo first.';
      fileError.hidden = false;
      fileInput.focus();
      return;
    }
    fileError.hidden = true;
    var alts = [];
    var firstBad = null;
    for (var i = 0; i < pendingFiles.length; i++) {
      var input = document.getElementById('alt-' + i);
      var err = document.getElementById('alt-error-' + i);
      var value = input ? input.value.trim() : '';
      if (!value) {
        err.textContent = 'Alt text is required — describe what this photo shows.';
        err.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        if (!firstBad) firstBad = input;
      } else {
        err.hidden = true;
        if (input) input.removeAttribute('aria-invalid');
        alts.push(value);
      }
    }
    if (firstBad) {
      firstBad.focus();
      announce('Alt text is missing for one or more photos.', 'assertive');
      return;
    }
    var saves = pendingFiles.map(function (file, i) {
      return window.db.photos.add({
        galleryId: currentGallery.id,
        fileName: file.name,
        alt: alts[i],
        blob: file,
        type: file.type,
        size: file.size
      });
    });
    Promise.all(saves).then(function () {
      var n = pendingFiles.length;
      pendingFiles = [];
      uploadForm.reset();
      altFields.innerHTML = '';
      announce(n + (n === 1 ? ' photo' : ' photos') + ' saved to the gallery.');
      renderPhotos();
    }).catch(function (err) {
      announce('Could not save photos: ' + err.message, 'assertive');
    });
  });

  /* ---------------- watermark + password ---------------- */

  document.getElementById('watermark-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!currentGallery) return;
    var text = document.getElementById('wm-text').value.trim();
    window.db.galleries.update(currentGallery.id, { watermark: text || null })
      .then(function (g) {
        currentGallery = g;
        announce(text ? 'Watermark saved: “' + text + '”.' : 'Watermark removed.');
      });
  });

  document.getElementById('password-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!currentGallery) return;
    var pw = document.getElementById('gp-password').value;
    if (!pw) {
      announce('Type a password first, or choose “Remove password”.', 'assertive');
      document.getElementById('gp-password').focus();
      return;
    }
    EasyPhoto.auth.hashText(pw).then(function (hash) {
      return window.db.galleries.update(currentGallery.id, { passwordHash: hash });
    }).then(function (g) {
      currentGallery = g;
      document.getElementById('gp-password').value = '';
      document.getElementById('gp-status').textContent =
        'Password protection is ON. Your client types the password to open the gallery — no account, no sign-in.';
      announce('Gallery password set.');
    });
  });

  document.getElementById('gp-remove-btn').addEventListener('click', function () {
    if (!currentGallery) return;
    window.db.galleries.update(currentGallery.id, { passwordHash: null })
      .then(function (g) {
        currentGallery = g;
        document.getElementById('gp-status').textContent =
          'No password set — anyone with the link can open this gallery.';
        announce('Gallery password removed.');
      });
  });

  /* ---------------- True AI send panel ---------------- */

  var taForm = document.getElementById('trueai-form');
  var taClientSelect = document.getElementById('ta-client');
  var taName = document.getElementById('ta-name');
  var taEmail = document.getElementById('ta-email');
  var taPhone = document.getElementById('ta-phone');
  var taPreview = document.getElementById('ta-preview');
  var taStatus = document.getElementById('ta-status');
  var taDeliveryStatus = document.getElementById('ta-delivery-status');
  var deliveryChoice = document.getElementById('delivery-choice');
  var deliveryModeNote = document.getElementById('delivery-mode-note');
  var stageProofsRadio = document.getElementById('ta-stage-proofs');
  var stageFullRadio = document.getElementById('ta-stage-full');

  function currentClient() {
    return {
      name: taName.value.trim(),
      email: taEmail.value.trim(),
      phone: taPhone.value.trim()
    };
  }

  function currentStage() {
    var checked = taForm.querySelector('input[name="stage"]:checked');
    return checked ? checked.value : 'full';
  }

  function currentMethod() {
    var checked = taForm.querySelector('input[name="method"]:checked');
    return checked ? checked.value : 'email';
  }

  function refreshPreview() {
    if (!currentGallery) return;
    var client = currentClient();
    var stage = currentStage();
    var method = currentMethod();
    var opts = {
      gallery: currentGallery, client: client, stage: stage,
      businessName: businessName || 'Your photographer',
      baseUrl: window.location.origin + window.location.pathname.replace(/[^/]+$/, '')
    };
    if (method === 'email') {
      var invite = EasyPhoto.trueAI.buildEmailInvite(opts);
      taPreview.value = 'Subject: ' + invite.subject + '\n\n' + invite.body +
        '\n\n— Sent from your connected email: ' + (connectedEmail || 'not set yet — set it in Settings');
    } else {
      taPreview.value = EasyPhoto.trueAI.buildTextInvite(opts) +
        '\n\n— Sent through your phone\u2019s texting app.';
    }
  }

  function refreshDeliveryModeUI() {
    if (!deliveryMode) {
      deliveryChoice.hidden = false;
      deliveryModeNote.textContent = 'You have not chosen how to deliver galleries yet. Pick one above — it becomes your default, and you can change it in Settings any time.';
      stageProofsRadio.disabled = false;
      stageFullRadio.disabled = false;
      return;
    }
    deliveryChoice.hidden = true;
    if (deliveryMode === 'proofs-first') {
      deliveryModeNote.textContent = 'Your delivery way: proofs first — 6 proofs, then the full gallery, always. (Change it in Settings.)';
      stageProofsRadio.disabled = false;
      stageFullRadio.disabled = false;
      if (!taForm.querySelector('input[name="stage"]:checked')) stageProofsRadio.checked = true;
    } else {
      deliveryModeNote.textContent = 'Your delivery way: full gallery straight away. (Change it in Settings.)';
      stageProofsRadio.disabled = true;
      stageFullRadio.checked = true;
    }
    document.getElementById('ta-stage-note').textContent =
      deliveryMode === 'proofs-first'
        ? 'The full gallery always goes to your client no matter what — the proofs are only a preview.'
        : 'You deliver the full gallery straight away.';
  }

  function refreshDeliveryStatus() {
    if (!currentGallery) return;
    EasyPhoto.trueAI.deliveryStatus(currentGallery.id).then(function (s) {
      var parts = [];
      parts.push(s.proofs ? 'Proofs sent ' + fmtDate(s.proofs) + '.' : 'Proofs not sent yet.');
      parts.push(s.full ? 'Full gallery sent ' + fmtDate(s.full) + '.' : 'Full gallery not sent yet.');
      taDeliveryStatus.textContent = parts.join(' ');
    });
  }

  function setupTrueAI() {
    // Fill the client picker fresh for this gallery.
    taClientSelect.innerHTML = '<option value="">Choose a client…</option>';
    window.db.clients.all().then(function (clients) {
      clients.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = String(c.id);
        opt.textContent = c.name + (c.email ? ' — ' + c.email : '');
        taClientSelect.appendChild(opt);
      });
    });
    // Prefill from the gallery's client.
    if (currentGallery.clientId) {
      window.db.clients.get(currentGallery.clientId).then(function (c) {
        if (!c) return;
        taClientSelect.value = String(c.id);
        taName.value = c.name || '';
        taEmail.value = c.email || '';
        taPhone.value = c.phone || '';
        refreshPreview();
      });
    } else if (currentGallery.clientName) {
      taName.value = currentGallery.clientName;
    }
    window.db.settings.get('gallery.deliveryMode').then(function (mode) {
      deliveryMode = mode || null;
      refreshDeliveryModeUI();
      refreshPreview();
    });
    refreshDeliveryStatus();
  }

  taClientSelect.addEventListener('change', function () {
    var id = taClientSelect.value ? Number(taClientSelect.value) : null;
    if (!id) return;
    window.db.clients.get(id).then(function (c) {
      if (!c) return;
      taName.value = c.name || '';
      taEmail.value = c.email || '';
      taPhone.value = c.phone || '';
      refreshPreview();
    });
  });

  taForm.addEventListener('input', refreshPreview);
  taForm.addEventListener('change', refreshPreview);

  document.getElementById('save-delivery-mode-btn').addEventListener('click', function () {
    var checked = deliveryChoice.querySelector('input[name="deliveryMode"]:checked');
    if (!checked) {
      announce('Choose “Proofs first” or “Full gallery straight away”.', 'assertive');
      return;
    }
    deliveryMode = checked.value;
    window.db.settings.set('gallery.deliveryMode', deliveryMode).then(function () {
      refreshDeliveryModeUI();
      refreshPreview();
      announce('Delivery choice saved: ' +
        (deliveryMode === 'proofs-first' ? 'proofs first, then the full gallery.' : 'full gallery straight away.'));
    });
  });

  taForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!currentGallery) return;
    var client = currentClient();
    var method = currentMethod();
    var stage = currentStage();
    if (method === 'email' && (!client.email || client.email.indexOf('@') === -1)) {
      taStatus.textContent = 'Enter the client\u2019s email address first.';
      announce('Enter the client\u2019s email address first.', 'assertive');
      taEmail.focus();
      return;
    }
    if (method === 'text' && !client.phone) {
      taStatus.textContent = 'Enter the client\u2019s phone number first.';
      announce('Enter the client\u2019s phone number first.', 'assertive');
      taPhone.focus();
      return;
    }
    var opts = {
      gallery: currentGallery, client: client, stage: stage,
      businessName: businessName || 'Your photographer',
      baseUrl: window.location.origin + window.location.pathname.replace(/[^/]+$/, '')
    };
    window.db.photos.byGallery(currentGallery.id).then(function (photos) {
      if (stage === 'proofs' && photos.length < EasyPhoto.trueAI.PROOFS_COUNT) {
        taStatus.textContent = 'Proofs are exactly 6 photos, and this gallery has only ' +
          photos.length + '. Add more photos first, or send the full gallery instead.';
        announce('This gallery has fewer than 6 photos — proofs need exactly 6.', 'assertive');
        return;
      }
      var href = method === 'email'
        ? EasyPhoto.trueAI.emailHref(opts)
        : EasyPhoto.trueAI.textHref(opts);
      return EasyPhoto.trueAI.logSend({
        galleryId: currentGallery.id, stage: stage, method: method,
        clientName: client.name || '', clientContact: method === 'email' ? client.email : client.phone
      }).then(function () {
        refreshDeliveryStatus();
        if (method === 'email') {
          taStatus.textContent = 'True AI opened your email app with the branded ' +
            EasyPhoto.trueAI.stageLabel(stage).toLowerCase() + ' invite. Press send — it goes from your connected email' +
            (connectedEmail ? ' (' + connectedEmail + ')' : '') + '.';
        } else {
          taStatus.textContent = 'True AI opened your phone\u2019s texting app with the ' +
            EasyPhoto.trueAI.stageLabel(stage).toLowerCase() + ' message. Press send to text it to your client.';
        }
        announce(taStatus.textContent);
        window.location.href = href;
      });
    }).catch(function (err) {
      taStatus.textContent = 'Could not send: ' + err.message;
      announce('Could not send: ' + err.message, 'assertive');
    });
  });

  /* ---------------- downloads ---------------- */

  var supportsFolderPicker = typeof window.showDirectoryPicker === 'function';
  fallbackNote.hidden = supportsFolderPicker;

  downloadForm.addEventListener('change', function () {
    var dest = downloadForm.querySelector('input[name="destination"]:checked');
    driveStep.hidden = !(dest && dest.value === 'drive');
  });

  document.getElementById('drive-ready-btn').addEventListener('click', function () {
    downloadStatus.textContent = 'Hard drive ready. Choose “Download photos” and pick your hard drive folder when asked.';
    announce('Hard drive ready. Choose Download photos and pick your hard drive folder when asked.');
  });

  downloadForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!currentGallery) return;
    var dest = downloadForm.querySelector('input[name="destination"]:checked');
    var toDrive = dest && dest.value === 'drive';
    window.db.photos.byGallery(currentGallery.id).then(function (photos) {
      if (!photos.length) {
        downloadStatus.textContent = 'This gallery has no photos to download yet.';
        announce('This gallery has no photos to download yet.', 'assertive');
        return;
      }
      if (supportsFolderPicker) return downloadViaFolder(photos, toDrive);
      return downloadViaAnchors(photos);
    }).catch(function (err) {
      downloadStatus.textContent = 'Download failed: ' + err.message;
      announce('Download failed: ' + err.message, 'assertive');
    });
  });

  function downloadViaFolder(photos, toDrive) {
    downloadStatus.textContent = 'Choose a folder' +
      (toDrive ? ' on your hard drive' : ' — pick your Downloads folder') + '…';
    return window.showDirectoryPicker({ mode: 'readwrite' }).then(function (dir) {
      var chain = Promise.resolve();
      var saved = 0;
      photos.forEach(function (photo) {
        chain = chain.then(function () { return photoBlob(photo); })
          .then(function (blob) {
            return dir.getFileHandle(safeFileName(photo.fileName), { create: true })
              .then(function (handle) { return handle.createWritable(); })
              .then(function (writable) {
                return writable.write(blob).then(function () { return writable.close(); });
              });
          })
          .then(function () { saved += 1; });
      });
      return chain.then(function () {
        downloadStatus.textContent = saved + (saved === 1 ? ' photo' : ' photos') +
          ' saved to the folder you chose.';
        announce(saved + ' photos saved to the folder you chose.');
      });
    }).catch(function (err) {
      if (err && err.name === 'AbortError') {
        downloadStatus.textContent = 'Folder choice cancelled — nothing was downloaded.';
        return;
      }
      throw err;
    });
  }

  function downloadViaAnchors(photos) {
    var done = 0;
    photos.forEach(function (photo, i) {
      window.setTimeout(function () {
        photoBlob(photo).then(function (blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = safeFileName(photo.fileName);
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
        }).catch(function (err) {
          announce('Could not download ' + photo.fileName + ': ' + err.message, 'assertive');
        }).finally(function () {
          done += 1;
          if (done === photos.length) {
            downloadStatus.textContent = photos.length + ' photos downloading to your Downloads folder.';
            announce(photos.length + ' photos downloading to your Downloads folder.');
          }
        });
      }, i * 400);
    });
  }

  /* One self-contained HTML file a client can open in any browser. */
  document.getElementById('download-file-btn').addEventListener('click', function () {
    if (!currentGallery) return;
    downloadStatus.textContent = 'Building your gallery file…';
    window.db.photos.byGallery(currentGallery.id).then(function (photos) {
      if (!photos.length) {
        downloadStatus.textContent = 'This gallery has no photos yet.';
        return Promise.resolve();
      }
      return Promise.all(photos.map(function (p) {
        return photoBlob(p).then(function (blob) { return blobToDataUrl(blob); })
          .then(function (url) {
            return { fileName: p.fileName, alt: p.alt, url: url };
          });
      })).then(function (items) {
        var watermark = currentGallery.watermark || '';
        var figures = items.map(function (item) {
          return '<figure style="margin:0 0 2rem;position:relative">' +
            '<img src="' + item.url + '" alt="' + esc(item.alt) + '" style="max-width:100%;height:auto">' +
            (watermark ? '<span style="position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,.55);color:#fff;padding:2px 8px;font-size:14px;border-radius:4px">' + esc(watermark) + '</span>' : '') +
            '<figcaption>' + esc(item.alt) + '</figcaption></figure>';
        }).join('\n');
        var html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
          '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
          '<title>' + esc(currentGallery.title) + ' — photo gallery</title>\n</head>\n<body>\n' +
          '<h1>' + esc(currentGallery.title) + '</h1>\n' +
          '<p>Your photo gallery. These photos are shared with you. No account needed.</p>\n' +
          figures + '\n</body>\n</html>';
        var blob = new Blob([html], { type: 'text/html' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = slugify(currentGallery.title) + '-gallery.html';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
        downloadStatus.textContent = 'Gallery file downloaded. Send it to your client by text or email.';
        announce('Gallery file downloaded. Send it to your client by text or email.');
      });
    }).catch(function (err) {
      downloadStatus.textContent = 'Could not build the gallery file: ' + err.message;
      announce('Could not build the gallery file: ' + err.message, 'assertive');
    });
  });

  /* ---------------- client view (?g=slug[&proofs=1]) ---------------- */

  var proofsMode = false;
  var clientGallery = null;
  var clientPhotos = [];
  var proofingState = { favorites: [], notes: {} };

  function proofingKey(slug) {
    return 'easy-photo:proofing:' + slug;
  }

  function loadProofing(slug) {
    try {
      var raw = localStorage.getItem(proofingKey(slug));
      if (raw) {
        var parsed = JSON.parse(raw);
        proofingState = {
          favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
          notes: parsed.notes || {}
        };
      }
    } catch (e) { /* start fresh */ }
  }

  function saveProofing(slug) {
    try {
      localStorage.setItem(proofingKey(slug), JSON.stringify(proofingState));
    } catch (e) { /* ignore */ }
  }

  function openClientView(slug) {
    var params = new URLSearchParams(window.location.search);
    proofsMode = params.get('proofs') === '1';
    window.db.galleries.bySlug(slug).then(function (g) {
      if (!g) {
        document.getElementById('client-gallery-title').textContent = 'Gallery not found';
        document.getElementById('client-gallery-note').textContent =
          'This link does not match a gallery on this device. Galleries live on the photographer\u2019s device — ask them to send the gallery file instead.';
        document.getElementById('client-download-btn').hidden = true;
        document.getElementById('client-photo-empty').hidden = false;
        showView('client');
        return;
      }
      clientGallery = g;
      document.getElementById('client-gallery-title').textContent =
        g.title + (proofsMode ? ' — Proofs' : '');
      showView('client');
      document.getElementById('client-gallery-title').focus();
      if (g.passwordHash) {
        // Password gate: the client types the gallery password. No sign-in.
        document.getElementById('client-password-form').hidden = false;
        document.getElementById('cp-password').focus();
      } else {
        renderClientPhotos();
      }
    });
  }

  document.getElementById('client-password-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var pw = document.getElementById('cp-password').value;
    var errEl = document.getElementById('cp-error');
    if (!pw || !clientGallery) return;
    EasyPhoto.auth.hashText(pw).then(function (hash) {
      if (hash === clientGallery.passwordHash) {
        document.getElementById('client-password-form').hidden = true;
        renderClientPhotos();
      } else {
        errEl.textContent = 'That password is not right. Try again, or ask your photographer for the password.';
        errEl.hidden = false;
        document.getElementById('cp-password').focus();
      }
    });
  });

  function clientPhotoItem(photo) {
    var li = document.createElement('li');
    var figure = document.createElement('figure');
    figure.className = 'photo-wrap';
    var img = document.createElement('img');
    img.alt = photo.alt || '';
    img.width = 400;
    img.height = 300;
    figure.appendChild(img);
    if (clientGallery && clientGallery.watermark) {
      var wm = document.createElement('span');
      wm.className = 'photo-watermark';
      wm.setAttribute('aria-hidden', 'true');
      wm.textContent = clientGallery.watermark;
      figure.appendChild(wm);
    }
    var cap = document.createElement('figcaption');
    cap.className = 'photo-alt';
    cap.textContent = photo.alt || '';
    figure.appendChild(cap);
    li.appendChild(figure);
    thumbFor(photo).then(function (url) { if (url) img.src = url; });

    if (proofsMode) {
      var favId = 'fav-' + photo.id;
      var favDiv = document.createElement('div');
      favDiv.className = 'check-row';
      var fav = document.createElement('input');
      fav.type = 'checkbox';
      fav.id = favId;
      fav.checked = proofingState.favorites.indexOf(photo.id) !== -1;
      fav.setAttribute('data-fav', String(photo.id));
      var favLabel = document.createElement('label');
      favLabel.setAttribute('for', favId);
      favLabel.textContent = 'Favorite — I love this one';
      favDiv.appendChild(fav);
      favDiv.appendChild(favLabel);
      li.appendChild(favDiv);
      var noteDiv = document.createElement('div');
      noteDiv.className = 'field';
      var noteLabel = document.createElement('label');
      noteLabel.setAttribute('for', 'note-' + photo.id);
      noteLabel.textContent = 'Note on this photo (optional)';
      var note = document.createElement('input');
      note.type = 'text';
      note.id = 'note-' + photo.id;
      note.value = proofingState.notes[photo.id] || '';
      note.setAttribute('data-note', String(photo.id));
      note.setAttribute('placeholder', 'For example: print this one big');
      noteDiv.appendChild(noteLabel);
      noteDiv.appendChild(note);
      li.appendChild(noteDiv);
    }
    return li;
  }

  function renderClientPhotos() {
    if (!clientGallery) return;
    window.db.photos.byGallery(clientGallery.id).then(function (photos) {
      var shown = proofsMode ? photos.slice(0, EasyPhoto.trueAI.PROOFS_COUNT) : photos;
      clientPhotos = shown;
      document.getElementById('client-content').hidden = false;
      document.getElementById('client-proofs-note').hidden = !proofsMode;
      document.getElementById('client-proofing').hidden = !proofsMode;
      document.getElementById('client-photo-empty').hidden = shown.length !== 0;
      var list = document.getElementById('client-photo-list');
      list.innerHTML = '';
      if (proofsMode) loadProofing(clientGallery.slug);
      shown.forEach(function (p) { list.appendChild(clientPhotoItem(p)); });
      if (proofsMode) {
        announce('Your proofs are here: ' + shown.length + ' preview photos. Pick your favorites and leave notes.');
      }
    });
  }

  document.getElementById('client-photo-list').addEventListener('change', function (e) {
    if (!clientGallery) return;
    var fav = e.target.closest('[data-fav]');
    var note = e.target.closest('[data-note]');
    if (fav) {
      var pid = Number(fav.getAttribute('data-fav'));
      var idx = proofingState.favorites.indexOf(pid);
      if (fav.checked && idx === -1) proofingState.favorites.push(pid);
      if (!fav.checked && idx !== -1) proofingState.favorites.splice(idx, 1);
      saveProofing(clientGallery.slug);
      return;
    }
    if (note) {
      proofingState.notes[Number(note.getAttribute('data-note'))] = note.value.trim();
      saveProofing(clientGallery.slug);
    }
  });

  document.getElementById('client-send-favorites-btn').addEventListener('click', function () {
    if (!clientGallery) return;
    var status = document.getElementById('client-proofing-status');
    var ownerEmail = clientGallery.owner || '';
    if (!ownerEmail) {
      status.textContent = 'Your photographer\u2019s email is not attached to this gallery. Ask them for their email address, or tell them your favorites by text.';
      announce(status.textContent, 'assertive');
      return;
    }
    var byId = {};
    clientPhotos.forEach(function (p) { byId[p.id] = p; });
    var lines = ['Hi,', '', 'Here are my favorites from ' + clientGallery.title + ':', ''];
    if (!proofingState.favorites.length) {
      lines.push('(No favorites ticked yet — tick “Favorite” on the photos you love first.)');
    }
    proofingState.favorites.forEach(function (pid) {
      var p = byId[pid];
      if (!p) return;
      lines.push('★ ' + p.fileName + ' — ' + (p.alt || ''));
      if (proofingState.notes[pid]) lines.push('   Note: ' + proofingState.notes[pid]);
    });
    Object.keys(proofingState.notes).forEach(function (pid) {
      if (proofingState.favorites.indexOf(Number(pid)) === -1 && proofingState.notes[pid]) {
        var p2 = byId[pid];
        if (p2) lines.push('Note on ' + p2.fileName + ': ' + proofingState.notes[pid]);
      }
    });
    lines.push('', 'Thank you!');
    var href = 'mailto:' + encodeURIComponent(ownerEmail) +
      '?subject=' + encodeURIComponent('My favorites from ' + clientGallery.title) +
      '&body=' + encodeURIComponent(lines.join('\n'));
    status.textContent = 'Your email app will open with your favorites — press send.';
    announce('Your email app will open with your favorites. Press send.');
    window.location.href = href;
  });

  document.getElementById('client-download-btn').addEventListener('click', function () {
    if (!clientGallery) return;
    var status = document.getElementById('client-download-status');
    window.db.photos.byGallery(clientGallery.id).then(function (all) {
      var toDownload = proofsMode ? all.slice(0, EasyPhoto.trueAI.PROOFS_COUNT) : all;
      if (!toDownload.length) { status.textContent = 'This gallery has no photos yet.'; return; }
      if (supportsFolderPicker) {
        status.textContent = 'Choose a folder to save the photos…';
        return downloadViaFolder(toDownload, false).then(function () {
          status.textContent = downloadStatus.textContent;
        });
      }
      downloadViaAnchors(toDownload);
      status.textContent = toDownload.length + ' photos downloading.';
    }).catch(function (err) {
      status.textContent = 'Download failed: ' + err.message;
    });
  });

  /* ---------------- start ---------------- */

  EasyPhoto.a11y.initA11y();
  // Business name + connected email for True AI messages.
  Promise.all([
    window.db.settings.get('business.name'),
    window.db.settings.get('email.sender')
  ]).then(function (vals) {
    businessName = vals[0] || '';
    connectedEmail = vals[1] || '';
    var user = EasyPhoto.auth.currentUser();
    if (!businessName && user) businessName = user.name || '';
    if (!connectedEmail && user) connectedEmail = user.email || '';
  });
  var params = new URLSearchParams(window.location.search);
  var slugParam = params.get('g');
  if (slugParam) {
    openClientView(slugParam);
  } else {
    EasyPhoto.auth.requireAuth();
    showView('list');
    loadClientsIntoSelect().then(renderList);
  }
})();
