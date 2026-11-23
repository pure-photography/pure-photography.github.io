/* Easy Photo — Calendar (v1)
 *
 * Month grid from the availability store + sessions. Select a day to set
 * availability (free/booked/blocked). Export/import .ics for Google, Apple,
 * and Outlook calendars. The calendar itself stays on this device.
 */
(function () {
  'use strict';

  var body = document.getElementById('cal-body');
  var monthTitle = document.getElementById('month-title');
  var dayPanel = document.getElementById('day-panel');
  var dayHeading = document.getElementById('day-heading');
  var daySessions = document.getElementById('day-sessions');
  var dayForm = document.getElementById('day-form');
  var noteInput = document.getElementById('av-note');
  var icsStatus = document.getElementById('ics-status');

  var view = new Date();
  view.setDate(1);
  var selectedISO = null;

  function pad(n) { return String(n).padStart(2, '0'); }
  function isoOf(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function todayISO() {
    var d = new Date();
    return isoOf(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function announce(msg, priority) {
    EasyPhoto.a11y.announce(msg, priority);
  }

  function render() {
    var y = view.getFullYear();
    var m = view.getMonth();
    monthTitle.textContent = view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    var firstDow = new Date(y, m, 1).getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    body.innerHTML = '';
    var row = document.createElement('tr');
    var cell;
    var i;
    for (i = 0; i < firstDow; i++) {
      cell = document.createElement('td');
      row.appendChild(cell);
    }
    var today = todayISO();
    Promise.all([
      window.db.availability.all(),
      window.db.sessions.all()
    ]).then(function (results) {
      var avail = {};
      results[0].forEach(function (a) { avail[a.date] = a; });
      var sessionsByDate = {};
      results[1].forEach(function (s) {
        if (!s.date) return;
        (sessionsByDate[s.date] = sessionsByDate[s.date] || []).push(s);
      });
      for (var d = 1; d <= daysInMonth; d++) {
        if ((firstDow + d - 1) % 7 === 0 && d !== 1) {
          body.appendChild(row);
          row = document.createElement('tr');
        }
        var iso = isoOf(y, m, d);
        cell = document.createElement('td');
        var a = avail[iso];
        var sess = sessionsByDate[iso] || [];
        var status = a ? a.status : (sess.length ? 'booked' : 'free');
        cell.setAttribute('data-status', status);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = String(d);
        btn.setAttribute('data-day', iso);
        var label = new Date(y, m, d).toLocaleDateString('en-US',
          { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        label += status === 'free' ? ', free' : ', ' + status;
        if (sess.length) label += ', ' + sess.length + (sess.length === 1 ? ' session' : ' sessions');
        if (iso === today) label += ', today';
        btn.setAttribute('aria-label', label);
        cell.appendChild(btn);
        if (iso === today) {
          var todayMark = document.createElement('span');
          todayMark.className = 'cal-note';
          todayMark.textContent = 'Today';
          cell.appendChild(todayMark);
        }
        sess.slice(0, 2).forEach(function (s) {
          var note = document.createElement('span');
          note.className = 'cal-note';
          note.textContent = (s.type || 'Session') + ' — ' + (s.status || '');
          cell.appendChild(note);
        });
        row.appendChild(cell);
      }
      while (row.children.length < 7) {
        row.appendChild(document.createElement('td'));
      }
      body.appendChild(row);
    });
  }

  body.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-day]');
    if (!btn) return;
    openDay(btn.getAttribute('data-day'));
  });

  function openDay(iso) {
    selectedISO = iso;
    var date = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso);
    dayHeading.textContent = date.toLocaleDateString('en-US',
      { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    dayPanel.hidden = false;
    dayHeading.focus();
    Promise.all([
      window.db.sessions.query('byDate', iso),
      window.db.availability.get(iso)
    ]).then(function (results) {
      var sessions = results[0];
      var avail = results[1];
      if (!sessions.length) {
        daySessions.innerHTML = '<p>No sessions on this day.</p>';
      } else {
        daySessions.innerHTML = '<h3>Sessions</h3><ul>' + sessions.map(function (s) {
          return '<li>' + escapeHtml(s.type || 'Session') + ' — ' +
            escapeHtml(s.status || '') +
            (s.time ? ' at ' + escapeHtml(s.time) : '') +
            (s.location ? ', ' + escapeHtml(s.location) : '') + '</li>';
        }).join('') + '</ul>';
      }
      var status = avail ? avail.status : (sessions.length ? 'booked' : 'free');
      var radio = dayForm.querySelector('input[name="availability"][value="' + status + '"]');
      if (radio) radio.checked = true;
      noteInput.value = avail ? (avail.note || '') : '';
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  dayForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!selectedISO) return;
    var status = dayForm.querySelector('input[name="availability"]:checked');
    window.db.availability.set(selectedISO, status ? status.value : 'free', noteInput.value.trim())
      .then(function () {
        announce('Availability saved for ' + selectedISO + '.');
        render();
      });
  });

  document.getElementById('av-clear-btn').addEventListener('click', function () {
    if (!selectedISO) return;
    window.db.availability.remove(selectedISO).then(function () {
      noteInput.value = '';
      announce('Availability cleared for ' + selectedISO + '.');
      render();
    });
  });

  document.getElementById('prev-month').addEventListener('click', function () {
    view.setMonth(view.getMonth() - 1);
    render();
  });
  document.getElementById('next-month').addEventListener('click', function () {
    view.setMonth(view.getMonth() + 1);
    render();
  });
  document.getElementById('today-btn').addEventListener('click', function () {
    view = new Date();
    view.setDate(1);
    render();
  });

  /* .ics export: sessions + blocked/booked days as events. */
  document.getElementById('export-ics-btn').addEventListener('click', function () {
    Promise.all([window.db.sessions.all(), window.db.availability.all()])
      .then(function (results) {
        var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Easy Photo//EN'];
        results[0].forEach(function (s) {
          if (!s.date) return;
          var dt = s.date.replace(/-/g, '');
          lines.push('BEGIN:VEVENT', 'UID:session-' + s.id + '@easyphoto',
            'DTSTAMP:' + dt + 'T120000Z', 'DTSTART:' + dt,
            'SUMMARY:' + icsText((s.type || 'Photo session') + ' (' + (s.status || '') + ')'),
            'END:VEVENT');
        });
        results[1].forEach(function (a) {
          if (a.status === 'free') return;
          var dt = a.date.replace(/-/g, '');
          lines.push('BEGIN:VEVENT', 'UID:avail-' + a.date + '@easyphoto',
            'DTSTAMP:' + dt + 'T120000Z', 'DTSTART:' + dt,
            'SUMMARY:' + (a.status === 'blocked' ? 'Blocked — not available' : 'Booked'),
            'END:VEVENT');
        });
        lines.push('END:VCALENDAR');
        var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
        var url = URL.createObjectURL(blob);
        var aEl = document.createElement('a');
        aEl.href = url;
        aEl.download = 'easy-photo-calendar.ics';
        document.body.appendChild(aEl);
        aEl.click();
        aEl.remove();
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
        announce('Calendar file downloaded.');
      });
  });

  function icsText(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;')
      .replace(/,/g, '\\,').replace(/\n/g, '\\n');
  }

  /* .ics import: read DTSTART dates, mark those days booked. */
  document.getElementById('import-ics').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result || '');
      var dates = {};
      text.split(/\r?\n/).forEach(function (line) {
        var m = line.match(/^DTSTART[^:]*:(\d{4})(\d{2})(\d{2})/);
        if (m) dates[m[1] + '-' + m[2] + '-' + m[3]] = true;
      });
      var list = Object.keys(dates);
      if (!list.length) {
        icsStatus.textContent = 'No event dates found in that file.';
        return;
      }
      Promise.all(list.map(function (d) {
        return window.db.availability.get(d).then(function (existing) {
          if (existing) return null;
          return window.db.availability.set(d, 'booked', 'Imported from calendar file');
        });
      })).then(function () {
        icsStatus.textContent = list.length + (list.length === 1 ? ' day' : ' days') +
          ' marked booked from your calendar file.';
        announce(icsStatus.textContent);
        render();
      });
    };
    reader.readAsText(file);
  });

  EasyPhoto.a11y.initA11y();
  render();
})();
