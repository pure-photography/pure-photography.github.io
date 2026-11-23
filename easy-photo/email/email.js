/* Easy Photo — Email list (v1)
 *
 * Subscribers live in IndexedDB on this device. Easy Photo does not send
 * email itself: "Email everyone" opens the photographer's own email app
 * with every active subscriber addressed, and they send it themselves.
 */
(function () {
  'use strict';

  var form = document.getElementById('subscriber-form');
  var nameInput = document.getElementById('sf-name');
  var emailInput = document.getElementById('sf-email');
  var emailError = document.getElementById('sf-email-error');
  var sourceSelect = document.getElementById('sf-source');
  var list = document.getElementById('subscriber-list');
  var countEl = document.getElementById('subscriber-count');
  var emptyEl = document.getElementById('subscriber-empty');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function announce(msg, priority) {
    EasyPhoto.a11y.announce(msg, priority);
  }

  function render() {
    return window.db.subscribers.all().then(function (rows) {
      rows.sort(function (a, b) {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
      var active = rows.filter(function (r) { return r.status === 'subscribed'; });
      countEl.textContent = rows.length ? '(' + active.length + ' active of ' + rows.length + ')' : '';
      emptyEl.hidden = rows.length !== 0;
      list.innerHTML = '';
      rows.forEach(function (r) {
        var li = document.createElement('li');
        li.innerHTML =
          '<strong>' + esc(r.name || r.email) + '</strong> — ' + esc(r.email) +
          ' <span class="ep-status" data-tone="' + (r.status === 'subscribed' ? 'success' : 'warning') + '">' +
          (r.status === 'subscribed' ? '✓ Subscribed' : 'Unsubscribed') + '</span>' +
          ' <span>Joined from ' + esc(r.source || 'website') + '</span><br>' +
          '<button type="button" class="btn" data-toggle="' + r.id + '">' +
          (r.status === 'subscribed' ? 'Unsubscribe' : 'Re-subscribe') + '</button> ' +
          '<button type="button" class="btn btn-danger" data-remove="' + r.id + '">Remove</button>';
        list.appendChild(li);
      });
    });
  }

  list.addEventListener('click', function (e) {
    var toggleBtn = e.target.closest('[data-toggle]');
    var removeBtn = e.target.closest('[data-remove]');
    if (toggleBtn) {
      var id = Number(toggleBtn.getAttribute('data-toggle'));
      window.db.subscribers.get(id).then(function (r) {
        if (!r) return;
        var next = r.status === 'subscribed' ? 'unsubscribed' : 'subscribed';
        return window.db.subscribers.update(id, { status: next }).then(function () {
          announce(r.email + (next === 'subscribed' ? ' re-subscribed.' : ' unsubscribed.'));
          render();
        });
      });
      return;
    }
    if (removeBtn) {
      var rid = Number(removeBtn.getAttribute('data-remove'));
      if (!window.confirm('Remove this person from your email list?')) return;
      window.db.subscribers.remove(rid).then(function () {
        announce('Removed from the email list.');
        render();
      });
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = emailInput.value.trim();
    if (!email || email.indexOf('@') === -1) {
      emailError.textContent = 'Please enter a valid email address.';
      emailError.hidden = false;
      emailInput.setAttribute('aria-invalid', 'true');
      emailInput.focus();
      return;
    }
    emailError.hidden = true;
    emailInput.removeAttribute('aria-invalid');
    window.db.subscribers.add({
      name: nameInput.value.trim(),
      email: email,
      source: sourceSelect.value,
      status: 'subscribed'
    }).then(function () {
      form.reset();
      announce(email + ' added to your email list.');
      render();
    }).catch(function (err) {
      if (err && err.name === 'ConstraintError') {
        emailError.textContent = 'That email address is already on your list.';
      } else {
        emailError.textContent = 'Could not add: ' + err.message;
      }
      emailError.hidden = false;
      emailInput.setAttribute('aria-invalid', 'true');
      emailInput.focus();
    });
  });

  document.getElementById('email-all-btn').addEventListener('click', function () {
    window.db.subscribers.byStatus('subscribed').then(function (rows) {
      if (!rows.length) {
        announce('No active subscribers to email.', 'assertive');
        return;
      }
      var addresses = rows.map(function (r) { return r.email; }).join(',');
      window.location.href = 'mailto:?bcc=' + encodeURIComponent(addresses) +
        '&subject=' + encodeURIComponent('News from my photography studio');
      announce('Opening your email app with ' + rows.length + ' subscribers addressed.');
    });
  });

  document.getElementById('export-btn').addEventListener('click', function () {
    window.db.subscribers.all().then(function (rows) {
      function csvCell(v) {
        return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      }
      var lines = ['Name,Email,Source,Status,Joined'];
      rows.forEach(function (r) {
        lines.push([r.name, r.email, r.source, r.status, r.createdAt]
          .map(csvCell).join(','));
      });
      var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'easy-photo-email-list.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      announce('Email list downloaded as a file.');
    });
  });

  EasyPhoto.a11y.initA11y();
  render();
})();
