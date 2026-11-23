/* Easy Photo — Settings (v1)
 *
 * AI choice, editors/calendar, agent keys, and data backup/restore.
 * Agent keys: the photographer authorizes an AI (any AI, not only Muse) by
 * creating a key. Only a scrambled hash of the key is stored, never the key.
 * The agent signs in with the photographer's business email + the key, and
 * acts only within that photographer's account.
 */
(function () {
  'use strict';

  function announce(msg, priority) {
    EasyPhoto.a11y.announce(msg, priority);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- AI choice ---------- */
  var aiForm = document.getElementById('ai-form');
  aiForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var provider = document.getElementById('ai-provider').value;
    var other = document.getElementById('ai-other').value.trim();
    var key = document.getElementById('ai-key').value;
    Promise.all([
      window.db.settings.set('ai.provider', provider),
      window.db.settings.set('ai.other', other),
      window.db.settings.set('ai.key', key)
    ]).then(function () { announce('AI choice saved.'); });
  });

  /* ---------- AI draft prompt ---------- */
  var leadSelect = document.getElementById('ai-lead');
  var promptBox = document.getElementById('ai-prompt');
  window.db.leads.all().then(function (leads) {
    leads.sort(function (a, b) {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    leads.slice(0, 30).forEach(function (l) {
      var opt = document.createElement('option');
      opt.value = String(l.id);
      opt.textContent = (l.name || 'Lead') + ' — ' + (l.channel || '') +
        (l.requestedDate ? ' — ' + l.requestedDate : '');
      leadSelect.appendChild(opt);
    });
  });
  document.getElementById('ai-draft-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = leadSelect.value;
    if (!id) { announce('Choose a lead first.', 'assertive'); return; }
    window.db.leads.get(Number(id)).then(function (l) {
      if (!l) return;
      var prompt = 'You are my photography studio assistant. Draft a warm, professional reply to this booking inquiry in my voice. ' +
        'Keep it short and friendly, and do not make promises about dates or prices I have not confirmed.\n\n' +
        'Name: ' + (l.name || '') + '\n' +
        'Contact: ' + (l.contact || '') + '\n' +
        'Channel: ' + (l.channel || '') + '\n' +
        'Requested date: ' + (l.requestedDate || 'not given') + '\n' +
        'Their message: ' + (l.message || '') + '\n\n' +
        'Draft the reply only — no extra explanation.';
      promptBox.value = prompt;
      announce('Prompt built. Copy it into your AI.');
    });
  });
  document.getElementById('ai-copy-btn').addEventListener('click', function () {
    if (!promptBox.value) { announce('Build a prompt first.', 'assertive'); return; }
    promptBox.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(promptBox.value)
        .then(function () { announce('Prompt copied.'); });
    } else {
      try { document.execCommand('copy'); announce('Prompt copied.'); }
      catch (err) { announce('Copy did not work — select the text and copy it yourself.', 'assertive'); }
    }
  });

  /* ---------- editors + calendar ---------- */
  document.getElementById('editors-form').addEventListener('submit', function (e) {
    e.preventDefault();
    Promise.all([
      window.db.settings.set('tools.editor', document.getElementById('ed-lightroom').value.trim()),
      window.db.settings.set('tools.videoEditor', document.getElementById('ed-video').value.trim()),
      window.db.settings.set('tools.calendar', document.getElementById('ed-calendar').value.trim())
    ]).then(function () { announce('Editors and calendar saved.'); });
  });

  /* ---------- agent keys ---------- */
  var agentForm = document.getElementById('agent-form');
  var agentName = document.getElementById('agent-name');
  var agentNameError = document.getElementById('agent-name-error');
  var agentList = document.getElementById('agent-list');
  var agentEmpty = document.getElementById('agent-empty');
  var keyResult = document.getElementById('agent-key-result');
  var keyValue = document.getElementById('agent-key-value');

  function renderAgentKeys() {
    var owner = EasyPhoto.auth.currentUser();
    if (!owner) return Promise.resolve();
    return window.db.agentKeys.query('byOwner', owner.email).then(function (keys) {
      keys.sort(function (a, b) {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
      agentEmpty.hidden = keys.length !== 0;
      agentList.innerHTML = '';
      keys.forEach(function (k) {
        var li = document.createElement('li');
        li.innerHTML = '<strong>' + esc(k.name) + '</strong> — ' +
          (k.revoked ? '<span class="ep-status" data-tone="warning">Revoked</span>' :
            '<span class="ep-status" data-tone="success">✓ Active</span>') +
          ' <span>Created ' + new Date(k.createdAt).toLocaleDateString('en-US',
            { month: 'short', day: 'numeric', year: 'numeric' }) + '</span>' +
          (k.lastUsedAt ? ' <span>Last used ' + new Date(k.lastUsedAt).toLocaleDateString('en-US',
            { month: 'short', day: 'numeric', year: 'numeric' }) + '</span>' : '') +
          (k.revoked ? '' : ' <button type="button" class="btn btn-danger" data-revoke="' + k.id + '">Revoke key</button>');
        agentList.appendChild(li);
      });
    });
  }

  agentList.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-revoke]');
    if (!btn) return;
    var id = Number(btn.getAttribute('data-revoke'));
    if (!window.confirm('Revoke this agent key? The agent will no longer be able to sign in with it.')) return;
    window.db.agentKeys.update(id, { revoked: true }).then(function () {
      announce('Agent key revoked.');
      renderAgentKeys();
    });
  });

  agentForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var owner = EasyPhoto.auth.currentUser();
    if (!owner) {
      announce('Sign in first to create an agent key.', 'assertive');
      return;
    }
    var name = agentName.value.trim();
    if (!name) {
      agentNameError.textContent = 'Please name the agent, for example “Hannah”.';
      agentNameError.hidden = false;
      agentName.setAttribute('aria-invalid', 'true');
      agentName.focus();
      return;
    }
    agentNameError.hidden = true;
    agentName.removeAttribute('aria-invalid');
    var rawKey = EasyPhoto.auth.makeAgentKey();
    EasyPhoto.auth.hashText(rawKey).then(function (hash) {
      return window.db.agentKeys.add({
        owner: owner.email, name: name, keyHash: hash,
        revoked: false, lastUsedAt: null
      });
    }).then(function () {
      keyValue.value = rawKey;
      keyResult.hidden = false;
      keyValue.focus();
      keyValue.select();
      agentForm.reset();
      announce('Agent key created. Copy it now — it will not be shown again.');
      renderAgentKeys();
    });
  });

  document.getElementById('agent-key-copy-btn').addEventListener('click', function () {
    keyValue.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(keyValue.value)
        .then(function () { announce('Agent key copied.'); });
    } else {
      try { document.execCommand('copy'); announce('Agent key copied.'); }
      catch (err) { announce('Copy did not work — select the key and copy it yourself.', 'assertive'); }
    }
  });

  /* ---------- gallery delivery + True AI ---------- */
  document.getElementById('delivery-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var checked = document.querySelector('input[name="deliveryMode"]:checked');
    if (!checked) { announce('Choose “Proofs first” or “Full gallery straight away”.', 'assertive'); return; }
    window.db.settings.set('gallery.deliveryMode', checked.value).then(function () {
      announce('Delivery choice saved: ' +
        (checked.value === 'proofs-first' ? 'proofs first, then the full gallery.' : 'full gallery straight away.'));
    });
  });

  document.getElementById('trueai-form').addEventListener('submit', function (e) {
    e.preventDefault();
    Promise.all([
      window.db.settings.set('email.sender', document.getElementById('ta-sender').value.trim()),
      window.db.settings.set('business.name', document.getElementById('ta-business').value.trim())
    ]).then(function () { announce('True AI settings saved.'); });
  });

  /* ---------- data backup / restore / wipe ---------- */
  var dataStatus = document.getElementById('data-status');
  document.getElementById('export-data-btn').addEventListener('click', function () {
    EasyPhoto.db.ready.then(function (db) { return db.exportAll(); })
      .then(function (data) {
        // Photos are Blobs and cannot travel in JSON; note that plainly.
        var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'easy-photo-backup.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
        dataStatus.textContent = 'Backup downloaded. Photos are not in this file — use each gallery\u2019s Download button for those.';
        announce('Backup downloaded. Photos are not in this file.');
      });
  });

  document.getElementById('import-data').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(String(reader.result || '')); }
      catch (err) {
        dataStatus.textContent = 'That file is not an Easy Photo backup.';
        return;
      }
      if (!data || !data.stores) {
        dataStatus.textContent = 'That file is not an Easy Photo backup.';
        return;
      }
      EasyPhoto.db.ready.then(function (db) { return db.importAll(data); })
        .then(function () {
          dataStatus.textContent = 'Backup restored.';
          announce('Backup restored.');
          renderAgentKeys();
        })
        .catch(function (err) {
          dataStatus.textContent = 'Restore failed: ' + err.message;
        });
    };
    reader.readAsText(file);
  });

  document.getElementById('wipe-btn').addEventListener('click', function () {
    if (!window.confirm('Erase EVERYTHING Easy Photo has stored in this browser? This cannot be undone.')) return;
    if (!window.confirm('Are you sure? All clients, sessions, leads, galleries, subscribers, and settings will be gone.')) return;
    EasyPhoto.db.ready.then(function (db) {
      var names = Object.keys(db.schema);
      return names.reduce(function (p, name) {
        return p.then(function () { return db[name].clear(); });
      }, Promise.resolve());
    }).then(function () {
      try { localStorage.clear(); } catch (e) { /* ignore */ }
      announce('Everything erased. Reloading.', 'assertive');
      window.setTimeout(function () { window.location.href = '../index.html'; }, 800);
    });
  });

  /* ---------- start ---------- */
  EasyPhoto.a11y.initA11y();
  EasyPhoto.auth.requireAuth();
  Promise.all([
    window.db.settings.get('ai.provider'),
    window.db.settings.get('ai.other'),
    window.db.settings.get('tools.editor'),
    window.db.settings.get('tools.videoEditor'),
    window.db.settings.get('tools.calendar'),
    window.db.settings.get('gallery.deliveryMode'),
    window.db.settings.get('email.sender'),
    window.db.settings.get('business.name')
  ]).then(function (vals) {
    document.getElementById('ai-provider').value = vals[0] || '';
    document.getElementById('ai-other').value = vals[1] || '';
    document.getElementById('ed-lightroom').value = vals[2] || '';
    document.getElementById('ed-video').value = vals[3] || '';
    document.getElementById('ed-calendar').value = vals[4] || '';
    if (vals[5] === 'proofs-first') document.getElementById('gd-proofs').checked = true;
    if (vals[5] === 'full') document.getElementById('gd-full').checked = true;
    document.getElementById('ta-sender').value = vals[6] || '';
    document.getElementById('ta-business').value = vals[7] || '';
  });
  renderAgentKeys();
})();
