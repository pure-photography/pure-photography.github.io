/* Easy Photo — Website (v1)
 *
 * Two honest pieces: a simple one-page website builder (fill in details,
 * download a plain HTML file, host it anywhere free), and connecting an
 * existing website (address saved locally; booking-form link to paste on it).
 * Easy Photo cannot edit somebody else's website for them.
 */
(function () {
  'use strict';

  var builderForm = document.getElementById('builder-form');
  var nameInput = document.getElementById('wb-name');
  var nameError = document.getElementById('wb-name-error');
  var taglineInput = document.getElementById('wb-tagline');
  var servicesInput = document.getElementById('wb-services');
  var emailInput = document.getElementById('wb-email');
  var phoneInput = document.getElementById('wb-phone');
  var areaInput = document.getElementById('wb-area');
  var downloadBtn = document.getElementById('wb-download-btn');
  var preview = document.getElementById('wb-preview');

  var connectForm = document.getElementById('connect-form');
  var urlInput = document.getElementById('wc-url');
  var urlError = document.getElementById('wc-url-error');
  var savedLine = document.getElementById('wc-saved');
  var savedLink = document.getElementById('wc-saved-link');
  var bookingLinkInput = document.getElementById('booking-link');

  var builtHtml = '';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function announce(msg, priority) {
    EasyPhoto.a11y.announce(msg, priority);
  }

  function buildSiteHtml(d) {
    var services = d.services.map(function (s) {
      return '    <li>' + esc(s) + '</li>';
    }).join('\n');
    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + esc(d.name) + '</title>\n' +
      '<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;' +
      'padding:0 1rem;line-height:1.6}h1{font-size:2rem}a{color:#b0005e}</style>\n' +
      '</head>\n<body>\n' +
      '<h1>' + esc(d.name) + '</h1>\n' +
      (d.tagline ? '<p><strong>' + esc(d.tagline) + '</strong></p>\n' : '') +
      (d.area ? '<p>Photography in ' + esc(d.area) + '.</p>\n' : '') +
      (services ? '<h2>Services</h2>\n<ul>\n' + services + '\n</ul>\n' : '') +
      '<h2>Book a session</h2>\n' +
      '<p>Use the booking form on Easy Photo, or contact me directly:</p>\n<ul>\n' +
      (d.email ? '<li>Email: <a href="mailto:' + esc(d.email) + '">' + esc(d.email) + '</a></li>\n' : '') +
      (d.phone ? '<li>Phone: ' + esc(d.phone) + '</li>\n' : '') +
      '</ul>\n<p><small>Built with Easy Photo — free forever.</small></p>\n' +
      '</body>\n</html>';
  }

  builderForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = nameInput.value.trim();
    if (!name) {
      nameError.textContent = 'Please enter your business name.';
      nameError.hidden = false;
      nameInput.setAttribute('aria-invalid', 'true');
      nameInput.focus();
      return;
    }
    nameError.hidden = true;
    nameInput.removeAttribute('aria-invalid');
    var data = {
      name: name,
      tagline: taglineInput.value.trim(),
      services: servicesInput.value.split('\n').map(function (s) { return s.trim(); })
        .filter(function (s) { return s; }),
      email: emailInput.value.trim(),
      phone: phoneInput.value.trim(),
      area: areaInput.value.trim()
    };
    builtHtml = buildSiteHtml(data);
    window.db.settings.set('website.builder', data);
    preview.innerHTML = '<h3>Preview</h3>' +
      '<p><strong>' + esc(data.name) + '</strong>' +
      (data.tagline ? ' — ' + esc(data.tagline) : '') + '</p>' +
      (data.services.length ? '<p>Services: ' + esc(data.services.join(', ')) + '</p>' : '') +
      (data.email ? '<p>Contact: ' + esc(data.email) + '</p>' : '');
    downloadBtn.hidden = false;
    announce('Your website is built. Download the file to put it online.');
  });

  downloadBtn.addEventListener('click', function () {
    if (!builtHtml) return;
    var blob = new Blob([builtHtml], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'my-photography-website.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    announce('Website file downloaded.');
  });

  connectForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var url = urlInput.value.trim();
    if (url && url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) {
      url = 'https://' + url;
    }
    if (!url || url.indexOf('.') === -1) {
      urlError.textContent = 'Please enter a full website address, for example https://example.com';
      urlError.hidden = false;
      urlInput.setAttribute('aria-invalid', 'true');
      urlInput.focus();
      return;
    }
    urlError.hidden = true;
    urlInput.removeAttribute('aria-invalid');
    window.db.settings.set('website.url', url).then(function () {
      savedLink.href = url;
      savedLink.textContent = url;
      savedLine.hidden = false;
      announce('Website connected: ' + url);
    });
  });

  document.getElementById('copy-booking-link-btn').addEventListener('click', function () {
    var link = bookingLinkInput.value;
    function done() { announce('Booking link copied.'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(done, function () {
        bookingLinkInput.select();
        try { document.execCommand('copy'); done(); }
        catch (err) { announce('Copy did not work — the link is in the text box above.', 'assertive'); }
      });
    } else {
      bookingLinkInput.select();
      try { document.execCommand('copy'); done(); }
      catch (err) { announce('Copy did not work — the link is in the text box above.', 'assertive'); }
    }
  });

  EasyPhoto.a11y.initA11y();
  EasyPhoto.auth.requireAuth();
  bookingLinkInput.value = window.location.origin +
    window.location.pathname.replace(/website\/website\.html$/, 'booking/booking.html');

  /* ---------- "Do you have a website?" question ---------- */
  var questionSection = document.getElementById('website-question');
  var builderSection = document.getElementById('builder-section');
  var connectSection = document.getElementById('connect-section');
  var googleStatus = document.getElementById('google-search-status');

  function showQuestion() {
    questionSection.hidden = false;
    builderSection.hidden = true;
    connectSection.hidden = true;
    document.getElementById('website-question-h').focus();
  }

  function answerYes() {
    window.db.settings.set('website.hasWebsite', 'yes').then(function () {
      questionSection.hidden = true;
      builderSection.hidden = true;
      connectSection.hidden = false;
      document.getElementById('connect-heading').focus();
      announce('Yes — let\u2019s connect the website you already have.');
    });
  }

  function answerNo() {
    window.db.settings.set('website.hasWebsite', 'no').then(function () {
      questionSection.hidden = true;
      connectSection.hidden = true;
      builderSection.hidden = false;
      document.getElementById('builder-heading').focus();
      announce('No problem — build your website here instead.');
    });
  }

  document.getElementById('has-website-yes').addEventListener('click', answerYes);
  document.getElementById('has-website-no').addEventListener('click', answerNo);
  document.getElementById('change-answer-btn').addEventListener('click', function () {
    window.db.settings.set('website.hasWebsite', null).then(showQuestion);
  });
  document.getElementById('change-answer-btn-2').addEventListener('click', function () {
    window.db.settings.set('website.hasWebsite', null).then(showQuestion);
  });

  /* ---------- Google search for the website matching the business email ----------
   * The app cannot read Google's results (no API, and Google blocks reading
   * its pages from here), so it opens the search in a new tab. The
   * photographer checks the results, then confirms or pastes their address.
   * Never guess, never connect the wrong site. */
  document.getElementById('google-search-btn').addEventListener('click', function () {
    var user = EasyPhoto.auth.currentUser();
    var email = (user && user.email) || '';
    if (!email) {
      googleStatus.textContent = 'Sign in first — the search uses your business email.';
      return;
    }
    var searchUrl = 'https://www.google.com/search?q=' +
      encodeURIComponent('"' + email + '"');
    window.open(searchUrl, '_blank', 'noopener');
    googleStatus.textContent = 'Google opened in a new tab, searching for "' + email +
      '". Check the results: if you see your website, paste its address below and choose “Connect this website”. ' +
      'If Google finds nothing, finds more than one site, or finds the wrong one, paste your address yourself — do not connect a site that is not yours.';
    urlInput.focus();
    announce('Google search opened in a new tab. Check the results, then paste your website address below.');
  });

  /* ---------- Paste a link (always offered, either way) ---------- */
  document.getElementById('paste-link-btn').addEventListener('click', function () {
    connectSection.scrollIntoView();
    urlInput.focus();
    urlInput.select();
    announce('Paste your website address in the box, then choose “Connect this website”.');
  });

  /* ---------- "My website is already connected" ----------
   * For photographers whose AI agent already connected their website for
   * them (the agent did it on the live site). One tap marks the website
   * as connected here — no searching, no pasting, no connect flow. The
   * saved address, if the app already knows it, is shown in the note. */
  var alreadyConnectedBtn = document.getElementById('already-connected-btn');
  var alreadyConnectedNote = document.getElementById('already-connected-note');
  var alreadyConnectedText = document.getElementById('already-connected-text');

  function showAlreadyConnected(url) {
    alreadyConnectedText.textContent = url
      ? 'Your AI agent connected it for you: ' + url + '. There is nothing more to do here.'
      : 'Your AI agent connected it for you, so there is nothing more to do here.';
    alreadyConnectedNote.hidden = false;
  }

  alreadyConnectedBtn.addEventListener('click', function () {
    window.db.settings.set('website.hasWebsite', 'yes').then(function () {
      return window.db.settings.set('website.agentConnected', 'yes');
    }).then(function () {
      return window.db.settings.get('website.url');
    }).then(function (url) {
      showAlreadyConnected(url);
      if (alreadyConnectedNote.scrollIntoView) alreadyConnectedNote.scrollIntoView();
      announce('Your website is marked as connected.');
    });
  });

  /* Restore the agent-connected confirmation on reload. */
  window.db.settings.get('website.agentConnected').then(function (flag) {
    if (!flag) return;
    window.db.settings.get('website.url').then(function (url) {
      showAlreadyConnected(url);
    });
  });

  /* Owner: her site is already connected. */
  if (EasyPhoto.auth.isOwner()) {
    document.getElementById('owner-site-note').hidden = false;
    window.db.settings.get('website.url').then(function (url) {
      if (!url) {
        window.db.settings.set('website.url', EasyPhoto.auth.OWNER_SITE_URL);
        window.db.settings.set('website.hasWebsite', 'yes');
        urlInput.value = EasyPhoto.auth.OWNER_SITE_URL;
        savedLink.href = EasyPhoto.auth.OWNER_SITE_URL;
        savedLink.textContent = EasyPhoto.auth.OWNER_SITE_URL;
        savedLine.hidden = false;
      }
    });
  }

  window.db.settings.get('website.hasWebsite').then(function (answer) {
    if (answer === 'yes') {
      questionSection.hidden = true;
      connectSection.hidden = false;
    } else if (answer === 'no') {
      questionSection.hidden = true;
      builderSection.hidden = false;
    }
  });
  window.db.settings.get('website.url').then(function (url) {
    if (!url) return;
    urlInput.value = url;
    savedLink.href = url;
    savedLink.textContent = url;
    savedLine.hidden = false;
  });
  window.db.settings.get('website.builder').then(function (data) {
    if (!data) return;
    nameInput.value = data.name || '';
    taglineInput.value = data.tagline || '';
    servicesInput.value = (data.services || []).join('\n');
    emailInput.value = data.email || '';
    phoneInput.value = data.phone || '';
    areaInput.value = data.area || '';
  });
})();
