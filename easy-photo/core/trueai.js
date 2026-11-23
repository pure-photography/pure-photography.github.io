/* Easy Photo — True AI, the gallery sender (v1)
 *
 * True AI is Mary's virtual receptionist from her Pure Photography site,
 * now working inside Easy Photo too. True AI is the one that sends the
 * gallery emails and text messages for gallery delivery: the photographer
 * chooses email or text, and True AI writes the branded message.
 *
 * Plain truth about how it goes out: Easy Photo has no server, so True AI
 * cannot send anything by itself. Email goes through the photographer's
 * connected email — True AI composes the branded invite and opens it in
 * the photographer's own email app, and the photographer presses send.
 * Text goes through the phone's texting app the same way (sms:). Nothing
 * is sent silently, and no paid texting service is used.
 *
 * Delivery is two stages when the photographer chose proofs-first:
 *   1. a proofs gallery of exactly six photos;
 *   2. then the full gallery — always, no matter what the client says
 *      about the proofs. The proofs are only a preview.
 * Photographers who chose full-gallery delivery send the full gallery
 * straight away. See settings "Gallery delivery".
 *
 * Clients never sign in: the gallery link opens directly. If the
 * photographer set a gallery password, the client just types that password.
 */
(function (global) {
  'use strict';

  var PROOFS_COUNT = 6;
  var LOG_KEY = 'trueai.sentLog';
  var LOG_MAX = 100;

  function galleryUrl(slug, stage, baseUrl) {
    var origin = baseUrl || (global.location &&
      global.location.origin + global.location.pathname.replace(/[^/]+$/, ''));
    var path = (origin || '').replace(/\/$/, '') + '/galleries/galleries.html';
    return path + '?g=' + encodeURIComponent(slug) + (stage === 'proofs' ? '&proofs=1' : '');
  }

  function stageLabel(stage) {
    return stage === 'proofs' ? 'Proofs (6 photos)' : 'Full gallery';
  }

  function buildEmailInvite(opts) {
    var gallery = opts.gallery;
    var client = opts.client || {};
    var stage = opts.stage || 'full';
    var business = opts.businessName || 'Your photographer';
    var url = galleryUrl(gallery.slug, stage, opts.baseUrl);
    var subject = stage === 'proofs'
      ? 'Your proofs are ready — ' + gallery.title + ' (' + business + ')'
      : 'Your gallery is ready — ' + gallery.title + ' (' + business + ')';
    var lines = [];
    lines.push('Hi ' + (client.name || 'there') + ',');
    lines.push('');
    if (stage === 'proofs') {
      lines.push('Your proofs are ready! Here are six preview photos from ' +
        gallery.title + '.');
      lines.push('');
      lines.push('Open your proofs: ' + url);
      lines.push('');
      lines.push('Pick your favorites and leave notes on the photos — your ' +
        'photographer will see them. The proofs are only a preview: your ' +
        'full gallery is coming no matter what, after the proofs.');
    } else {
      lines.push('Your full gallery is ready! Here it is:');
      lines.push('');
      lines.push('Open your gallery: ' + url);
      lines.push('');
      lines.push('Every photo from ' + gallery.title + ' is here. Download ' +
        'any photo you love.');
    }
    lines.push('');
    lines.push('No sign-in needed — the link opens straight to your gallery.' +
      (gallery.passwordHash ? ' It is protected with a password; your photographer will share it with you.' : ''));
    if (gallery.watermark) {
      lines.push('Your photos carry the watermark “' + gallery.watermark + '”.');
    }
    lines.push('');
    lines.push('With love,');
    lines.push(business);
    return { subject: subject, body: lines.join('\n') };
  }

  function buildTextInvite(opts) {
    var gallery = opts.gallery;
    var client = opts.client || {};
    var stage = opts.stage || 'full';
    var business = opts.businessName || 'Your photographer';
    var url = galleryUrl(gallery.slug, stage, opts.baseUrl);
    if (stage === 'proofs') {
      return 'Hi ' + (client.name || 'there') + '! Your proofs are ready — 6 preview ' +
        'photos from ' + gallery.title + ': ' + url +
        ' Pick your favorites and leave notes. Your full gallery follows no matter what. — ' + business;
    }
    return 'Hi ' + (client.name || 'there') + '! Your full gallery is ready — ' +
      gallery.title + ': ' + url + ' No sign-in needed. — ' + business;
  }

  function emailHref(opts) {
    var invite = buildEmailInvite(opts);
    var to = (opts.client && opts.client.email) || '';
    return 'mailto:' + encodeURIComponent(to) +
      '?subject=' + encodeURIComponent(invite.subject) +
      '&body=' + encodeURIComponent(invite.body);
  }

  function textHref(opts) {
    var body = buildTextInvite(opts);
    var phone = (opts.client && opts.client.phone) || '';
    return 'sms:' + encodeURIComponent(phone) + '?&body=' + encodeURIComponent(body);
  }

  /* Delivery log: kept in settings so the photographer can see what True AI
   * already sent for each gallery, and when. */
  function getLog() {
    return EasyPhoto.db.ready.then(function (db) {
      return db.settings.get(LOG_KEY);
    }).then(function (log) { return Array.isArray(log) ? log : []; });
  }

  function logSend(entry) {
    return getLog().then(function (log) {
      log.push(Object.assign({ when: new Date().toISOString() }, entry));
      if (log.length > LOG_MAX) log = log.slice(-LOG_MAX);
      return EasyPhoto.db.ready.then(function (db) {
        return db.settings.set(LOG_KEY, log);
      });
    });
  }

  function deliveryStatus(galleryId) {
    return getLog().then(function (log) {
      var status = { proofs: null, full: null };
      log.forEach(function (e) {
        if (e.galleryId === galleryId) {
          if (e.stage === 'proofs' && !status.proofs) status.proofs = e.when;
          if (e.stage === 'full' && !status.full) status.full = e.when;
        }
      });
      return status;
    });
  }

  var EasyPhoto = global.EasyPhoto || (global.EasyPhoto = {});
  EasyPhoto.trueAI = {
    PROOFS_COUNT: PROOFS_COUNT,
    galleryUrl: galleryUrl,
    stageLabel: stageLabel,
    buildEmailInvite: buildEmailInvite,
    buildTextInvite: buildTextInvite,
    emailHref: emailHref,
    textHref: textHref,
    getLog: getLog,
    logSend: logSend,
    deliveryStatus: deliveryStatus
  };
})(typeof window !== 'undefined' ? window : this);
