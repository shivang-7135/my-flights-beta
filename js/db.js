/* Storage on the device (IndexedDB). Two tables:
     tickets — one record per flight
     images  — the original screenshots ({ id, type, data:ArrayBuffer }); one screenshot can belong to several flights */
(function (root) {
  'use strict';
  // The beta address keeps its own tickets, so trying a beta can never touch the tickets of the main app.
  var NAME = /beta/i.test(location.pathname) ? 'my-flights-beta' : 'my-flights', VERSION = 1, dbp = null;

  function open() {
    if (!dbp) {
      dbp = new Promise(function (resolve, reject) {
        var req = indexedDB.open(NAME, VERSION);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains('tickets')) db.createObjectStore('tickets', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'id' });
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { dbp = null; reject(req.error); };
      });
    }
    return dbp;
  }
  function run(stores, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(stores, mode), out;
        tx.oncomplete = function () { resolve(out); };
        tx.onerror = tx.onabort = function () { reject(tx.error); };
        out = fn(tx);
      });
    });
  }
  function reqValue(req) {
    var box = {};
    req.onsuccess = function () { box.value = req.result; };
    return box;
  }
  function newId() {
    return (root.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function toBase64(buf) {
    var bytes = new Uint8Array(buf), out = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) out += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(out);
  }
  function fromBase64(b64) {
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  /* Tickets saved by an older version of the app are brought up to the current shape when read.
     Add a step here whenever the shape of a ticket changes — never rename or delete the database. */
  var SCHEMA = 2;
  function upgrade(t) {
    if (!t.schema) {                    // v1 -> v2: live status and schema marker
      t.passengers = Array.isArray(t.passengers) ? t.passengers : [];
      t.live = t.live || null;
      t.schema = 2;
    }
    return t;
  }

  var api = {
    SCHEMA: SCHEMA,
    newId: newId,
    allTickets: function () {
      return run(['tickets'], 'readonly', function (tx) { return reqValue(tx.objectStore('tickets').getAll()); })
        .then(function (b) { return (b.value || []).map(upgrade); });
    },
    // Save several flights and (optionally) their shared screenshot in one go.
    saveTickets: function (tickets, image) {
      return run(['tickets', 'images'], 'readwrite', function (tx) {
        if (image) tx.objectStore('images').put(image);
        tickets.forEach(function (t) { tx.objectStore('tickets').put(t); });
      });
    },
    // Delete a flight; the screenshot goes too once no other flight uses it.
    deleteTicket: function (id) {
      return run(['tickets', 'images'], 'readwrite', function (tx) {
        var ts = tx.objectStore('tickets');
        var get = ts.get(id);
        get.onsuccess = function () {
          var t = get.result;
          ts.delete(id);
          if (!t || !t.imageId) return;
          var all = ts.getAll();
          all.onsuccess = function () {
            var stillUsed = all.result.some(function (o) { return o.id !== id && o.imageId === t.imageId; });
            if (!stillUsed) tx.objectStore('images').delete(t.imageId);
          };
        };
      });
    },
    /* Backup: everything in one plain object (pictures as base64 text) and back again.
       Importing adds or replaces by id, so importing the same file twice is harmless. */
    exportAll: function () {
      return run(['tickets', 'images'], 'readonly', function (tx) {
        return { t: reqValue(tx.objectStore('tickets').getAll()), i: reqValue(tx.objectStore('images').getAll()) };
      }).then(function (b) {
        return {
          app: 'my-flights', format: 1, exportedAt: new Date().toISOString(),
          tickets: b.t.value || [],
          images: (b.i.value || []).map(function (im) { return { id: im.id, type: im.type, base64: toBase64(im.data) }; })
        };
      });
    },
    importAll: function (data) {
      if (!data || data.app !== 'my-flights' || !Array.isArray(data.tickets)) return Promise.reject(new Error('This is not a My Flights backup file.'));
      var images = (data.images || []).map(function (im) { return { id: im.id, type: im.type, data: fromBase64(im.base64) }; });
      return run(['tickets', 'images'], 'readwrite', function (tx) {
        images.forEach(function (im) { tx.objectStore('images').put(im); });
        data.tickets.forEach(function (t) { if (t && t.id) tx.objectStore('tickets').put(t); });
      }).then(function () { return data.tickets.length; });
    },
    getImage: function (id) {
      if (!id) return Promise.resolve(null);
      return run(['images'], 'readonly', function (tx) { return reqValue(tx.objectStore('images').get(id)); })
        .then(function (b) { return b.value || null; });
    }
  };
  root.TicketDB = api;
})(self);
