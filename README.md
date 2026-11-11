# My Flights

A small home-screen app for iPhone that keeps upcoming flight tickets in one place.
You add a screenshot of a ticket or booking email, or the PDF ticket itself; the app reads the details **on the phone**
and shows each flight as a tile (route, date, times, airline, flight number, booking reference, travellers).

- No account, no mailbox access, no sync, no analytics.
- Tickets and screenshots are stored only in the phone's own storage (IndexedDB).
- By default the app makes no network requests after the first load, and it works offline.
- Two optional online checks exist, both off until you switch them on in Settings. They send **only a flight number and date**:
  live status (AeroDataBox, with your own free key) and a route check (adsbdb.com).
  A security rule in `index.html` (Content-Security-Policy) forbids the page from contacting anything else.
- Updates never touch saved tickets; Settings also offers a backup file.

## Try it on the Mac

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory ~/Downloads/07_Projects/flight-tickets-pwa
```

Then open <http://localhost:8765>. Sample screenshots to try are in `test/samples/`.

## Put it on the iPhone

An iPhone only installs this kind of app from an `https://` address, so the **app files**
(this folder — code only, never your tickets) have to sit on a web host once.
Your tickets are never part of those files; they are created on the phone and stay there.

Options, simplest first:

1. **Netlify Drop** — open <https://app.netlify.com/drop> on the Mac, drag this folder in, get an `https://…netlify.app` address. Free account needed to keep the site.
2. **GitHub Pages** — put this folder in a GitHub repository and switch on Pages (Settings → Pages → deploy from branch). Address: `https://<user>.github.io/<repo>/`. The code is public; that is fine because it contains no personal data.
3. **Cloudflare Pages** — same idea as Netlify (upload the folder), address `https://<name>.pages.dev`.

Before uploading you can leave out `test/` and `.claude/` (not needed on the phone).

Then on the iPhone:

1. Open the address in **Safari** (not Chrome).
2. Wait about 10 seconds on the first visit so the 18 MB of app files finish saving for offline use.
3. Tap the **Share** button → **Add to Home Screen** → **Add**.
4. Open **My Flights** from the home screen and add tickets **there**.
   (Safari and the home-screen app keep separate storage, so tickets added in Safari do not show up in the installed app.)
5. Check: switch on Airplane Mode and open the app — it should start and show your tickets.

Good to know:

- Adding: tap **+**, choose *Screenshot or PDF*, and pick one or several files; each one opens a "Check details" screen in turn.
- Removing: tap the **×** on a tile. An **Undo** button appears for a few seconds.
- Deleting the app icon deletes its tickets. Keep the original screenshots in Photos as a backup.
- If the app files are ever changed, raise `VERSION` in `sw.js` so phones fetch the new files.

## How it is built

| File | What it does |
| --- | --- |
| `index.html`, `css/app.css` | Screens and iPhone layout (safe areas, light/dark) |
| `js/ocr.js` | Reads the text from a picture with Tesseract (`vendor/tesseract`, English + German) or straight from a PDF with pdf.js (`vendor/pdfjs`); a scanned PDF falls back to Tesseract |
| `js/parser.js`, `js/data.js` | Finds flights, dates, times, airports, booking reference and names in that text |
| `js/db.js` | Saves tickets and screenshots in IndexedDB |
| `js/app.js` | Tiles, review/edit form, details, full-size screenshot |
| `sw.js`, `manifest.json`, `icons/` | Installable, offline-capable app |

## Tests

```bash
node test/parser-test.js
```

Runs the reader against five made-up sample bookings (Lufthansa, Ryanair, IndiGo, Eurowings in German dark mode, Air India e-ticket).
`python3 test/make_samples.py` redraws the sample pictures.

Reading text from pictures is never perfect and real emails vary a lot, which is why every
ticket goes through an editable "Check details" screen before it is saved.

`test/samples/spicejet_itinerary.pdf` is a made-up PDF ticket for trying the PDF route.

Third-party code: [tesseract.js](https://github.com/naptha/tesseract.js) and [pdf.js](https://github.com/mozilla/pdf.js) (both Apache-2.0), licences in `vendor/`.
