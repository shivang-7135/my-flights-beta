/* Turns the raw text read from a booking screenshot into structured flights.
   Pure functions, no DOM: runs in the browser and in Node (for the tests).

   parseTicketText(text, today?) -> {
     pnr: 'ABC123' | '',
     passengers: ['Max Mustermann', ...],
     flights: [{ airline, flightNumber, from, fromCity, to, toCity, date:'YYYY-MM-DD', depTime:'HH:MM', arrTime:'HH:MM' }],
     score: number   // how much was found; used to pick the better of two readings
   } */
(function (root) {
  'use strict';
  var D = root.FlightData || (typeof require !== 'undefined' ? require('./data.js') : null);

  // ---------- small helpers ----------
  function pad2(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
  function blank(n) { return new Array(n + 1).join(' '); }
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\\/-]/g, '\\$&'); }
  var LETTER = 'A-Za-zÀ-ÖØ-öø-ÿ';

  // ---------- dates ----------
  var MONTHS = {
    jan: 1, january: 1, januar: 1, 'jän': 1, 'jänner': 1,
    feb: 2, february: 2, februar: 2,
    mar: 3, march: 3, 'mär': 3, 'märz': 3, marz: 3, maerz: 3, mrz: 3,
    apr: 4, april: 4,
    may: 5, mai: 5,
    jun: 6, june: 6, juni: 6,
    jul: 7, july: 7, juli: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10, okt: 10, oktober: 10,
    nov: 11, november: 11,
    dec: 12, december: 12, dez: 12, dezember: 12
  };
  var MONTH_ALT = Object.keys(MONTHS).sort(function (a, b) { return b.length - a.length; }).join('|');

  function inferYear(month, day, today) {
    // No year printed: take the next time this day comes round (allowing for a trip that just happened).
    var y = today.getFullYear();
    var d = new Date(y, month - 1, day);
    var cutoff = new Date(today.getTime() - 60 * 864e5);
    return d < cutoff ? y + 1 : y;
  }
  function makeDate(y, m, d, today) {
    m = +m; d = +d;
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    if (y == null || y === '') y = inferYear(m, d, today);
    y = +y;
    if (y < 100) y += 2000;
    if (y < 2000 || y > 2100) return null;
    return y + '-' + pad2(m) + '-' + pad2(d);
  }

  // Each rule: regex + function(match) -> [y, m, d]
  var DATE_RULES = [
    { re: /(?<!\d)(20\d{2})-(\d{2})-(\d{2})(?!\d)/g, f: function (m) { return [m[1], m[2], m[3]]; } },
    { re: /(?<![\d.])(\d{1,2})[.\/](\d{1,2})[.\/](20\d{2}|\d{2})(?!\d)/g, f: function (m) { return [m[3], m[2], m[1]]; } },
    { re: /(?<!\d)(\d{1,2})-(\d{1,2})-(20\d{2})(?!\d)/g, f: function (m) { return [m[3], m[2], m[1]]; } },
    // 14 Nov 2026 · 14. November 2026 · 14NOV26 · 14 Nov · 14-Nov-2026
    { re: new RegExp('(?<![\\d:.])(\\d{1,2})(?:st|nd|rd|th)?[.\\s-]{0,3}(' + MONTH_ALT + ')(?![' + LETTER + '])\\.?(?:[\\s,\'’-]{0,3}(20\\d{2})(?!\\d)|[\\s\'’-]{0,2}(\\d{2})(?![\\d:.]))?', 'gi'),
      f: function (m) { return [m[3] || m[4] || null, MONTHS[m[2].toLowerCase()], m[1]]; } },
    // Nov 14, 2026 · November 14
    { re: new RegExp('(?<![' + LETTER + '])(' + MONTH_ALT + ')\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?![\\d:])(?:\\s*,?\\s*(20\\d{2})(?!\\d))?', 'gi'),
      f: function (m) { return [m[3] || null, MONTHS[m[1].toLowerCase()], m[2]]; } }
  ];

  // ---------- times ----------
  var TIME_RE = /(?<![\d:.,])([01]?\d|2[0-3])\s?([:.])\s?([0-5]\d)(?![\d]|[:.]\d)(?:\s?(a\.?m\.?|p\.?m\.?|uhr|h\b|hrs?\b))?/gi;
  var TIME_NOISE = /(boarding|check-?\s?in|gate|duration|dauer|flugzeit|flight time|closes|schlie(ß|ss)t|einsteigen|reporting|bag\s?drop|baggage|gep(ä|a)ck|layover|aufenthalt|booked on|gebucht am|sent|gesendet|issued|ausgestellt)[^|]{0,22}$/i;
  var ARR_LABEL = /(arriv\w*|ankunft|landing|landung|\ban)[\s:.-]{0,4}$/i;
  var DEP_LABEL = /(depart\w*|abflug|take-?off|\bab)[\s:.-]{0,4}$/i;

  // ---------- airports ----------
  var CODE_RE = /(?<![A-Za-z0-9])([A-Z]{3})(?![A-Za-z0-9])/g;
  var cityRe = null;
  function getCityRe() {
    if (!cityRe) {
      cityRe = new RegExp('(?<![' + LETTER + '])(' + D.CITY_NAMES.map(function (c) { return escapeRe(c.name); }).join('|') + ')(?![' + LETTER + '])', 'gi');
    }
    return cityRe;
  }
  var cityLookup = null;
  function cityToCode(name) {
    if (!cityLookup) {
      cityLookup = {};
      D.CITY_NAMES.forEach(function (c) { var k = c.name.toLowerCase(); if (!cityLookup[k]) cityLookup[k] = c.code; });
    }
    return cityLookup[name.toLowerCase()];
  }

  // ---------- flight numbers ----------
  var FLIGHT_RE = /(?<![A-Za-z0-9])([A-Z][A-Z0-9]|[0-9][A-Z])[ \t]?-?[ \t]?(\d{1,4})(?![\d]|[:.,\/]\d|[A-Za-z])/g;

  // ---------- booking reference ----------
  var PNR_KEY = /(booking\s*(reference|ref\.?|code|number|no\.?|id)|reservation\s*(number|code|no\.?)|confirmation\s*(number|code|no\.?)|record\s*locator|airline\s*pnr|\bpnr\b|buchungs\s?-?\s?(code|nummer|referenz|nr\.?)|reservierungs\s?-?\s?(nummer|code)|best(ä|a)tigungs\s?-?\s?(nummer|code)|flugbuchungsnummer|filekey)/i;
  var PNR_TOKEN = /(?<![A-Za-z0-9])(?=[A-Z0-9]*[A-Z])[A-Z0-9]{5,8}(?![A-Za-z0-9])/g;
  var PNR_STOP = { NUMBER: 1, NUMMER: 1, STATUS: 1, FLIGHT: 1, TICKET: 1, BOOKED: 1, BOOKING: 1, REFERENCE: 1, CONFIRMED: 1, DETAILS: 1, AIRLINE: 1, RESERVATION: 1, BUCHUNG: 1, FLIGHTS: 1, PASSENGER: 1, PASSENGERS: 1, TRAVEL: 1, ONLINE: 1, MANAGE: 1, DATUM: 1, REISE: 1, ITINERARY: 1 };

  // ---------- passengers ----------
  var TITLE = '(?:Mr|Mrs|Ms|Miss|Mstr|Master|Dr|Herr|Frau|MR|MRS|MS|MISS|MSTR|HERR|FRAU|DR)';
  var NAME_WORD = '[A-ZÀ-ÖØ-Þ][' + LETTER + '\'’-]+';
  var TITLE_NAME_RE = new RegExp('(?<![' + LETTER + '])' + TITLE + '\\.?\\s+(?:Dr\\.?\\s+)?(' + NAME_WORD + '(?:\\s+' + NAME_WORD + '){1,3})', 'g');
  var SLASH_NAME_RE = /(?<![A-Za-z])([A-ZÄÖÜ]{2,}(?:[ -][A-ZÄÖÜ]{2,})?)\s?\/\s?([A-ZÄÖÜ]{2,}(?:\s[A-ZÄÖÜ]{2,})*?)(?:\s+(MR|MRS|MS|MISS|MSTR|DR))?(?![A-Za-z])/g;
  var PAX_KEY = /^\W*(?:\d+\s*)?(passenger names?|passengers?|passagiere?|reisende[rn]?|flugg(?:ä|a)ste?|fluggast|travell?ers?|guests?|namen? de[rs] (?:reisenden|passagiere?)|names?)\b\s*(?:\(\s*\d+\s*\)|\d+)?\s*[:\-–]?\s*(.*)$/i;
  var GREETING = /^\W*(dear|hello|hi|hey|sehr geehrte[rs]?|hallo|guten tag|liebe[rs]?|namaste)\b/i;
  var NAME_STOP = /^(flight|flug|booking|buchung|seat|sitz|sitzplatz|baggage|bag|bags|gep(ä|a)ck|adult|adults|child|infant|erwachsene[r]?|kind|fare|tarif|economy|business|class|klasse|total|price|preis|date|datum|from|to|von|nach|departure|arrival|abflug|ankunft|terminal|status|confirmed|best(ä|a)tigt|check|online|manage|your|ihre?|trip|reise|details|ticket|number|nummer|reference|code|priority|cabin|light|basic|flex|plus|classic|saver|regular|standard|added|included|inklusive|free|kg|pnr|name|type|typ|and|und|the|der|die|das|for|with|mit|view|travel|document|e-ticket|eticket|contact|kontakt|phone|email|payment|zahlung|meal|saver|airport|flughafen|thank|thanks|danke|valid|student|only|endorsements?|check-in|operated|durchgef(ü|u)hrt|non-stop|nonstop|direct|direkt|sector|route|strecke)$/i;
  var PAX_SKIP_LINE = /(seat|sitz|bag|gep(ä|a)ck|adult|erwachsen|child|kind|infant|\bkg\b|priority|\d|^\W*$)/i;

  function titleCase(s) {
    return s.toLowerCase().replace(new RegExp('(^|[\\s\'’-])([' + LETTER + '])', 'g'), function (m, a, b) { return a + b.toUpperCase(); });
  }
  function cleanName(raw) {
    var words = raw.replace(/[.,;:()]/g, ' ').trim().split(/\s+/).filter(Boolean);
    var out = [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (new RegExp('^' + TITLE + '$', 'i').test(w)) continue;      // drop titles
      if (NAME_STOP.test(w) || /\d/.test(w) || w.length < 2) break;   // stop at the first non-name word
      if (D.AIRLINES[w] && w === w.toUpperCase() && w.length === 2) break;
      out.push(w);
      if (out.length === 4) break;
    }
    if (out.length < 2) return '';
    return titleCase(out.join(' '));
  }
  function looksLikeNameLine(line) {
    var t = line.replace(/^\W*(?:\d+\s*[.):]?\s*)?/, '').replace(/\s*\((adult|child|infant|erwachsene[r]?|kind|kleinkind)\)\s*$/i, '').trim();
    if (!new RegExp('^(?:' + TITLE + '\\.?\\s+)?' + NAME_WORD + '(?:\\s+' + NAME_WORD + '){1,3}$').test(t)) return '';
    var words = t.split(/\s+/);
    for (var i = 0; i < words.length; i++) if (NAME_STOP.test(words[i])) return '';
    return cleanName(t);
  }

  function findPassengers(lines) {
    var found = [], seen = {};
    function add(n) {
      if (!n) return;
      var k = n.toLowerCase();
      if (seen[k]) return;
      // "Mustermann Max" vs "Max Mustermann": treat same set of words as the same person
      var sorted = k.split(' ').sort().join(' ');
      if (seen['~' + sorted]) return;
      seen[k] = seen['~' + sorted] = 1;
      found.push(n);
    }
    var i, m;
    // 1) SURNAME/FIRSTNAME MR  (e-ticket style)
    for (i = 0; i < lines.length; i++) {
      SLASH_NAME_RE.lastIndex = 0;
      while ((m = SLASH_NAME_RE.exec(lines[i]))) {
        if (D.AIRPORTS[m[1]] && D.AIRPORTS[m[2]]) continue;            // FRA/DEL is a route, not a person
        if ((m[1] + ' ' + m[2]).split(/[ -]/).some(function (x) { return NAME_STOP.test(x) || D.AIRLINES[x] || D.AIRPORTS[x]; })) continue;
        var first = m[2].replace(/\s+(MR|MRS|MS|MISS|MSTR|DR)$/, '');
        add(cleanName(first + ' ' + m[1]));
      }
    }
    // 2) Lines with a title: "Mr John Smith", "Frau Erika Mustermann"
    for (i = 0; i < lines.length; i++) {
      if (GREETING.test(lines[i])) continue;
      TITLE_NAME_RE.lastIndex = 0;
      while ((m = TITLE_NAME_RE.exec(lines[i]))) add(cleanName(m[1]));
    }
    // 3) A "Passengers" heading followed by names (on the same line or the lines below)
    for (i = 0; i < lines.length; i++) {
      m = PAX_KEY.exec(lines[i]);
      if (!m) continue;
      var rest = (m[2] || '').split(/\s{3,}/)[0].trim();     // ignore a neighbouring column
      var gds = /^([A-ZÄÖÜ]{2,}(?:[ -][A-ZÄÖÜ]{2,}){1,3})\s+(MR|MRS|MS|MISS|MSTR|DR)\b/.exec(rest);
      if (gds) {                         // airline systems print the family name first
        var w = gds[1].split(' ');
        add(cleanName(w.slice(1).join(' ') + ' ' + w[0]));
        continue;
      }
      if (rest) {
        var parts = rest.split(/\s*(?:,|;|&|\/|\band\b|\bund\b|\|)\s*/i), got = false;
        parts.forEach(function (p) { var n = looksLikeNameLine(p); if (n) { add(n); got = true; } });
        if (got) continue;
        if (rest.length > 18) continue;   // a sentence that merely starts with "Passengers ..." — not a heading
      }
      var misses = 0;
      for (var j = i + 1; j < lines.length && j <= i + 12; j++) {
        var n = looksLikeNameLine(lines[j]);
        if (n) { add(n); misses = 0; continue; }
        if (PAX_SKIP_LINE.test(lines[j]) && misses < 2) { misses++; continue; }
        break;
      }
    }
    return found.slice(0, 9);
  }

  function findPnr(lines) {
    for (var i = 0; i < lines.length; i++) {
      var k = PNR_KEY.exec(lines[i]);
      if (!k) continue;
      var chunks = [lines[i].slice(k.index + k[0].length), lines[i + 1] || '', lines[i + 2] || ''];
      for (var c = 0; c < chunks.length; c++) {
        PNR_TOKEN.lastIndex = 0;
        var m, best = '';
        while ((m = PNR_TOKEN.exec(chunks[c]))) {
          if (PNR_STOP[m[0]]) continue;
          if (m[0].length === 6) { best = m[0]; break; }   // six characters is by far the usual length
          if (!best) best = m[0];
        }
        if (best) return best;
      }
    }
    return '';
  }

  // ---------- tokenising one line ----------
  function scanLine(line, li, today, tok, cityCodesNamed) {
    var m, masked = line;
    function mask(index, len) { masked = masked.slice(0, index) + blank(len) + masked.slice(index + len); }

    DATE_RULES.forEach(function (rule) {
      rule.re.lastIndex = 0;
      var src = masked;
      while ((m = rule.re.exec(src))) {
        var p = rule.f(m), iso = makeDate(p[0], p[1], p[2], today);
        if (!iso) continue;
        tok.dates.push({ line: li, col: m.index, value: iso });
        mask(m.index, m[0].length);
      }
    });

    TIME_RE.lastIndex = 0;
    var src2 = masked;
    while ((m = TIME_RE.exec(src2))) {
      var suffix = (m[4] || '').toLowerCase().replace(/\./g, '');
      if (m[2] === '.' && !suffix) continue;              // "23.50" on its own is more likely a price
      var h = +m[1], mi = m[3];
      if (suffix === 'pm' && h < 12) h += 12;
      if (suffix === 'am' && h === 12) h = 0;
      var before = src2.slice(Math.max(0, m.index - 30), m.index);
      mask(m.index, m[0].length);
      if (TIME_NOISE.test(before)) continue;
      tok.times.push({ line: li, col: m.index, value: pad2(h) + ':' + mi,
        label: ARR_LABEL.test(before) ? 'arr' : DEP_LABEL.test(before) ? 'dep' : '' });
    }

    FLIGHT_RE.lastIndex = 0;
    while ((m = FLIGHT_RE.exec(masked))) {
      var code = m[1], num = m[2];
      if (!D.AIRLINES[code]) continue;
      if (D.WORDY_CODES[code] && num.length < 3) continue;
      tok.flights.push({ line: li, col: m.index, code: code, num: num });
    }

    CODE_RE.lastIndex = 0;
    while ((m = CODE_RE.exec(masked))) {
      if (!D.AIRPORTS[m[1]]) continue;
      var inBrackets = /[(\[]\s*$/.test(masked.slice(0, m.index)) && /^\s*[)\]]/.test(masked.slice(m.index + 3));
      tok.codes.push({ line: li, col: m.index, value: m[1], explicit: true, bracket: inBrackets });
    }

    var cre = getCityRe();
    cre.lastIndex = 0;
    while ((m = cre.exec(line))) {
      if (m[1].charAt(0) !== m[1].charAt(0).toUpperCase()) continue;   // city names are capitalised
      var cc = cityToCode(m[1]);
      if (!cc) continue;
      cityCodesNamed[cc] = 1;
      tok.codes.push({ line: li, col: m.index, value: cc, explicit: false });
    }
  }

  function byPos(a, b) { return a.line - b.line || a.col - b.col; }

  // Pick date, times and airports for one flight from the lines [from, to].
  function extractWindow(tok, from, to, anchor) {
    function inWin(t) { return t.line >= from && t.line <= to; }
    /* Keep only the values printed closest to the flight number (its own row and the couple of
       lines around the nearest value). Text further away — fare calculations, "date of issue",
       "not valid before" lines, the next flight — must not leak into this flight. */
    function near(list) {
      if (anchor == null || !list.length) return list;
      var d = Infinity;
      list.forEach(function (t) { d = Math.min(d, Math.abs(t.line - anchor)); });
      return list.filter(function (t) { return Math.abs(t.line - anchor) <= d + 2; });
    }
    var seg = { date: '', depTime: '', arrTime: '', from: '', to: '' };
    var dates = near(tok.dates.filter(inWin)), times = near(tok.times.filter(inWin)), codes = near(tok.codes.filter(inWin));

    if (dates.length) seg.date = dates[0].value;

    if (times.length) {
      var dep = times.filter(function (t) { return t.label === 'dep'; })[0];
      var arr = times.filter(function (t) { return t.label === 'arr'; })[0];
      if (dep && arr) { seg.depTime = dep.value; seg.arrTime = arr.value; }
      else {
        seg.depTime = times[0].value;
        for (var i = 1; i < times.length; i++) {
          if (times[i].value !== times[0].value || times[i].line !== times[0].line) { seg.arrTime = times[i].value; break; }
        }
      }
    }

    var explicit = [], seenE = {};
    codes.forEach(function (c) { if (c.explicit && !seenE[c.value]) { seenE[c.value] = 1; explicit.push(c.value); } });
    var seq;
    if (explicit.length >= 2) seq = explicit;
    else {
      seq = []; var seenA = {};
      codes.forEach(function (c) { if (!seenA[c.value]) { seenA[c.value] = 1; seq.push(c.value); } });
    }
    seg.from = seq[0] || ''; seg.to = seq[1] || '';
    return seg;
  }
  function segScore(s) {
    return (s.date ? 1 : 0) + (s.depTime ? 1 : 0) + (s.arrTime ? 1 : 0) + (s.from ? 1 : 0) + (s.to ? 1 : 0);
  }

  function parseTicketText(text, today) {
    today = today || new Date();
    var lines = String(text || '').replace(/\r/g, '').replace(/[→➔⟶✈➜—–]/g, ' - ').replace(/ /g, ' ')
      // OCR often reads a capital I as a small L: "Al 121" is really "AI 121"
      .replace(/(?<![A-Za-z0-9])([A-Z])l(?=[ \t]?-?[ \t]?\d{2,4}(?![\d:.]))/g, '$1I')
      .split('\n').filter(function (l) { return l.trim() !== ''; });
    var tok = { dates: [], times: [], flights: [], codes: [] };
    var named = {};
    for (var i = 0; i < lines.length; i++) scanLine(lines[i], i, today, tok, named);

    // The clock in the phone's status bar ("9:41  5G 100%") is not a flight time.
    if (lines.length && lines[0].length < 30 && !/[A-Za-z]{4,}/.test(lines[0])) {
      tok.times = tok.times.filter(function (t) { return t.line !== 0; });
    }

    // Drop doubtful 3-letter "codes" (MAN, PER, ...) unless bracketed or the city is named as well.
    tok.codes = tok.codes.filter(function (c) {
      return !c.explicit || !D.RISKY_CODES[c.value] || c.bracket || named[c.value];
    });
    ['dates', 'times', 'flights', 'codes'].forEach(function (k) { tok[k].sort(byPos); });

    var anchors = tok.flights, last = lines.length - 1, segs = [];

    if (anchors.length <= 1) {
      var only = extractWindow(tok, 0, last, anchors.length ? anchors[0].line : null);
      if (anchors.length) { only.code = anchors[0].code; only.num = anchors[0].num; }
      if (anchors.length || segScore(only) >= 2) segs.push(only);
    } else {
      // Booking layouts differ: details may sit below, above or around the flight number.
      // Try several ways of cutting the text into one slice per flight and keep the best fit.
      var best = null, bestScore = -1;
      var tryCut = function (bounds) {
        var out = [], score = 0;
        for (var a = 0; a < anchors.length; a++) {
          var s = extractWindow(tok, bounds[a][0], bounds[a][1], anchors[a].line);
          s.code = anchors[a].code; s.num = anchors[a].num;
          score += segScore(s);
          out.push(s);
        }
        if (score > bestScore) { bestScore = score; best = out; }
      };
      var k, a, b;
      for (k = 0; k <= 6; k++) {              // slice starts k lines above each flight number
        b = [];
        for (a = 0; a < anchors.length; a++) {
          var start = a === 0 ? Math.max(0, anchors[a].line - k) : Math.max(anchors[a - 1].line + 1, anchors[a].line - k);
          var end = a === anchors.length - 1 ? last : Math.max(anchors[a].line, anchors[a + 1].line - k - 1);
          if (a > 0 && start <= b[a - 1][1]) start = Math.min(b[a - 1][1] + 1, anchors[a].line);
          b.push([start, end]);
        }
        tryCut(b);
      }
      b = [];                                  // slice ends at the flight number
      for (a = 0; a < anchors.length; a++) b.push([a === 0 ? 0 : anchors[a - 1].line + 1, a === anchors.length - 1 ? Math.max(anchors[a].line, Math.min(last, anchors[a].line + 1)) : anchors[a].line]);
      tryCut(b);
      segs = best;

      // A date that is missing everywhere but printed once per flight elsewhere: hand out in order.
      var undated = segs.filter(function (s) { return !s.date; });
      if (undated.length === segs.length && tok.dates.length === segs.length) {
        segs.forEach(function (s, x) { s.date = tok.dates[x].value; });
      }
    }

    // The same flight often appears twice (summary + details): merge.
    var merged = [];
    segs.forEach(function (s) {
      var key = s.code ? s.code + s.num.replace(/^0+/, '') : '';
      var twin = key && merged.filter(function (mm) {
        return mm._key === key && (!mm.date || !s.date || mm.date === s.date);
      })[0];
      if (twin) {
        var keep = segScore(s) > segScore(twin) ? s : twin, other = keep === s ? twin : s;
        ['date', 'depTime', 'arrTime', 'from', 'to'].forEach(function (f) { twin[f] = keep[f] || other[f]; });
      } else { s._key = key; merged.push(s); }
    });

    // Airline named in the text (used when no flight number carried the airline code).
    var textAirline = '';
    var lower = lines.join('\n').toLowerCase();
    Object.keys(D.AIRLINES).some(function (c) {
      var n = D.AIRLINES[c];
      if (n.length > 4 && lower.indexOf(n.toLowerCase()) !== -1) { textAirline = n; return true; }
      return false;
    });

    var flights = merged.map(function (s) {
      return {
        airline: s.code ? D.AIRLINES[s.code] : textAirline,
        flightNumber: s.code ? s.code + ' ' + s.num : '',
        from: s.from, fromCity: s.from ? D.AIRPORTS[s.from] : '',
        to: s.to, toCity: s.to ? D.AIRPORTS[s.to] : '',
        date: s.date, depTime: s.depTime, arrTime: s.arrTime
      };
    });

    var pnr = findPnr(lines), passengers = findPassengers(lines);
    var score = (pnr ? 1 : 0) + (passengers.length ? 1 : 0);
    merged.forEach(function (s) { score += segScore(s) + (s.code ? 1 : 0); });
    return { pnr: pnr, passengers: passengers, flights: flights, score: score };
  }

  /* OCR engines read multi-column layouts column by column. This rebuilds plain left-to-right
     rows from word positions, which suits table-like itineraries better.
     words: [{ text, x0, y0, x1, y1 }]   tight: true for text taken from a PDF */
  function rowsFromWords(words, tight) {
    var ws = words.filter(function (w) { return w.text && w.text.trim() && !/^[_\-\u2013\u2014=.|]+$/.test(w.text.trim()); }).slice().sort(function (a, b) { return (a.y0 + a.y1) - (b.y0 + b.y1); });
    var rows = [];
    ws.forEach(function (w) {
      var cy = (w.y0 + w.y1) / 2, h = w.y1 - w.y0, row = null;
      for (var i = rows.length - 1; i >= 0 && i >= rows.length - 4; i--) {
        if (Math.abs(rows[i].cy - cy) < (tight ? Math.min(rows[i].h, h) * 0.5 : Math.max(rows[i].h, h) * 0.45)) { row = rows[i]; break; }
      }
      if (!row) { row = { cy: cy, h: h, words: [] }; rows.push(row); }
      row.words.push(w);
      row.cy = (row.cy * (row.words.length - 1) + cy) / row.words.length;
      row.h = tight ? row.h : Math.max(row.h, h);
    });
    return rows.map(function (r) {
      r.words.sort(function (a, b) { return a.x0 - b.x0; });
      var out = '';
      r.words.forEach(function (w, i) {
        if (i) {
          var gap = w.x0 - r.words[i - 1].x1;
          // PDF text arrives in fragments that may touch ("Frank" + "furt"): join those without a space.
          out += (tight && gap < r.h * 0.08 && gap > -r.h * 0.3) ? '' : gap > r.h * 1.6 ? '   ' : ' ';
        }
        out += w.text;
      });
      return out;
    }).join('\n');
  }

  // Use whichever reading of the page explains more of the ticket.
  function parseBest(texts, today) {
    var best = null;
    texts.forEach(function (t) {
      if (!t) return;
      var r = parseTicketText(t, today);
      if (!best || r.score > best.score) best = r;
    });
    return best || parseTicketText('', today);
  }

  var api = { parseTicketText: parseTicketText, rowsFromWords: rowsFromWords, parseBest: parseBest };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TicketParser = api;
})(typeof self !== 'undefined' ? self : globalThis);
