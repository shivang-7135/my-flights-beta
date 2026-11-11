/* Checks the ticket reader against the text that the on-device OCR produced for the sample
   screenshots in test/samples (the *.ocr.txt files).  Run:  node test/parser-test.js */
const fs = require('fs'), path = require('path');
const { parseBest } = require('../js/parser.js');
const today = new Date(2026, 10, 10);
const F = (airline, flightNumber, from, to, date, depTime, arrTime) => ({ airline, flightNumber, from, to, date, depTime, arrTime });
const expected = {
  lufthansa_en: { pnr: '7XK4PQ', passengers: ['Arjun Sharma', 'Priya Sharma'], flights: [
    F('Lufthansa', 'LH 760', 'FRA', 'DEL', '2026-11-14', '13:20', '01:05'), F('Lufthansa', 'LH 761', 'DEL', 'FRA', '2027-01-10', '03:00', '07:35')] },
  ryanair_en: { pnr: 'K9WQ2L', passengers: ['Lena Vogel', 'Jonas Vogel', 'Mia Vogel'], flights: [
    F('Ryanair', 'FR 145', 'BER', 'STN', '2026-11-20', '06:30', '07:25')] },
  indigo_en: { pnr: 'T6HJ4M', passengers: ['Rohan Mehta', 'Ananya Mehta'], flights: [
    F('IndiGo', '6E 2134', 'DEL', 'BLR', '2026-11-28', '06:25', '09:15'), F('IndiGo', '6E 5013', 'BLR', 'DEL', '2026-12-05', '18:40', '21:35')] },
  eurowings_de_dark: { pnr: 'M3TZ8R', passengers: ['Max Mustermann', 'Erika Mustermann'], flights: [
    F('Eurowings', 'EW 754', 'CGN', 'VIE', '2026-12-17', '06:45', '08:15'), F('Eurowings', 'EW 755', 'VIE', 'CGN', '2026-12-20', '18:50', '20:25')] },
  // Real-world layout (anonymised): Air India web booking PDF, four flights, city names only,
  // multi-line table cells, fare calculation full of airport codes below the flights.
  airindia_web_4legs: { pnr: 'K4TQ7Z', passengers: ['Max Mustermann'], flights: [
    F('Air India', 'AI 2030', 'FRA', 'DEL', '2026-11-24', '20:45', '10:35'), F('Air India', 'AI 2513', 'DEL', 'BLR', '2026-11-25', '13:00', '15:50'),
    F('Air India', 'AI 2604', 'BLR', 'BOM', '2026-12-29', '09:00', '10:55'), F('Air India', 'AI 2027', 'BOM', 'FRA', '2026-12-29', '12:30', '18:30')] },
  airindia_eticket: { pnr: 'Q2WXY7', passengers: ['Arjun Sharma', 'Lakshmi Iyer'], flights: [
    F('Air India', 'AI 121', 'DEL', 'FRA', '2027-01-02', '13:15', '18:05')] }
};
let failed = 0;
for (const name of Object.keys(expected)) {
  const parts = fs.readFileSync(path.join(__dirname, 'samples', name + '.ocr.txt'), 'utf8').split('\n=====ROWS=====\n');
  const got = parseBest(parts, today);
  const slim = { pnr: got.pnr, passengers: got.passengers, flights: got.flights.map(f => F(f.airline, f.flightNumber, f.from, f.to, f.date, f.depTime, f.arrTime)) };
  const ok = JSON.stringify(slim) === JSON.stringify(expected[name]);
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name);
  if (!ok) { failed++; console.log('  expected', JSON.stringify(expected[name])); console.log('  got     ', JSON.stringify(slim)); }
}
process.exit(failed ? 1 : 0);
