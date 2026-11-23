/* Easy Photo — Booking (v1)
 *
 * Two audiences, one page:
 *  - Photographer (signed in): MAKE a free booking form in the app, or
 *    CONNECT a booking form they already have; then SEND the form link to
 *    anyone interested, by text or email, straight from the app.
 *  - Client (public ?form=<id>): fills in the booking form, including
 *    "How do you want to receive your gallery?" with four choices. The
 *    booking lands in the photographer's Inbox as a lead.
 *
 * Mary's owner account is special: her booking form IS the form on her
 * photography site (https://pure-photography.github.io/booking.html) — one
 * shared form, not a copy. The app links to it and sends that link.
 */
(function () {
  'use strict';

  var SITE_FORM_URL = 'https://pure-photography.github.io/booking.html';
  var DELIVERY_LABELS = {
    'email': 'Via email',
    'text': 'Via text',
    'email-link': 'Via email a gallery link',
    'text-link': 'Via text a gallery link'
  };

  function announce(msg, priority) {
    EasyPhoto.a11y.announce(msg, priority);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var params = new URLSearchParams(window.location.search);
  var formId = params.get('form');

  /* ============================ client view ============================ */
  if (formId) {
    document.getElementById('view-manage').hidden = true;
    document.getElementById('view-client').hidden = false;
    EasyPhoto.a11y.initA11y();
    openClientForm(Number(formId));
    return;
  }

  /* ============================ manage view ============================ */
  EasyPhoto.a11y.initA11y();
  EasyPhoto.auth.requireAuth();

  var manageView = document.getElementById('view-manage');
  var makeForm = document.getElementById('make-form');
  var connectForm = document.getElementById('connect-form');
  var formList = document.getElementById('form-list');
  var formEmpty = document.getElementById('form-list-empty');
  var sendLinkInput = document.getElementById('send-link');
  var sendStatus = document.getElementById('send-status');
  var activeFormUrl = '';

  function setActiveFormUrl(url, label) {
    activeFormUrl = url;
    sendLinkInput.value = url;
    sendStatus.textContent = label ? 'Sharing: ' + label : '';
  }

  function renderForms() {
    var user = EasyPhoto.auth.currentUser();
    if (!user) return Promise.resolve();
    return window.db.bookingForms.query('byOwner', user.email).then(function (forms) {
      forms.sort(function (a, b) {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
      formEmpty.hidden = forms.length !== 0;
      formList.innerHTML = '';
      forms.forEach(function (f) {
        var url = window.location.origin + window.location.pathname + '?form=' + f.id;
        var li = document.createElement('li');
        li.innerHTML = '<strong>' + esc(f.title) + '</strong> — ' +
          '<a href="' + esc(url) + '">Open the form</a><br>' +
          '<button type="button" class="btn" data-share="' + f.id + '">Send this form</button> ' +
          '<button type="button" class="btn btn-danger" data-delete-form="' + f.id + '">Delete form</button>';
        formList.appendChild(li);
      });
      return window.db.settings.get('booking.connectedFormUrl');
    }).then(function (connectedUrl) {
      var user2 = EasyPhoto.auth.currentUser();
      if (EasyPhoto.auth.isOwner() && user2) {
        document.getElementById('owner-form-note').hidden = false;
        if (!activeFormUrl) setActiveFormUrl(SITE_FORM_URL, 'your booking form on your photography site');
        return;
      }
      if (connectedUrl) {
        if (!activeFormUrl) setActiveFormUrl(connectedUrl, 'your connected booking form');
      }
    });
  }

  formList.addEventListener('click', function (e) {
    var shareBtn = e.target.closest('[data-share]');
    var delBtn = e.target.closest('[data-delete-form]');
    if (shareBtn) {
      var id = Number(shareBtn.getAttribute('data-share'));
      var url = window.location.origin + window.location.pathname + '?form=' + id;
      setActiveFormUrl(url, 'your booking form');
      document.getElementById('send-heading').scrollIntoView();
      document.getElementById('send-phone').focus();
      return;
    }
    if (delBtn) {
      var did = Number(delBtn.getAttribute('data-delete-form'));
      if (!window.confirm('Delete this booking form? The link will stop working.')) return;
      window.db.bookingForms.remove(did).then(function () {
        announce('Booking form deleted.');
        renderForms();
      });
    }
  });

  document.getElementById('choose-make-btn').addEventListener('click', function () {
    makeForm.hidden = false;
    connectForm.hidden = true;
    document.getElementById('bf-title').focus();
  });
  document.getElementById('choose-connect-btn').addEventListener('click', function () {
    connectForm.hidden = false;
    makeForm.hidden = true;
    document.getElementById('cf-url').focus();
  });

  makeForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var user = EasyPhoto.auth.currentUser();
    if (!user) return;
    var titleInput = document.getElementById('bf-title');
    var titleError = document.getElementById('bf-title-error');
    var title = titleInput.value.trim();
    if (!title) {
      titleError.textContent = 'Please give your form a title.';
      titleError.hidden = false;
      titleInput.setAttribute('aria-invalid', 'true');
      titleInput.focus();
      return;
    }
    titleError.hidden = true;
    titleInput.removeAttribute('aria-invalid');
    var shootTypes = [];
    makeForm.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) {
      shootTypes.push(cb.value);
    });
    if (!shootTypes.length) shootTypes = ['Portrait', 'Family', 'Other'];
    window.db.bookingForms.add({
      owner: user.email, title: title, businessName: user.name || '',
      shootTypes: shootTypes
    }).then(function (id) {
      makeForm.reset();
      makeForm.hidden = true;
      var url = window.location.origin + window.location.pathname + '?form=' + id;
      setActiveFormUrl(url, 'your new booking form');
      announce('Booking form created. Send it to anyone who wants to book you.');
      renderForms();
    });
  });

  connectForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var urlInput = document.getElementById('cf-url');
    var urlError = document.getElementById('cf-url-error');
    var url = urlInput.value.trim();
    if (url && url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) {
      url = 'https://' + url;
    }
    if (!url || url.indexOf('.') === -1) {
      urlError.textContent = 'Please enter a full web address, for example https://example.com/book';
      urlError.hidden = false;
      urlInput.setAttribute('aria-invalid', 'true');
      urlInput.focus();
      return;
    }
    urlError.hidden = true;
    urlInput.removeAttribute('aria-invalid');
    window.db.settings.set('booking.connectedFormUrl', url).then(function () {
      connectForm.hidden = true;
      setActiveFormUrl(url, 'your connected booking form');
      announce('Booking form connected.');
      renderForms();
    });
  });

  document.getElementById('copy-send-link-btn').addEventListener('click', function () {
    var link = sendLinkInput.value;
    if (!link) { announce('Choose or make a booking form first.', 'assertive'); return; }
    function done() { announce('Booking form link copied.'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(done, function () {
        sendLinkInput.select();
        try { document.execCommand('copy'); done(); }
        catch (err) { announce('Copy did not work — the link is in the text box above.', 'assertive'); }
      });
    } else {
      sendLinkInput.select();
      try { document.execCommand('copy'); done(); }
      catch (err) { announce('Copy did not work — the link is in the text box above.', 'assertive'); }
    }
  });

  function updateSendLinks() {
    var phone = document.getElementById('send-phone').value.trim();
    var email = document.getElementById('send-email').value.trim();
    var link = sendLinkInput.value;
    var text = 'Hi! Here is my booking form: ' + link;
    document.getElementById('send-text-btn').href =
      'sms:' + encodeURIComponent(phone) + '?&body=' + encodeURIComponent(text);
    document.getElementById('send-email-btn').href =
      'mailto:' + encodeURIComponent(email) +
      '?subject=' + encodeURIComponent('Book a photo session') +
      '&body=' + encodeURIComponent(text);
  }
  ['send-phone', 'send-email'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', updateSendLinks);
  });
  sendLinkInput.addEventListener('input', updateSendLinks);
  document.getElementById('send-text-btn').addEventListener('click', function () {
    if (!sendLinkInput.value) { announce('Choose or make a booking form first.', 'assertive'); return; }
    if (!document.getElementById('send-phone').value.trim()) {
      sendStatus.textContent = 'Enter their phone number first, then choose “Send by text”.';
      announce('Enter their phone number first.', 'assertive');
    }
  });
  document.getElementById('send-email-btn').addEventListener('click', function () {
    if (!sendLinkInput.value) { announce('Choose or make a booking form first.', 'assertive'); return; }
    if (!document.getElementById('send-email').value.trim()) {
      sendStatus.textContent = 'Enter their email address first, then choose “Send by email”.';
      announce('Enter their email address first.', 'assertive');
    }
  });

  renderForms().then(updateSendLinks);

  /* ============================ client form (?form=<id>) ============================ */
  function openClientForm(id) {
    window.db.bookingForms.get(id).then(function (form) {
      var titleEl = document.getElementById('client-form-title');
      var introEl = document.getElementById('client-form-intro');
      if (!form) {
        titleEl.textContent = 'Booking form not found';
        introEl.textContent = 'This booking link does not match a form. Ask the photographer to send you a fresh link.';
        document.getElementById('client-form').hidden = true;
        return;
      }
      titleEl.textContent = form.title;
      introEl.textContent = 'Book a session' + (form.businessName ? ' with ' + form.businessName : '') +
        '. Fill this in and the photographer will get back to you.';
      var typeSelect = document.getElementById('cb-type');
      typeSelect.innerHTML = '<option value="">Choose one</option>';
      (form.shootTypes || []).forEach(function (t) {
        var opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        typeSelect.appendChild(opt);
      });
      var phoneInput = document.getElementById('cb-phone');
      document.getElementById('client-form').addEventListener('change', function (e) {
        if (e.target && e.target.name === 'galleryDelivery') {
          phoneInput.required = (e.target.value === 'text' || e.target.value === 'text-link');
        }
      });
      document.getElementById('client-form').addEventListener('submit', function (e) {
        e.preventDefault();
        submitClientBooking(form);
      });
    });
  }

  function fieldError(inputId, errorId, message) {
    var input = document.getElementById(inputId);
    var err = document.getElementById(errorId);
    if (message) {
      err.textContent = message;
      err.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      return input;
    }
    err.hidden = true;
    input.removeAttribute('aria-invalid');
    return null;
  }

  function submitClientBooking(form) {
    var name = document.getElementById('cb-name').value.trim();
    var email = document.getElementById('cb-email').value.trim();
    var phone = document.getElementById('cb-phone').value.trim();
    var type = document.getElementById('cb-type').value;
    var date = document.getElementById('cb-date').value;
    var delivery = (document.querySelector('input[name="galleryDelivery"]:checked') || {}).value || '';
    var message = document.getElementById('cb-message').value.trim();
    var firstBad = null;
    firstBad = fieldError('cb-name', 'cb-name-error', name ? '' : 'Please enter your name.') || firstBad;
    firstBad = fieldError('cb-email', 'cb-email-error',
      (!email || email.indexOf('@') === -1) ? 'Please enter a valid email address.' : '') || firstBad;
    if (!type || !date || !delivery) {
      firstBad = firstBad || document.getElementById('cb-type');
      announce('Please choose a shoot type, a date, and how you want your gallery.', 'assertive');
    }
    if ((delivery === 'text' || delivery === 'text-link') && !phone) {
      announce('A phone number is needed for text delivery.', 'assertive');
      document.getElementById('cb-phone').focus();
      return;
    }
    if (firstBad) { firstBad.focus(); return; }
    var deliveryLabel = DELIVERY_LABELS[delivery] || delivery;
    var fullMessage = 'Booking request via "' + form.title + '". Shoot type: ' + type +
      '. Preferred date: ' + date + '. Gallery delivery: ' + deliveryLabel + '.' +
      (phone ? ' Phone: ' + phone + '.' : '') +
      (message ? ' They wrote: ' + message : '');
    // Find or create the client by email, then a lead and a session inquiry.
    window.db.clients.query('byEmail', email).then(function (found) {
      if (found.length) return found[0];
      return window.db.clients.add({
        name: name, email: email, phone: phone, address: '',
        source: 'booking form', notes: '', tags: []
      }).then(function (id) { return window.db.clients.get(id); });
    }).then(function (client) {
      return window.db.leads.add({
        name: name, contact: email, channel: 'form',
        requestedDate: date, message: fullMessage,
        availabilityChecked: false, status: 'new'
      }).then(function () {
        return window.db.sessions.add({
          clientId: client.id, type: type, date: date, time: '',
          location: '', status: 'inquiry', price: null,
          retainerPaid: false, balanceDue: null, notes: fullMessage
        });
      });
    }).then(function () {
      document.getElementById('client-form').hidden = true;
      var conf = document.getElementById('client-confirmation');
      conf.hidden = false;
      document.getElementById('client-confirmation-text').textContent =
        'Thank you, ' + name + '! Your request for ' + type + ' on ' + date +
        ' is in. You chose gallery delivery: ' + deliveryLabel +
        '. The photographer will get back to you at ' + email + '.';
      announce('Booking request sent.');
      conf.querySelector('h3').setAttribute('tabindex', '-1');
      conf.querySelector('h3').focus();
    }).catch(function (err) {
      document.getElementById('client-status').textContent =
        'Something went wrong sending your request: ' + err.message;
      announce('Something went wrong sending your request: ' + err.message, 'assertive');
    });
  }
})();
