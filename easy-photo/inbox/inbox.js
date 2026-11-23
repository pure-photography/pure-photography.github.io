/*
 * Smart Inbox — availability-FIRST lead flow.
 *
 * Mary's rule is enforced structurally, not just visually:
 * the ONLY action offered on an incoming message is "Check availability".
 * "Create lead" cannot exist until a date has been checked and found free.
 */
(function () {
  'use strict';

  /* ---------- helpers ---------- */
  const $ = (sel) => document.querySelector(sel);

  const CHANNELS = {
    sms:   { label: 'SMS',   icon: '💬' },
    email: { label: 'Email', icon: '✉️' },
    dm:    { label: 'DM',    icon: '📩' },
  };

  const STATUS_META = {
    free:    { word: 'Available', icon: '✓', className: 'free' },
    booked:  { word: 'Booked',    icon: '✕', className: 'booked' },
    blocked: { word: 'Blocked',   icon: '⊘', className: 'blocked' },
  };

  const LEAD_STATUS_META = {
    new:       { word: 'New',       icon: '●' },
    contacted: { word: 'Contacted', icon: '◐' },
    converted: { word: 'Converted', icon: '✔' },
    lost:      { word: 'Lost',      icon: '○' },
  };

  function toISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  function fromISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }
  function prettyDate(iso) {
    return fromISO(iso).toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }
  function announce(msg) {
    const region = $('#announcements');
    region.textContent = '';
    // Force re-announcement even if the same text repeats.
    requestAnimationFrame(() => { region.textContent = msg; });
  }

  /* ---------- state ---------- */
  let queue = [];          // pending simulated messages (in-memory for this session)
  let nextMsgId = 1;
  let activeMessage = null;
  let activeDateISO = null;   // date currently being checked
  let convertingLead = null;

  /* ---------- availability ---------- */
  async function getStatus(dateISO) {
    const rec = await window.db.availability.get(dateISO);
    return rec ? rec.status : 'free';
  }

  async function seedDemoAvailability() {
    const existing = await window.db.availability.all();
    if (existing.length > 0) return; // don't reseed
    const today = new Date();
    const bookedISO = toISO(addDays(today, 10));
    const blockedISO = toISO(addDays(today, 12));
    await window.db.availability.set(bookedISO, {
      status: 'booked',
      note: 'Demo: session — Barry (wedding)',
    });
    await window.db.availability.set(blockedISO, {
      status: 'blocked',
      note: 'Demo: personal day off',
    });
  }

  /* ---------- simulator ---------- */
  function initSimulator() {
    const dateInput = $('#sim-date');
    dateInput.value = toISO(addDays(new Date(), 14));
    dateInput.min = toISO(new Date());

    $('#simulate-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target;
      const channel = form.querySelector('input[name="channel"]:checked').value;
      const msg = {
        id: nextMsgId++,
        channel,
        name: $('#sim-name').value.trim(),
        contact: $('#sim-contact').value.trim(),
        requestedDate: $('#sim-date').value,
        message: $('#sim-message').value.trim(),
      };
      queue.push(msg);
      renderQueue();
      const chLabel = CHANNELS[channel].label;
      announce(
        `Message from ${msg.name} added to the queue. Requested date ${prettyDate(msg.requestedDate)}. Step one: check availability.`
      );
      form.reset();
      dateInput.value = toISO(addDays(new Date(), 14));
      $('#sim-name').focus();
    });
  }

  function renderQueue() {
    const list = $('#message-list');
    list.innerHTML = '';
    $('#queue-empty').hidden = queue.length > 0;
    $('#queue-count').textContent = queue.length ? `(${queue.length})` : '';
    queue.forEach((msg) => {
      const li = document.createElement('li');
      li.className = 'message-card';
      const ch = CHANNELS[msg.channel] || CHANNELS.sms;
      li.innerHTML = `
        <span class="channel"><span aria-hidden="true">${ch.icon}</span> ${ch.label}</span>
        <p class="message-meta"><strong>${escapeHtml(msg.name)}</strong> ·
          ${escapeHtml(msg.contact)} · requested
          <time datetime="${escapeHtml(msg.requestedDate)}">${prettyDate(msg.requestedDate)}</time></p>
        <blockquote>${escapeHtml(msg.message)}</blockquote>`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-primary';
      btn.textContent = `Check availability for ${prettyDate(msg.requestedDate)}`;
      btn.setAttribute('aria-describedby', '');
      btn.addEventListener('click', () => runCheck(msg, msg.requestedDate));
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  /* ---------- availability check (the gate) ---------- */
  async function runCheck(msg, dateISO) {
    activeMessage = msg;
    activeDateISO = dateISO;

    const panel = $('#availability');
    panel.hidden = false;

    $('#check-context').innerHTML =
      `Checking for <strong>${escapeHtml(msg.name)}</strong> ` +
      `(<span aria-hidden="true">${CHANNELS[msg.channel].icon}</span> ${CHANNELS[msg.channel].label}) — ` +
      `requested <time datetime="${escapeHtml(msg.requestedDate)}">${prettyDate(msg.requestedDate)}</time>.`;

    const status = await getStatus(dateISO);
    renderAvailabilityResult(dateISO, status);
    await renderDateStrip(dateISO);

    const free = status === 'free';
    $('#free-actions').hidden = !free;
    $('#conflict-actions').hidden = free;

    if (free) {
      announce(`${prettyDate(dateISO)} is available. You may now create the lead.`);
    } else {
      const rec = await window.db.availability.get(dateISO);
      const note = rec && rec.note ? ` — ${rec.note}` : '';
      $('#conflict-text').textContent =
        `${prettyDate(dateISO)} is ${STATUS_META[status].word}${note}.`;
      announce(
        `Conflict: ${prettyDate(dateISO)} is ${STATUS_META[status].word}${note}. Suggest an alternate date.`
      );
      renderSuggestedDates(dateISO);
    }

    $('#availability-heading').focus();
    panel.scrollIntoView({ block: 'start' });
  }

  function renderAvailabilityResult(dateISO, status) {
    const meta = STATUS_META[status];
    const banner = $('#availability-result');
    banner.className = `result-banner ${meta.className}`;
    banner.innerHTML =
      `<span aria-hidden="true">${meta.icon}</span> ` +
      `<span class="status-word">${meta.word}</span> — ` +
      `<time datetime="${escapeHtml(dateISO)}">${prettyDate(dateISO)}</time>`;
  }

  async function renderDateStrip(centerISO) {
    const strip = $('#date-strip');
    strip.innerHTML = '';
    const center = fromISO(centerISO);
    for (let offset = -7; offset <= 7; offset++) {
      const d = addDays(center, offset);
      const iso = toISO(d);
      const status = await getStatus(iso);
      const meta = STATUS_META[status];
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `date-cell is-${status}${iso === activeDateISO ? ' is-active' : ''}`;
      cell.setAttribute('aria-current', iso === activeDateISO ? 'date' : 'false');
      const dow = d.toLocaleDateString(undefined, { weekday: 'short' });
      cell.innerHTML =
        `<span class="dow">${dow}</span>` +
        `<span class="daynum">${d.getDate()}</span>` +
        `<span class="st"><span aria-hidden="true">${meta.icon}</span> ${meta.word}</span>`;
      if (status === 'free') {
        cell.setAttribute('aria-label', `Select ${prettyDate(iso)}, available`);
        cell.addEventListener('click', () => runCheck(activeMessage, iso));
      } else {
        cell.disabled = true;
        cell.setAttribute('aria-label', `${prettyDate(iso)}, ${meta.word} — not selectable`);
      }
      strip.appendChild(cell);
    }
  }

  async function renderSuggestedDates(fromISODate) {
    const box = $('#suggested-dates');
    box.innerHTML = '';
    const start = fromISO(fromISODate);
    const found = [];
    let cursor = addDays(start, 1);
    while (found.length < 5 && cursor < addDays(start, 60)) {
      if ((await getStatus(toISO(cursor))) === 'free') found.push(toISO(cursor));
      cursor = addDays(cursor, 1);
    }
    if (!found.length) {
      box.innerHTML = '<p class="empty-note">No free dates in the next 60 days. Try the date field above.</p>';
      return;
    }
    const label = document.createElement('p');
    label.textContent = 'Next free dates:';
    box.appendChild(label);
    found.forEach((iso) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = prettyDate(iso);
      b.addEventListener('click', () => runCheck(activeMessage, iso));
      box.appendChild(b);
    });
  }

  function initAvailabilityPanel() {
    $('#cancel-check-btn').addEventListener('click', () => {
      $('#availability').hidden = true;
      activeMessage = null;
      activeDateISO = null;
      announce('Availability check cancelled. The message is back in the queue.');
    });

    $('#recheck-btn').addEventListener('click', async () => {
      const iso = $('#alternate-date').value;
      if (!iso || !activeMessage) {
        announce('Choose an alternate date first.');
        return;
      }
      await runCheck(activeMessage, iso);
    });

    $('#create-lead-btn').addEventListener('click', createLead);
  }

  /* ---------- lead creation (only AFTER a free check) ---------- */
  async function createLead() {
    if (!activeMessage || !activeDateISO) return;
    const status = await getStatus(activeDateISO);
    if (status !== 'free') {
      announce('That date is no longer free. Recheck availability first.');
      await runCheck(activeMessage, activeDateISO);
      return;
    }

    const msg = activeMessage;
    const checkedDateISO = activeDateISO; // captured before state is cleared
    const leadId = await window.db.leads.add({
      name: msg.name,
      contact: msg.contact,
      channel: msg.channel,
      requestedDate: activeDateISO,
      message: msg.message,
      availabilityChecked: { date: activeDateISO, status: 'free' },
      status: 'new',
    });

    const sessionId = await window.db.sessions.add({
      clientId: null, // unknown until the lead converts
      type: 'photo session',
      date: activeDateISO,
      time: '',
      location: '',
      status: 'inquiry',
      price: 0,
      retainerPaid: false,
      balanceDue: 0,
      notes: msg.message,
    });
    await window.db.leads.update(leadId, { sessionId });

    // Remove the message from the queue — it has become a lead.
    queue = queue.filter((m) => m.id !== msg.id);
    renderQueue();

    $('#availability').hidden = true;
    activeMessage = null;
    activeDateISO = null;

    await renderLeads();
    announce(
      `Lead created for ${msg.name}. A session in inquiry status was created for ${prettyDate(checkedDateISO)}.`
    );
    $('#leads-heading').setAttribute('tabindex', '-1');
    $('#leads-heading').focus();
  }

  /* ---------- leads list ---------- */
  async function renderLeads() {
    const filter = $('#lead-filter').value;
    const leads = await window.db.leads.all();
    const visible = leads.filter((l) => filter === 'all' || l.status === filter);
    const list = $('#lead-list');
    list.innerHTML = '';
    $('#leads-empty').hidden = visible.length > 0;
    $('#lead-count').textContent = leads.length ? `(${leads.length})` : '';

    // newest first
    visible.sort((a, b) => (b.id || 0) - (a.id || 0));

    visible.forEach((lead) => {
      const li = document.createElement('li');
      li.className = 'lead-card';
      const meta = LEAD_STATUS_META[lead.status] || LEAD_STATUS_META.new;
      const ch = CHANNELS[lead.channel] || CHANNELS.sms;
      const top = document.createElement('div');
      top.className = 'lead-top';
      top.innerHTML =
        `<strong>${escapeHtml(lead.name)}</strong>` +
        `<span class="badge badge-${escapeHtml(lead.status)}">` +
        `<span class="badge-icon" aria-hidden="true">${meta.icon}</span> ${meta.word}</span>`;
      li.appendChild(top);

      const detail = document.createElement('p');
      detail.className = 'lead-detail';
      detail.innerHTML =
        `<span aria-hidden="true">${ch.icon}</span> ${ch.label} · ${escapeHtml(lead.contact)} · ` +
        `requested <time datetime="${escapeHtml(lead.requestedDate || '')}">` +
        `${lead.requestedDate ? prettyDate(lead.requestedDate) : 'no date'}</time>`;
      li.appendChild(detail);

      if (lead.message) {
        const msg = document.createElement('p');
        msg.className = 'lead-detail';
        msg.textContent = `“${lead.message}”`;
        li.appendChild(msg);
      }

      const actions = document.createElement('div');
      actions.className = 'lead-actions';

      if (lead.status === 'new') {
        actions.appendChild(
          actionButton('Mark contacted', 'btn', () => updateLeadStatus(lead, 'contacted'))
        );
      }
      if (lead.status === 'new' || lead.status === 'contacted') {
        actions.appendChild(
          actionButton('Convert to booking', 'btn btn-primary', () => openConvert(lead))
        );
        actions.appendChild(
          actionButton('Mark lost', 'btn btn-ghost', () => updateLeadStatus(lead, 'lost'))
        );
      }
      if (actions.children.length) li.appendChild(actions);
      list.appendChild(li);
    });
  }

  function actionButton(label, className, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  async function updateLeadStatus(lead, status) {
    await window.db.leads.update(lead.id, { status });
    await renderLeads();
    announce(`Lead for ${lead.name} marked as ${LEAD_STATUS_META[status].word}.`);
  }

  /* ---------- convert lead → booking ---------- */
  function openConvert(lead) {
    convertingLead = lead;
    $('#convert').hidden = false;
    $('#convert-context').innerHTML =
      `Converting lead for <strong>${escapeHtml(lead.name)}</strong> — ` +
      `requested <time datetime="${escapeHtml(lead.requestedDate || '')}">` +
      `${lead.requestedDate ? prettyDate(lead.requestedDate) : 'no date'}</time>.`;
    $('#conv-date').value = lead.requestedDate || '';
    $('#conv-date').min = toISO(new Date());
    $('#convert-heading').focus();
    $('#convert').scrollIntoView({ block: 'start' });
  }

  async function confirmConvert(e) {
    e.preventDefault();
    const lead = convertingLead;
    if (!lead) return;

    const dateISO = $('#conv-date').value;
    const time = $('#conv-time').value;
    const location = $('#conv-location').value.trim();
    const price = Number($('#conv-price').value || 0);

    // Re-verify availability at the moment of booking — the gate closes twice.
    const status = await getStatus(dateISO);
    if (status !== 'free') {
      const rec = await window.db.availability.get(dateISO);
      const note = rec && rec.note ? ` — ${rec.note}` : '';
      announce(
        `Cannot book: ${prettyDate(dateISO)} is now ${STATUS_META[status].word}${note}. Pick another date.`
      );
      return;
    }

    // 1. Create the client record.
    const clientId = await window.db.clients.add({
      name: lead.name,
      contact: lead.contact,
      channel: lead.channel,
      source: 'smart-inbox-lead',
    });

    // 2. Move the inquiry session to booked.
    await window.db.sessions.update(lead.sessionId, {
      clientId,
      date: dateISO,
      time,
      location,
      status: 'booked',
      price,
      balanceDue: price,
    });

    // 3. Mark the date booked on the availability calendar.
    await window.db.availability.set(dateISO, {
      status: 'booked',
      note: `Booked: ${lead.name}`,
    });

    // 4. Mark the lead converted.
    await window.db.leads.update(lead.id, { status: 'converted', clientId });

    $('#convert').hidden = true;
    convertingLead = null;
    $('#convert-form').reset();
    await renderLeads();

    announce(
      `Booking confirmed for ${lead.name} on ${prettyDate(dateISO)}. ` +
      `The date is now marked booked on the availability calendar.`
    );
    $('#leads-heading').setAttribute('tabindex', '-1');
    $('#leads-heading').focus();
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await seedDemoAvailability();
    } catch (err) {
      announce('Storage unavailable: ' + err.message);
    }
    initSimulator();
    initAvailabilityPanel();
    $('#lead-filter').addEventListener('change', renderLeads);
    $('#convert-form').addEventListener('submit', confirmConvert);
    $('#cancel-convert-btn').addEventListener('click', () => {
      $('#convert').hidden = true;
      convertingLead = null;
      announce('Conversion cancelled. The lead is unchanged.');
    });
    renderQueue();
    await renderLeads();
  });
})();
