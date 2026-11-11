/* Reads the text in a screenshot on the device using the bundled Tesseract engine
   (vendor/tesseract). The engine, and its English + German language files, are part of
   the app, so this works offline and the picture never leaves the phone. */
(function (root) {
  'use strict';
  var workerPromise = null, onProgress = null;

  function url(p) { return new URL(p, document.baseURI).href; }

  function getWorker() {
    if (!workerPromise) {
      workerPromise = Tesseract.createWorker(['eng', 'deu'], 1, {
        workerPath: url('vendor/tesseract/worker.min.js'),
        corePath: url('vendor/tesseract/core'),
        langPath: url('vendor/tesseract/lang'),
        gzip: true,
        workerBlobURL: false,
        cacheMethod: 'none',          // the service worker already keeps these files offline
        logger: function (m) {
          if (!onProgress) return;
          if (m.status === 'recognizing text') onProgress(0.3 + 0.7 * m.progress, 'Reading screenshot…');
          else onProgress(0.05 + 0.25 * (m.progress || 0), 'Getting the reader ready…');
        }
      }).catch(function (e) { workerPromise = null; throw e; });
    }
    return workerPromise;
  }

  function loadImage(blob) {
    return new Promise(function (resolve, reject) {
      var u = URL.createObjectURL(blob), img = new Image();
      img.onload = function () { URL.revokeObjectURL(u); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(u); reject(new Error('This file could not be opened as a picture.')); };
      img.src = u;
    });
  }

  /* Prepare the picture: small pictures are enlarged, huge ones reduced (phones limit canvas size),
     and dark-mode screenshots are inverted because the reader does best with dark text on white. */
  function prepare(img) {
    var w = img.naturalWidth, h = img.naturalHeight, scale = 1;
    if (w < 1000) scale = Math.min(2.5, 1400 / w);
    var MAX_PIXELS = 11e6;
    if (w * h * scale * scale > MAX_PIXELS) scale = Math.sqrt(MAX_PIXELS / (w * h));
    var c = document.createElement('canvas');
    c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);

    var probe = document.createElement('canvas');
    probe.width = 48; probe.height = 48;
    var pc = probe.getContext('2d', { willReadFrequently: true });
    pc.drawImage(img, 0, 0, 48, 48);
    var d = pc.getImageData(0, 0, 48, 48).data, sum = 0;
    for (var i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (sum / (d.length / 4) < 110) {
      var id = ctx.getImageData(0, 0, c.width, c.height), p = id.data;
      for (var j = 0; j < p.length; j += 4) { p[j] = 255 - p[j]; p[j + 1] = 255 - p[j + 1]; p[j + 2] = 255 - p[j + 2]; }
      ctx.putImageData(id, 0, 0);
    }
    return c;
  }

  function ocrCanvas(canvas) {
    return getWorker().then(function (w) {
      return w.recognize(canvas, {}, { text: true, blocks: true });
    }).then(function (res) {
      var words = [];
      (res.data.blocks || []).forEach(function (b) {
        (b.paragraphs || []).forEach(function (p) {
          (p.lines || []).forEach(function (l) {
            (l.words || []).forEach(function (w) {
              words.push({ text: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 });
            });
          });
        });
      });
      return [res.data.text || '', TicketParser.rowsFromWords(words)];
    });
  }

  // ---------- PDF ----------
  var pdfjsPromise = null;
  function getPdfjs() {
    if (!pdfjsPromise) {
      pdfjsPromise = import(url('vendor/pdfjs/pdf.min.js')).then(function (m) {
        m.GlobalWorkerOptions.workerSrc = url('vendor/pdfjs/pdf.worker.min.js');
        return m;
      }).catch(function (e) { pdfjsPromise = null; throw e; });
    }
    return pdfjsPromise;
  }
  function isPdf(file) { return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''); }

  /* A PDF ticket normally contains real text, which is read directly (exact, no guessing).
     The pages are also drawn into one picture that is kept as the "original" to show at the airport.
     A scanned PDF with no text falls back to reading that picture. */
  var MAX_PAGES = 5, PAGE_WIDTH = 1240;
  async function readPdf(file, progress) {
    progress(0.05, 'Opening PDF…');
    var pdfjs = await getPdfjs();
    var data = new Uint8Array(await file.arrayBuffer());
    var doc;
    try {
      doc = await pdfjs.getDocument({
        data: data, isEvalSupported: false, disableAutoFetch: true, disableRange: true, disableStream: true,
        standardFontDataUrl: url('vendor/pdfjs/standard_fonts/')
      }).promise;
    } catch (e) {
      if (e && e.name === 'PasswordException') throw new Error('This PDF is password-protected. Open it, take a screenshot and add that instead.');
      throw new Error('This PDF could not be opened.');
    }
    var n = Math.min(doc.numPages, MAX_PAGES), canvases = [], words = [], offset = 0;
    for (var p = 1; p <= n; p++) {
      progress(0.1 + 0.5 * (p - 1) / n, n > 1 ? 'Reading page ' + p + ' of ' + n + '…' : 'Reading PDF…');
      var page = await doc.getPage(p);
      var scale = PAGE_WIDTH / page.getViewport({ scale: 1 }).width;
      var vp = page.getViewport({ scale: scale });
      var c = document.createElement('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      var tc = await page.getTextContent();
      tc.items.forEach(function (it) {
        if (!it.str || !it.str.trim()) return;
        var t = pdfjs.Util.transform(vp.transform, it.transform);
        var h = Math.hypot(t[2], t[3]) || 10;
        words.push({ text: it.str, x0: t[4], x1: t[4] + it.width * scale, y0: offset + t[5] - h, y1: offset + t[5] });
      });
      canvases.push(c); offset += c.height;
    }
    var all = document.createElement('canvas');
    all.width = PAGE_WIDTH; all.height = offset;
    var actx = all.getContext('2d'), y = 0;
    actx.fillStyle = '#fff'; actx.fillRect(0, 0, all.width, all.height);
    canvases.forEach(function (c) { actx.drawImage(c, 0, y); y += c.height; });
    try { doc.destroy(); } catch (e) { /* ignore */ }

    var text = TicketParser.rowsFromWords(words, true), texts = [text];
    if (text.replace(/\s/g, '').length < 40) {
      onProgress = progress;
      texts = await ocrCanvas(all);
      onProgress = null;
    }
    progress(0.95, 'Almost done…');
    var blob = await new Promise(function (res) { all.toBlob(res, 'image/png'); });
    return { texts: texts, imageBlob: blob, pages: doc.numPages, pagesRead: n };
  }

  // -> { texts: [..readings of the same document; the parser keeps the best..], imageBlob }
  function readFile(file, progressCb) {
    var progress = progressCb || function () {};
    if (isPdf(file)) return readPdf(file, progress);
    onProgress = progress;
    progress(0.02, 'Getting the reader ready…');
    return loadImage(file).then(function (img) {
      return ocrCanvas(prepare(img));
    }).then(function (texts) {
      onProgress = null;
      return { texts: texts, imageBlob: file };
    }, function (e) { onProgress = null; throw e; });
  }

  root.TicketOCR = { readFile: readFile, isPdf: isPdf };
})(self);
