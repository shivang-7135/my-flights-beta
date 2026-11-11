/* Time-zone helpers. A ticket shows local time at each airport; to get exact durations,
   countdowns and "+1 day" arrivals the app converts them using the airport's time zone.
   Uses the phone's built-in time-zone database (Intl) — no network. */
(function (root) {
  'use strict';
  var D = root.FlightData || (typeof require !== 'undefined' ? require('./data.js') : null);
  var cache = {};

  function parts(ms, tz) {
    var f = cache[tz] || (cache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    var o = {};
    f.formatToParts(new Date(ms)).forEach(function (p) { if (p.type !== 'literal') o[p.type] = +p.value; });
    return o;
  }
  function offset(ms, tz) {           // ms that the zone is ahead of UTC at that moment
    var p = parts(ms, tz);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
  }
  // "2026-11-14" + "13:20" at Europe/Berlin -> exact moment (ms since 1970)
  function zonedToUtc(iso, hhmm, tz) {
    var d = iso.split('-'), t = (hhmm || '00:00').split(':');
    var guess = Date.UTC(+d[0], +d[1] - 1, +d[2], +t[0], +t[1]);
    var first = guess - offset(guess, tz);
    return guess - offset(first, tz);
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function localDate(ms, tz) { var p = parts(ms, tz); return p.year + '-' + pad(p.month) + '-' + pad(p.day); }
  function addDays(iso, n) {
    var d = iso.split('-'), x = new Date(Date.UTC(+d[0], +d[1] - 1, +d[2] + n));
    return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate());
  }
  function dayDiff(a, b) {            // whole calendar days from a to b
    var x = a.split('-'), y = b.split('-');
    return Math.round((Date.UTC(+y[0], +y[1] - 1, +y[2]) - Date.UTC(+x[0], +x[1] - 1, +x[2])) / 864e5);
  }
  function zoneName(ms, tz) {         // "CET", "GMT+5:30"
    try {
      var p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short', hour: 'numeric' }).formatToParts(new Date(ms));
      for (var i = 0; i < p.length; i++) if (p[i].type === 'timeZoneName') return (/^GMT/.test(p[i].value) && SHORT[tz]) || p[i].value;
    } catch (e) { /* ignore */ }
    return '';
  }
  // Familiar short names where the phone would only say "GMT+5:30"
  var SHORT = { 'Asia/Kolkata': 'IST', 'Asia/Dubai': 'GST', 'Asia/Qatar': 'AST', 'Asia/Riyadh': 'AST', 'Asia/Singapore': 'SGT', 'Asia/Bangkok': 'ICT', 'Asia/Hong_Kong': 'HKT', 'Asia/Tokyo': 'JST', 'Asia/Kathmandu': 'NPT', 'Asia/Colombo': 'IST' };
  function tzOf(code) { var i = D.AIRPORT_INFO[code]; return i ? i.tz : ''; }
  function flag(code) {               // airport code -> flag of its country
    var i = D.AIRPORT_INFO[code];
    if (!i) return '';
    return String.fromCodePoint(0x1F1E6 + i.cc.charCodeAt(0) - 65, 0x1F1E6 + i.cc.charCodeAt(1) - 65);
  }
  function duration(min) {
    if (min == null || min < 0) return '';
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + ' h ' + (m ? pad(m) + ' min' : '') : m + ' min';
  }

  /* Exact moments for one flight.
     dep/arr: { date, time } local at the airport (arr.date may be empty: it is then worked out). */
  function exact(from, to, dep, arr) {
    var out = { depMs: null, arrMs: null, arrDate: arr.date || '', dayShift: 0, durMin: null, depZone: '', arrZone: '' };
    var tzF = tzOf(from), tzT = tzOf(to);
    if (tzF && dep.date && dep.time) {
      out.depMs = zonedToUtc(dep.date, dep.time, tzF);
      out.depZone = zoneName(out.depMs, tzF);
    }
    if (tzT && arr.time && (arr.date || out.depMs != null)) {
      var date = arr.date || localDate(out.depMs, tzT);
      var ms = zonedToUtc(date, arr.time, tzT);
      if (!arr.date) {
        var guard = 0;
        while (ms <= out.depMs && guard++ < 2) { date = addDays(date, 1); ms = zonedToUtc(date, arr.time, tzT); }
      }
      out.arrMs = ms; out.arrDate = date; out.arrZone = zoneName(ms, tzT);
    }
    if (out.arrDate && dep.date) out.dayShift = dayDiff(dep.date, out.arrDate);
    if (out.depMs != null && out.arrMs != null && out.arrMs > out.depMs) out.durMin = Math.round((out.arrMs - out.depMs) / 6e4);
    return out;
  }

  var api = { zonedToUtc: zonedToUtc, localDate: localDate, addDays: addDays, dayDiff: dayDiff, zoneName: zoneName, tzOf: tzOf, flag: flag, duration: duration, exact: exact };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FlightTime = api;
})(typeof self !== 'undefined' ? self : globalThis);
