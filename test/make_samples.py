"""Draws made-up booking-email screenshots (iPhone width) used to test the reader.
All names, codes and flights are invented.  Run:  python3 test/make_samples.py"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'samples')
os.makedirs(OUT, exist_ok=True)
W = 1170
HELV = '/System/Library/Fonts/Helvetica.ttc'
NEUE = '/System/Library/Fonts/HelveticaNeue.ttc'

def font(size, bold=False, face=HELV):
    return ImageFont.truetype(face, size, index=1 if bold else 0)

class Page:
    def __init__(self, h, bg='#ffffff', fg='#111111', muted='#6b7280'):
        self.im = Image.new('RGB', (W, h), bg); self.d = ImageDraw.Draw(self.im)
        self.fg, self.muted, self.y = fg, muted, 0
    def status(self, color=None):
        self.d.text((70, 40), '9:41', font=font(44, True), fill=color or self.fg)
        self.d.text((W - 230, 44), '5G  100%', font=font(36), fill=color or self.fg)
        self.y = 130
    def band(self, h, color, text, tcolor='#ffffff', size=60):
        self.d.rectangle([0, self.y, W, self.y + h], fill=color)
        self.d.text((60, self.y + (h - size) // 2 - 4), text, font=font(size, True), fill=tcolor)
        self.y += h + 40
    def t(self, text, size=40, bold=False, color=None, x=60, gap=18):
        self.d.text((x, self.y), text, font=font(size, bold), fill=color or self.fg)
        self.y += size + gap
    def at(self, x, y, text, size=40, bold=False, color=None):
        self.d.text((x, y), text, font=font(size, bold), fill=color or self.fg)
    def rule(self, color='#d1d5db'):
        self.d.line([60, self.y, W - 60, self.y], fill=color, width=3); self.y += 30
    def box(self, h, outline='#d1d5db', fill=None):
        self.d.rounded_rectangle([40, self.y, W - 40, self.y + h], radius=28, outline=outline, width=3, fill=fill)
    def save(self, name):
        self.im.crop((0, 0, W, min(self.im.height, self.y + 60))).save(os.path.join(OUT, name)); print('wrote', name)

# 1 ── Lufthansa, English, outbound + return, two passengers, two-column times
p = Page(2600); p.status()
p.band(150, '#05164d', 'Lufthansa')
p.t('Your booking confirmation', 56, True); p.y += 10
p.t('Dear Mr Sharma,', 40)
p.t('thank you for booking with Lufthansa.', 40, color=p.muted); p.y += 20
p.t('Booking code:  7XK4PQ', 46, True); p.y += 30
for head, date, route, fl, t1, c1, t2, c2 in [
    ('Outbound flight', 'Sat, 14 Nov 2026', 'Frankfurt (FRA)  →  Delhi (DEL)', 'LH 760', '13:20', 'Frankfurt FRA', '01:05 +1', 'Delhi DEL'),
    ('Return flight', 'Sun, 10 Jan 2027', 'Delhi (DEL)  →  Frankfurt (FRA)', 'LH 761', '03:00', 'Delhi DEL', '07:35', 'Frankfurt FRA')]:
    p.box(560); y0 = p.y; p.y += 36
    p.t(head + '  ·  ' + date, 40, True, x=80)
    p.t(route, 48, True, x=80)
    p.t(fl + '  ·  Operated by Lufthansa', 38, color=p.muted, x=80); p.y += 16
    p.at(80, p.y, t1, 64, True); p.at(640, p.y, t2, 64, True); p.y += 84
    p.at(80, p.y, c1, 38); p.at(640, p.y, c2, 38); p.y += 56
    p.at(80, p.y, 'Terminal 1', 34, color=p.muted); p.at(640, p.y, 'Terminal 3', 34, color=p.muted); p.y += 60
    p.t('Economy Classic  ·  Duration 07:45', 34, color=p.muted, x=80)
    p.y = y0 + 600
p.t('Passengers', 46, True)
p.t('Mr Arjun Sharma', 42); p.t('Mrs Priya Sharma', 42)
p.rule(); p.t('Baggage: 1 x 23 kg per passenger', 34, color=p.muted)
p.save('lufthansa_en.png')

# 2 ── Ryanair, English, one flight, three passengers, labelled times
p = Page(2400); p.status()
p.band(170, '#073590', 'RYANAIR', '#f1c933', 70)
p.t('Your travel itinerary', 58, True); p.y += 10
p.t('Reservation number:  K9WQ2L', 46, True); p.y += 20
p.box(620, fill='#f3f4f6'); y0 = p.y; p.y += 40
p.t('Berlin Brandenburg (BER) - London Stansted (STN)', 42, True, x=80)
p.t('Fri, 20 Nov 2026', 42, x=80)
p.t('Flight FR 145', 42, x=80); p.y += 16
p.t('Check-in closes 05:50', 36, color=p.muted, x=80)
p.t('Departs 06:30', 54, True, x=80)
p.t('Arrives 07:25', 54, True, x=80)
p.t('Total paid 86.47 EUR', 36, color=p.muted, x=80)
p.y = y0 + 670
p.t('Passengers', 46, True)
p.t('1. Lena Vogel (Adult)', 42); p.t('Seat 14A  ·  1 small bag', 34, color=p.muted)
p.t('2. Jonas Vogel (Adult)', 42); p.t('Seat 14B  ·  1 small bag', 34, color=p.muted)
p.t('3. Mia Vogel (Child)', 42); p.t('Seat 14C  ·  1 small bag', 34, color=p.muted)
p.rule(); p.t('ADD BAGS      MANAGE BOOKING', 36, True, color='#073590')
p.save('ryanair_en.png')

# 3 ── IndiGo, table rows (flight | date | from | to), two flights
p = Page(2200); p.status()
p.band(150, '#001b94', 'IndiGo')
p.t('Booking Confirmation', 56, True); p.y += 6
p.t('PNR: T6HJ4M', 50, True)
p.t('Booking Status: CONFIRMED', 38, color='#15803d'); p.y += 24
p.d.rectangle([40, p.y, W - 40, p.y + 80], fill='#e5e7eb')
for x, h in [(60, 'Flight'), (300, 'Date'), (560, 'From'), (870, 'To')]: p.at(x, p.y + 20, h, 36, True)
p.y += 110
for fl, dt, a, at_, b, bt in [('6E 2134', '28 Nov 26', 'DEL (T1)', '06:25', 'BLR (T1)', '09:15'),
                               ('6E 5013', '05 Dec 26', 'BLR (T1)', '18:40', 'DEL (T1)', '21:35')]:
    p.at(60, p.y, fl, 40, True); p.at(300, p.y, dt, 40); p.at(560, p.y, a, 40); p.at(870, p.y, b, 40); p.y += 58
    p.at(560, p.y, at_, 48, True); p.at(870, p.y, bt, 48, True); p.y += 80
    p.rule()
p.y += 10
p.t('Passenger Details', 46, True)
p.t('Mr. Rohan Mehta', 42); p.t('Adult  ·  Seat 7C  ·  15 kg', 34, color=p.muted)
p.t('Ms. Ananya Mehta', 42); p.t('Adult  ·  Seat 7D  ·  15 kg', 34, color=p.muted)
p.rule(); p.t('Please report at the airport 2 hours before departure.', 32, color=p.muted)
p.save('indigo_en.png')

# 4 ── Eurowings, German, dark mode, outbound + return
p = Page(2600, bg='#000000', fg='#f5f5f7', muted='#a1a1aa'); p.status()
p.band(150, '#8f174f', 'Eurowings')
p.t('Ihre Buchungsbestätigung', 56, True); p.y += 10
p.t('Hallo Max,', 40); p.t('vielen Dank für Ihre Buchung.', 40, color=p.muted); p.y += 20
p.t('Buchungscode: M3TZ8R', 46, True); p.y += 30
p.box(470, outline='#3f3f46'); y0 = p.y; p.y += 36
p.t('Hinflug', 40, True, x=80, color='#f0a3c8')
p.t('Do., 17. Dez. 2026', 42, x=80)
p.t('Köln/Bonn (CGN) – Wien (VIE)', 48, True, x=80)
p.t('EW 754', 40, x=80, color=p.muted)
p.t('Abflug 06:45 Uhr', 46, True, x=80); p.t('Ankunft 08:15 Uhr', 46, True, x=80)
p.y = y0 + 510
p.box(420, outline='#3f3f46'); y0 = p.y; p.y += 36
p.t('Rückflug', 40, True, x=80, color='#f0a3c8')
p.t('So., 20. Dezember 2026', 42, x=80)
p.t('Wien (VIE) – Köln/Bonn (CGN)', 48, True, x=80)
p.t('EW 755', 40, x=80, color=p.muted)
p.t('18:50 Uhr – 20:25 Uhr', 46, True, x=80)
p.y = y0 + 460
p.t('Fluggäste', 46, True)
p.t('Herr Max Mustermann', 42); p.t('Frau Erika Mustermann', 42)
p.rule('#3f3f46'); p.t('Tarif: SMART  ·  Handgepäck 8 kg', 34, color=p.muted)
p.save('eurowings_de_dark.png')

# 5 ── Air India e-ticket: SURNAME/FIRSTNAME, compact date, one long-haul flight
p = Page(2000); p.status()
p.band(150, '#b3202a', 'AIR INDIA')
p.t('E-Ticket Itinerary Receipt', 54, True); p.y += 10
p.t('Booking Reference (PNR)', 36, color=p.muted); p.t('Q2WXY7', 60, True); p.y += 10
p.t('Passenger Name', 36, color=p.muted)
p.t('SHARMA/ARJUN MR', 44, True); p.t('IYER/LAKSHMI MRS', 44, True); p.y += 20
p.rule()
p.t('Flight', 36, color=p.muted); p.t('AI 121', 50, True)
p.t('Date', 36, color=p.muted); p.t('02JAN27', 50, True); p.y += 10
p.at(60, p.y, 'Departure', 36, color=p.muted); p.at(620, p.y, 'Arrival', 36, color=p.muted); p.y += 54
p.at(60, p.y, 'DEL  13:15', 56, True); p.at(620, p.y, 'FRA  18:05', 56, True); p.y += 80
p.at(60, p.y, 'Delhi, Terminal 3', 36); p.at(620, p.y, 'Frankfurt, Terminal 2', 36); p.y += 70
p.rule(); p.t('Class: Economy (S)   Baggage: 2PC   Status: OK', 34, color=p.muted)
p.save('airindia_eticket.png')
