# My Flights v2 — plan

Branch: `v2`. The live app (`main`) stays as it is until v2 is ready.

## Where v2 stands

Built on this branch and checked in the browser (not yet on a phone, not yet live):

- Phase 0: ticket format upgrade steps, backup file (save / restore), "new version ready" banner.
- Phase 2: Past · Now · Upcoming tabs, country flags, airport-local times with time zone, "+1" next-day arrivals, flight time, countdown.
- Phase 3: live status with the user's own AeroDataBox key (Settings), one-tap refresh, hourly check while open, old time crossed out next to the new one, terminal / gate / belt. Confirmed against the real service (free plan: 400 units a month, a status check costs 2, hard limit with no charges).
- Phase 1 (part): fields that look doubtful are marked orange, optional route check (adsbdb), "Copy what the app read" button for reporting wrong readings.

- Phase 1 (first real case): an Air India web-booking PDF with four flights was read wrongly (flights 2–4). Fixed by keeping only the values printed closest to each flight number, rebuilding PDF rows correctly, and reading "SURNAME FIRSTNAME MR" names. An anonymised copy is now a permanent test.

- Look and feel: glass theme, split-flap countdown for the next flight (flips on the exact second), plane travelling across each card, flights of one booking reference folded under one head with connection times, web check-in alert from 48 hours before departure with an optional calendar reminder.

Still open: the journey-by-journey rebuild of the reader (needs real failing tickets), barcode reading, the OCR comparison, the small-model experiment, Phase 4.

## The promise

- Free for everyone, open source, no income model.
- No account, no mailbox access, no sync. **Tickets, names and booking references never leave the phone.**
- Reading a ticket must be trustworthy: the app is either right, or it clearly says which field it is unsure about.
- An update never loses tickets that are already saved.

## What similar apps do, and the gap we can fill

| App | How flights get in | Live updates | Where it falls short for us |
| --- | --- | --- | --- |
| Flighty | Type the flight number; email forwarding, TripIt sync and push alerts are Pro only | Excellent | Paid for the useful parts (roughly $60/year), iPhone only, no reading from a screenshot or PDF |
| TripIt | Forward emails or let it scan your inbox | Paid tier | Needs inbox access and an account |
| Tripsy | Manual or email forwarding | Some | Account and forwarding again |
| Apple Wallet | Needs the issued pass | Little | Useless before the barcode exists |

The gap: **no app takes a screenshot or PDF, reads it on the phone with no account, and then shows live status for free.** That is the product.

## Three honest limits (decide these first)

1. **Live status needs to ask somebody.** A flight's delay cannot be known from the phone alone. The app would send only the *flight number and date* (never names or booking reference) to a flight-data service, and only when you tap Refresh or have switched on auto-check.
   - Free, no key, works from a browser today: `adsbdb.com` gives the **route** for a flight number (checked: LH760 → FRA–DEL). Good for checking a ticket, not for delays.
   - Real delay, gate and new-time data (AeroDataBox, FlightAware, Aviationstack) all need an API key and have small free allowances (Aviationstack: about 100 requests a month). A key cannot be hidden inside a public app.
   - So the choice is: (a) each user pastes their own free key into the app, (b) a tiny relay that holds one key and stores nothing, or (c) start with route and position data only and add delays later. Option (b) is a server, even if it keeps no data; (a) keeps "nothing on a server" literally true.
2. **An iPhone web app cannot check anything while it is closed.** No background checks and no silent notifications. "Once per hour" therefore means: on opening the app, every hour while it stays open, and whenever Refresh is tapped. Real push alerts would need a server, which is ruled out.
3. **A small AI model on the phone is risky on iPhone.** Reports from 2026: a 1B model is a ~700 MB download and Safari often reloads the page mid-answer when memory runs out. It is worth one measured experiment, not a foundation. The reliable gains come from the steps in Phase 1.

## Phase 0 — Safety net (before any new feature)

- Storage gets a version number and tested upgrade steps, so new app versions read old tickets.
- **Backup file**: export all tickets and pictures to one file, import it again (also the way to move to a new phone).
- "New version ready — tap to update" banner instead of silent updates.
- The beta uses its own storage name so testing v2 can never damage v1 tickets.
- Decide the permanent web address now. Storage belongs to the address; moving to another domain later would leave everyone's tickets behind.

## Phase 1 — Extraction people can trust

1. **Collect the failures.** A "Copy what the app read" button gives the raw text of a ticket (on the phone, user decides whether to share). Every wrong case becomes a permanent test.
2. **Rebuild the reader around journeys, not lines.** Split the ticket into one block per flight first, then read date, times and airports inside that block only. This is the cause of "wrong date, wrong journey" today: values from a neighbouring flight or from the "booked on" line leak in.
3. **Use labels and layout.** Departure/Arrival/Abflug/Ankunft labels, table columns and PDF text positions decide which time is which.
4. **Cross-check with the real schedule.** Flight number → expected route (adsbdb). If the ticket says FRA–DEL but the reader produced DEL–FRA, fix or flag it.
5. **Show confidence.** Sure fields are plain, unsure ones are highlighted with "please check", and tapping a field shows the spot on the picture it came from.
6. **Read the barcode when there is one.** Boarding-pass barcodes contain exact name, flight, date and booking reference.
7. **Better picture reader.** Test a newer on-device OCR engine against Tesseract on the collected cases; keep whichever is measurably better.
8. **Experiment:** optional small on-device model as a second opinion on capable phones. Ship only if it beats steps 2–6 on the test set and does not crash.

Target: every case in the collected test set correct or correctly flagged, measured on each change.

## Phase 2 — Friendlier screen

- Three tabs: **Past · Now · Upcoming** ("Now" = from 24 h before departure until landing, plus the last day).
- Country flag and city next to each airport code.
- Exact times: local time at each airport with its time zone, weekday, "+1 day" on overnight arrivals, flight duration, countdown ("boards in 3 h 20 min").
- Flights of one booking grouped as a trip.
- Faster adding: paste a picture, drop a file, add several at once.

## Phase 3 — Live status

- One **Refresh status** button per flight and for the whole list; "last checked 14:05".
- Auto-check hourly while the app is open, only for flights within about two days.
- Changed times shown the Flighty way: old time crossed out, new time beside it in colour (late, early, on time), plus gate/terminal when the source provides it.
- Clear wording about what is sent (flight number and date) and a switch to turn it off entirely.

## Phase 4 — Open project

- MIT licence, contribution guide, issue templates.
- Automatic tests on every change; a stable and a beta channel.
- A way for people to contribute anonymised ticket layouts, which is what makes extraction best in class over time.

## Order

Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4. Extraction comes before live status because trust is lost there first.
