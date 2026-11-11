/* Optional online checks. These are the ONLY places the app talks to another server,
   and only the flight number and the date are sent — never names, booking references or pictures.

   1. Live status (delays, gates): AeroDataBox through RapidAPI, with the user's own free key.
      Nothing happens until a key has been entered in Settings.
   2. Route check: adsbdb.com (no key) tells which airports a flight number normally connects.
      Off until switched on in Settings.

   Settings live in this phone's localStorage. */
(function (root) {
  'use strict';
  var KEY = 'my-flights.settings';
  var HOST = 'aerodatabox.p.rapidapi.com';

  function getSettings() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
    return { apiKey: s.apiKey || '', autoCheck: s.autoCheck !== false, routeCheck: !!s.routeCheck };
  }
  function saveSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ } }

  function cleanNumber(n) { return String(n || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function splitLocal(dt) {            // "2026-11-14 13:20+01:00" -> { d:'2026-11-14', t:'13:20' }
    var m = dt && dt.local && /(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(dt.local);
    return m ? { d: m[1], t: m[2] } : null;
  }
  function side(mv) {
    mv = mv || {};
    // Gate times first (what the airport board shows); the runway time includes taxiing and would overstate a delay.
    var now = splitLocal(mv.revisedTime) || splitLocal(mv.predictedTime) || splitLocal(mv.runwayTime);
    return {
      code: (mv.airport && mv.airport.iata) || '',
      sched: splitLocal(mv.scheduledTime), now: now, actual: !!splitLocal(mv.runwayTime),
      terminal: mv.terminal || '', gate: mv.gate || '', belt: mv.baggageBelt || '', desk: mv.checkInDesk || ''
    };
  }
  function normalise(f) {
    return {
      state: f.status || 'Unknown',
      dep: side(f.departure), arr: side(f.arrival),
      airline: (f.airline && f.airline.name) || '', number: f.number || '',
      aircraft: (f.aircraft && f.aircraft.model) || '',
      sourceUpdated: f.lastUpdatedUtc || '', checkedAt: Date.now()
    };
  }

  function fail(code, message) { var e = new Error(message); e.code = code; return e; }

  // -> normalised status, or throws an Error with a plain-language message
  function fetchStatus(ticket) {
    var s = getSettings(), num = cleanNumber(ticket.flightNumber);
    if (!s.apiKey) return Promise.reject(fail('nokey', 'Add your free key in Settings to check live status.'));
    if (!num || !ticket.date) return Promise.reject(fail('nonumber', 'This ticket needs a flight number and a date first.'));
    if (root.navigator && navigator.onLine === false) return Promise.reject(fail('offline', 'No internet connection.'));
    var url = 'https://' + HOST + '/flights/number/' + encodeURIComponent(num) + '/' + ticket.date + '?dateLocalRole=Departure';
    return fetch(url, { headers: { 'x-rapidapi-key': s.apiKey, 'x-rapidapi-host': HOST }, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' })
      .then(function (r) {
        if (r.status === 204 || r.status === 404) throw fail('nodata', 'No live data for this flight yet. Flights usually appear a few days before departure.');
        if (r.status === 401 || r.status === 403) throw fail('badkey', 'The key was not accepted. Check it in Settings.');
        if (r.status === 429) throw fail('limit', 'The free allowance of your key is used up for now.');
        if (!r.ok) throw fail('http', 'The flight service did not answer (' + r.status + '). Try again later.');
        return r.json();
      }, function () { throw fail('network', 'Could not reach the flight service.'); })
      .then(function (list) {
        if (!Array.isArray(list) || !list.length) throw fail('nodata', 'No live data for this flight yet.');
        // A flight number can have several legs in one day: take the one leaving from our airport.
        var pick = list.filter(function (f) { return ticket.from && f.departure && f.departure.airport && f.departure.airport.iata === ticket.from; })[0] || list[0];
        return normalise(pick);
      });
  }

  // Asks the service one small question to see whether the key is accepted. -> message (resolves) or Error
  function testKey() {
    var d = new Date(), iso = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    return fetchStatus({ flightNumber: 'LH400', date: iso, from: 'FRA' }).then(function () { return 'The key works.'; }, function (e) {
      if (e.code === 'nodata') return 'The key works.';       // accepted, there was just nothing to report
      throw e;
    });
  }

  // -> { from, to, airline } as normally flown, or null if unknown
  function fetchRoute(flightNumber) {
    var num = cleanNumber(flightNumber);
    if (!num) return Promise.resolve(null);
    return fetch('https://api.adsbdb.com/v0/callsign/' + encodeURIComponent(num), { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var fr = j && j.response && j.response.flightroute;
        if (!fr || !fr.origin || !fr.destination) return null;
        return { from: fr.origin.iata_code || '', to: fr.destination.iata_code || '', airline: (fr.airline && fr.airline.name) || '' };
      }).catch(function () { return null; });
  }

  var LABELS = { Expected: 'Scheduled', CheckIn: 'Check-in open', Boarding: 'Boarding', GateClosed: 'Gate closed', Departed: 'Departed',
    EnRoute: 'In the air', Approaching: 'Landing soon', Arrived: 'Landed', Canceled: 'Cancelled', CanceledUncertain: 'Possibly cancelled',
    Diverted: 'Diverted', Delayed: 'Delayed', Unknown: '' };
  function minutesBetween(a, b) {     // two { d, t } at the same airport
    if (!a || !b) return 0;
    var x = a.d.split('-'), y = b.d.split('-'), p = a.t.split(':'), q = b.t.split(':');
    return Math.round((Date.UTC(+y[0], +y[1] - 1, +y[2], +q[0], +q[1]) - Date.UTC(+x[0], +x[1] - 1, +x[2], +p[0], +p[1])) / 6e4);
  }
  // -> { text, tone: 'ok' | 'late' | 'bad' | 'info', delayMin }
  function summary(live) {
    if (!live) return null;
    var st = live.state, landed = st === 'Arrived';
    var delay = landed ? minutesBetween(live.arr.sched, live.arr.now) : minutesBetween(live.dep.sched, live.dep.now);
    if (st === 'Canceled') return { text: 'Cancelled', tone: 'bad', delayMin: 0 };
    if (st === 'CanceledUncertain' || st === 'Diverted') return { text: LABELS[st], tone: 'bad', delayMin: 0 };
    var base = LABELS[st] || '', late = delay >= 5, early = delay <= -5;
    var amount = Math.abs(delay) >= 60 ? Math.floor(Math.abs(delay) / 60) + ' h ' + (Math.abs(delay) % 60) + ' min' : Math.abs(delay) + ' min';
    if (landed) return { text: 'Landed' + (late ? ' ' + amount + ' late' : early ? ' ' + amount + ' early' : ''), tone: late ? 'late' : 'ok', delayMin: delay };
    if (late) return { text: (base && st !== 'Expected' && st !== 'Delayed' ? base + ' · ' : '') + amount + ' late', tone: 'late', delayMin: delay };
    if (st === 'Expected' || st === 'Unknown' || st === 'Delayed') return { text: early ? amount + ' early' : (live.dep.sched ? 'On time' : 'Scheduled'), tone: 'ok', delayMin: delay };
    return { text: base, tone: 'info', delayMin: delay };
  }

  root.FlightStatus = { getSettings: getSettings, saveSettings: saveSettings, fetchStatus: fetchStatus, testKey: testKey, fetchRoute: fetchRoute, summary: summary, normalise: normalise };
})(typeof self !== 'undefined' ? self : globalThis);
