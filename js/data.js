/* Reference data: airlines and airports. Kept local so the app never needs the network.
   Airport line format:  CODE|City shown in the app|extra names to recognise (comma separated)|country|time zone
   A leading "!" on the city means "only recognise the 3-letter code, never the city name"
   (used where the city name is also an ordinary word, e.g. Nice, Split). */
(function (root) {
  'use strict';

  var AIRLINES = {
    // Germany / Europe
    LH: 'Lufthansa', EW: 'Eurowings', DE: 'Condor', X3: 'TUI fly', '4Y': 'Discover Airlines', EN: 'Air Dolomiti',
    VL: 'Lufthansa City', CL: 'Lufthansa CityLine', FR: 'Ryanair', RK: 'Ryanair UK', U2: 'easyJet', EC: 'easyJet Europe',
    EJU: 'easyJet', W6: 'Wizz Air', W4: 'Wizz Air Malta', BA: 'British Airways', AF: 'Air France', KL: 'KLM',
    LX: 'SWISS', OS: 'Austrian', SN: 'Brussels Airlines', IB: 'Iberia', VY: 'Vueling', UX: 'Air Europa',
    TP: 'TAP Air Portugal', AZ: 'ITA Airways', SK: 'SAS', AY: 'Finnair', DY: 'Norwegian', D8: 'Norwegian',
    LO: 'LOT Polish', OK: 'Czech Airlines', RO: 'TAROM', A3: 'Aegean', OA: 'Olympic Air', TK: 'Turkish Airlines',
    PC: 'Pegasus', XQ: 'SunExpress', XC: 'Corendon', HV: 'Transavia', TO: 'Transavia France', EI: 'Aer Lingus',
    LS: 'Jet2', BY: 'TUI Airways', VS: 'Virgin Atlantic', FI: 'Icelandair', BT: 'airBaltic', JU: 'Air Serbia',
    OU: 'Croatia Airlines', LG: 'Luxair', WK: 'Edelweiss', V7: 'Volotea', KM: 'KM Malta Airlines', FB: 'Bulgaria Air',
    // India
    AI: 'Air India', IX: 'Air India Express', '6E': 'IndiGo', SG: 'SpiceJet', QP: 'Akasa Air', UK: 'Vistara',
    I5: 'AIX Connect', G8: 'Go First', '9I': 'Alliance Air', S5: 'Star Air',
    // Middle East
    EK: 'Emirates', QR: 'Qatar Airways', EY: 'Etihad', FZ: 'flydubai', G9: 'Air Arabia', WY: 'Oman Air',
    GF: 'Gulf Air', KU: 'Kuwait Airways', SV: 'Saudia', XY: 'flynas', J9: 'Jazeera Airways', RJ: 'Royal Jordanian',
    ME: 'Middle East Airlines', LY: 'El Al', MS: 'Egyptair', AT: 'Royal Air Maroc',
    // Asia / Pacific
    SQ: 'Singapore Airlines', TR: 'Scoot', TG: 'Thai Airways', MH: 'Malaysia Airlines', AK: 'AirAsia',
    CX: 'Cathay Pacific', JL: 'Japan Airlines', NH: 'ANA', KE: 'Korean Air', OZ: 'Asiana', CA: 'Air China',
    MU: 'China Eastern', CZ: 'China Southern', BR: 'EVA Air', CI: 'China Airlines', VN: 'Vietnam Airlines',
    GA: 'Garuda Indonesia', PR: 'Philippine Airlines', UL: 'SriLankan', BG: 'Biman Bangladesh', RA: 'Nepal Airlines',
    KB: 'Drukair', QF: 'Qantas', NZ: 'Air New Zealand', UZ: 'Uzbekistan Airways', KC: 'Air Astana',
    // Americas / Africa
    AA: 'American Airlines', DL: 'Delta', UA: 'United', AC: 'Air Canada', WS: 'WestJet', B6: 'JetBlue',
    AS: 'Alaska Airlines', WN: 'Southwest', AM: 'Aeromexico', LA: 'LATAM', AV: 'Avianca', CM: 'Copa Airlines',
    ET: 'Ethiopian', KQ: 'Kenya Airways', SA: 'South African Airways', WB: 'RwandAir'
  };

  // Airline codes that are also ordinary English/German words. A flight number with one of
  // these codes is only accepted when it has at least three digits ("AT 208", not "AT 5").
  var WORDY_CODES = { AT: 1, TO: 1, BY: 1, DE: 1, AS: 1, AM: 1, SO: 1, OK: 1, ME: 1, LA: 1, CA: 1, SA: 1, UK: 1, AI: 1, EN: 1, AC: 1, OS: 1, NH: 1, RO: 1 };

  var AIRPORT_LINES = [
    // Germany
    'FRA|Frankfurt|Frankfurt am Main,Frankfurt/Main,Frankfurt Main,Frankfurt Intl|DE|Europe/Berlin',
    'MUC|Munich|München,Muenchen|DE|Europe/Berlin', 'BER|Berlin|Berlin Brandenburg|DE|Europe/Berlin', 'DUS|Düsseldorf|Dusseldorf,Duesseldorf|DE|Europe/Berlin',
    'HAM|Hamburg||DE|Europe/Berlin', 'CGN|Cologne|Köln,Koeln,Köln/Bonn,Cologne Bonn,Cologne/Bonn,Köln Bonn|DE|Europe/Berlin', 'STR|Stuttgart||DE|Europe/Berlin',
    'HAJ|Hanover|Hannover|DE|Europe/Berlin', 'NUE|Nuremberg|Nürnberg,Nuernberg|DE|Europe/Berlin', 'LEJ|Leipzig|Leipzig/Halle,Leipzig Halle|DE|Europe/Berlin',
    'DRS|Dresden||DE|Europe/Berlin', 'BRE|Bremen||DE|Europe/Berlin', 'DTM|Dortmund||DE|Europe/Berlin', 'FMM|Memmingen||DE|Europe/Berlin', 'HHN|Frankfurt-Hahn|Frankfurt Hahn,Hahn|DE|Europe/Berlin',
    'FKB|Karlsruhe|Karlsruhe/Baden-Baden,Baden-Baden|DE|Europe/Berlin', 'NRN|Weeze|Düsseldorf Weeze|DE|Europe/Berlin', 'PAD|Paderborn||DE|Europe/Berlin',
    'FMO|Münster|Münster/Osnabrück,Muenster|DE|Europe/Berlin', 'SCN|Saarbrücken|Saarbruecken|DE|Europe/Berlin', 'ERF|Erfurt||DE|Europe/Berlin', 'FDH|Friedrichshafen||DE|Europe/Berlin',
    // India
    'DEL|Delhi|New Delhi,Neu-Delhi,Neu Delhi|IN|Asia/Kolkata', 'BOM|Mumbai|Bombay|IN|Asia/Kolkata', 'BLR|Bengaluru|Bangalore|IN|Asia/Kolkata', 'MAA|Chennai|Madras|IN|Asia/Kolkata',
    'HYD|Hyderabad||IN|Asia/Kolkata', 'CCU|Kolkata|Calcutta|IN|Asia/Kolkata', 'AMD|Ahmedabad||IN|Asia/Kolkata', 'PNQ|Pune||IN|Asia/Kolkata', 'GOI|Goa|Goa Dabolim,Dabolim|IN|Asia/Kolkata',
    'GOX|Goa (Mopa)|Goa Mopa,Mopa,North Goa|IN|Asia/Kolkata', 'COK|Kochi|Cochin|IN|Asia/Kolkata', 'JAI|Jaipur||IN|Asia/Kolkata', 'LKO|Lucknow||IN|Asia/Kolkata', 'PAT|Patna||IN|Asia/Kolkata',
    'IXC|Chandigarh||IN|Asia/Kolkata', 'ATQ|Amritsar||IN|Asia/Kolkata', 'SXR|Srinagar||IN|Asia/Kolkata', 'GAU|Guwahati||IN|Asia/Kolkata', 'BBI|Bhubaneswar||IN|Asia/Kolkata', 'TRV|Thiruvananthapuram|Trivandrum|IN|Asia/Kolkata',
    'IXB|Bagdogra|Siliguri|IN|Asia/Kolkata', 'VNS|Varanasi||IN|Asia/Kolkata', 'NAG|Nagpur||IN|Asia/Kolkata', 'IDR|Indore||IN|Asia/Kolkata', 'BHO|Bhopal||IN|Asia/Kolkata', 'RPR|Raipur||IN|Asia/Kolkata', 'IXR|Ranchi||IN|Asia/Kolkata',
    'VTZ|Visakhapatnam|Vizag|IN|Asia/Kolkata', 'CJB|Coimbatore||IN|Asia/Kolkata', 'IXE|Mangaluru|Mangalore|IN|Asia/Kolkata', 'IXM|Madurai||IN|Asia/Kolkata', 'TRZ|Tiruchirappalli|Trichy|IN|Asia/Kolkata',
    'UDR|Udaipur||IN|Asia/Kolkata', 'JDH|Jodhpur||IN|Asia/Kolkata', 'DED|Dehradun||IN|Asia/Kolkata', 'IXJ|Jammu||IN|Asia/Kolkata', 'IXL|Leh||IN|Asia/Kolkata', 'STV|Surat||IN|Asia/Kolkata', 'BDQ|Vadodara|Baroda|IN|Asia/Kolkata',
    'RAJ|Rajkot||IN|Asia/Kolkata', 'CCJ|Kozhikode|Calicut|IN|Asia/Kolkata', 'CNN|Kannur||IN|Asia/Kolkata', 'IXZ|Port Blair||IN|Asia/Kolkata', 'IMF|Imphal||IN|Asia/Kolkata', 'DIB|Dibrugarh||IN|Asia/Kolkata',
    'AYJ|Ayodhya||IN|Asia/Kolkata', 'GWL|Gwalior||IN|Asia/Kolkata', 'JLR|Jabalpur||IN|Asia/Kolkata', 'IXA|Agartala||IN|Asia/Kolkata', 'IXU|Aurangabad||IN|Asia/Kolkata', 'HBX|Hubli|Hubballi|IN|Asia/Kolkata',
    'NMI|Navi Mumbai||IN|Asia/Kolkata', 'DXN|Noida|Jewar|IN|Asia/Kolkata', 'GOP|Gorakhpur||IN|Asia/Kolkata', 'IXD|Prayagraj|Allahabad|IN|Asia/Kolkata', 'KNU|Kanpur||IN|Asia/Kolkata', 'AGR|Agra||IN|Asia/Kolkata',
    'TIR|Tirupati||IN|Asia/Kolkata', 'VGA|Vijayawada||IN|Asia/Kolkata', 'MYQ|Mysuru|Mysore|IN|Asia/Kolkata', 'BEK|Bareilly||IN|Asia/Kolkata', 'DBR|Darbhanga||IN|Asia/Kolkata', 'DGH|Deoghar||IN|Asia/Kolkata',
    // Europe
    'LHR|London Heathrow|Heathrow,London|GB|Europe/London', 'LGW|London Gatwick|Gatwick|GB|Europe/London', 'STN|London Stansted|Stansted|GB|Europe/London',
    'LTN|London Luton|Luton|GB|Europe/London', 'LCY|London City||GB|Europe/London', 'MAN|Manchester||GB|Europe/London', 'EDI|Edinburgh||GB|Europe/London', 'BHX|Birmingham||GB|Europe/London', 'GLA|Glasgow||GB|Europe/London',
    'BRS|Bristol||GB|Europe/London', 'DUB|Dublin||IE|Europe/Dublin', 'CDG|Paris|Paris Charles de Gaulle,Charles de Gaulle,Paris CDG|FR|Europe/Paris', 'ORY|Paris Orly|Orly|FR|Europe/Paris',
    'BVA|Paris Beauvais|Beauvais|FR|Europe/Paris', 'NCE|!Nice||FR|Europe/Paris', 'LYS|Lyon||FR|Europe/Paris', 'MRS|Marseille||FR|Europe/Paris', 'TLS|Toulouse||FR|Europe/Paris', 'BOD|Bordeaux||FR|Europe/Paris', 'NTE|Nantes||FR|Europe/Paris',
    'AMS|Amsterdam|Schiphol|NL|Europe/Amsterdam', 'EIN|Eindhoven||NL|Europe/Amsterdam', 'BRU|Brussels|Brüssel,Bruxelles|BE|Europe/Brussels', 'CRL|Brussels Charleroi|Charleroi|BE|Europe/Brussels',
    'LUX|Luxembourg|Luxemburg|LU|Europe/Luxembourg', 'ZRH|Zurich|Zürich,Zuerich|CH|Europe/Zurich', 'GVA|Geneva|Genf,Genève|CH|Europe/Zurich', 'BSL|Basel|Basel-Mulhouse|FR|Europe/Paris',
    'VIE|Vienna|Wien|AT|Europe/Vienna', 'SZG|Salzburg||AT|Europe/Vienna', 'INN|Innsbruck||AT|Europe/Vienna', 'GRZ|!Graz||AT|Europe/Vienna', 'PRG|Prague|Prag|CZ|Europe/Prague', 'BUD|Budapest||HU|Europe/Budapest',
    'WAW|Warsaw|Warschau|PL|Europe/Warsaw', 'KRK|Krakow|Kraków,Krakau|PL|Europe/Warsaw', 'GDN|Gdansk|Danzig|PL|Europe/Warsaw', 'CPH|Copenhagen|Kopenhagen|DK|Europe/Copenhagen',
    'ARN|Stockholm|Stockholm Arlanda|SE|Europe/Stockholm', 'OSL|Oslo||NO|Europe/Oslo', 'HEL|Helsinki||FI|Europe/Helsinki', 'KEF|Reykjavik|Keflavik|IS|Atlantic/Reykjavik', 'RIX|Riga||LV|Europe/Riga', 'TLL|Tallinn||EE|Europe/Tallinn',
    'VNO|Vilnius||LT|Europe/Vilnius', 'MAD|Madrid||ES|Europe/Madrid', 'BCN|Barcelona||ES|Europe/Madrid', 'AGP|Malaga|Málaga|ES|Europe/Madrid', 'PMI|Palma de Mallorca|Palma,Mallorca|ES|Europe/Madrid',
    'ALC|Alicante||ES|Europe/Madrid', 'VLC|Valencia||ES|Europe/Madrid', 'SVQ|Seville|Sevilla|ES|Europe/Madrid', 'IBZ|Ibiza||ES|Europe/Madrid', 'BIO|Bilbao||ES|Europe/Madrid', 'TFS|Tenerife South|Teneriffa Süd,Tenerife Sur|ES|Atlantic/Canary',
    'LPA|Gran Canaria|Las Palmas|ES|Atlantic/Canary', 'ACE|Lanzarote||ES|Atlantic/Canary', 'FUE|Fuerteventura||ES|Atlantic/Canary', 'LIS|Lisbon|Lissabon,Lisboa|PT|Europe/Lisbon', 'OPO|Porto||PT|Europe/Lisbon',
    'FAO|!Faro||PT|Europe/Lisbon', 'FNC|Madeira|Funchal|PT|Atlantic/Madeira', 'FCO|Rome|Rom,Roma,Rome Fiumicino,Fiumicino|IT|Europe/Rome', 'CIA|Rome Ciampino|Ciampino|IT|Europe/Rome',
    'MXP|Milan|Mailand,Milano,Milan Malpensa,Malpensa|IT|Europe/Rome', 'LIN|Milan Linate|Linate|IT|Europe/Rome', 'BGY|Milan Bergamo|Bergamo|IT|Europe/Rome',
    'VCE|Venice|Venedig,Venezia|IT|Europe/Rome', 'NAP|Naples|Neapel,Napoli|IT|Europe/Rome', 'BLQ|Bologna||IT|Europe/Rome', 'FLR|Florence|Florenz,Firenze|IT|Europe/Rome', 'PSA|Pisa||IT|Europe/Rome',
    'CTA|Catania||IT|Europe/Rome', 'PMO|Palermo||IT|Europe/Rome', 'BRI|!Bari||IT|Europe/Rome', 'ATH|Athens|Athen|GR|Europe/Athens', 'SKG|Thessaloniki||GR|Europe/Athens', 'HER|Heraklion|Iraklio|GR|Europe/Athens',
    'RHO|Rhodes|Rhodos|GR|Europe/Athens', 'CFU|Corfu|Korfu|GR|Europe/Athens', 'JTR|Santorini||GR|Europe/Athens', 'IST|Istanbul||TR|Europe/Istanbul', 'SAW|Istanbul Sabiha Gökçen|Sabiha Gokcen,Sabiha Gökcen|TR|Europe/Istanbul',
    'AYT|Antalya||TR|Europe/Istanbul', 'ADB|Izmir||TR|Europe/Istanbul', 'ESB|Ankara||TR|Europe/Istanbul', 'OTP|Bucharest|Bukarest|RO|Europe/Bucharest', 'SOF|Sofia||BG|Europe/Sofia', 'BEG|Belgrade|Belgrad|RS|Europe/Belgrade',
    'ZAG|Zagreb||HR|Europe/Zagreb', 'SPU|!Split||HR|Europe/Zagreb', 'DBV|Dubrovnik||HR|Europe/Zagreb', 'LJU|Ljubljana||SI|Europe/Ljubljana', 'MLA|Malta||MT|Europe/Malta', 'LCA|Larnaca|Larnaka|CY|Asia/Nicosia', 'TIA|Tirana||AL|Europe/Tirane',
    // Middle East / Africa
    'DXB|Dubai||AE|Asia/Dubai', 'AUH|Abu Dhabi||AE|Asia/Dubai', 'SHJ|Sharjah||AE|Asia/Dubai', 'DOH|Doha||QA|Asia/Qatar', 'BAH|Bahrain||BH|Asia/Bahrain', 'KWI|Kuwait||KW|Asia/Kuwait', 'MCT|Muscat|Maskat|OM|Asia/Muscat',
    'RUH|Riyadh|Riad|SA|Asia/Riyadh', 'JED|Jeddah|Dschidda|SA|Asia/Riyadh', 'AMM|Amman||JO|Asia/Amman', 'TLV|Tel Aviv||IL|Asia/Jerusalem', 'CAI|Cairo|Kairo|EG|Africa/Cairo', 'HRG|Hurghada||EG|Africa/Cairo',
    'CMN|Casablanca||MA|Africa/Casablanca', 'RAK|Marrakech|Marrakesch|MA|Africa/Casablanca', 'TUN|Tunis||TN|Africa/Tunis', 'ADD|Addis Ababa|Addis Abeba|ET|Africa/Addis_Ababa', 'NBO|Nairobi||KE|Africa/Nairobi',
    'JNB|Johannesburg||ZA|Africa/Johannesburg', 'CPT|Cape Town|Kapstadt|ZA|Africa/Johannesburg', 'MRU|Mauritius||MU|Indian/Mauritius', 'LOS|Lagos||NG|Africa/Lagos',
    // Asia / Pacific
    'SIN|Singapore|Singapur|SG|Asia/Singapore', 'BKK|Bangkok||TH|Asia/Bangkok', 'HKT|Phuket||TH|Asia/Bangkok', 'KUL|Kuala Lumpur||MY|Asia/Kuala_Lumpur', 'CGK|Jakarta||ID|Asia/Jakarta', 'DPS|Bali|Denpasar|ID|Asia/Makassar',
    'MNL|Manila||PH|Asia/Manila', 'SGN|Ho Chi Minh City||VN|Asia/Ho_Chi_Minh', 'HAN|Hanoi||VN|Asia/Ho_Chi_Minh', 'HKG|Hong Kong|Hongkong|HK|Asia/Hong_Kong', 'PEK|Beijing|Peking|CN|Asia/Shanghai',
    'PVG|Shanghai||CN|Asia/Shanghai', 'CAN|Guangzhou||CN|Asia/Shanghai', 'TPE|Taipei||TW|Asia/Taipei', 'ICN|Seoul||KR|Asia/Seoul', 'NRT|Tokyo Narita|Narita,Tokyo,Tokio|JP|Asia/Tokyo',
    'HND|Tokyo Haneda|Haneda|JP|Asia/Tokyo', 'KIX|Osaka||JP|Asia/Tokyo', 'CMB|Colombo||LK|Asia/Colombo', 'MLE|!Male||MV|Indian/Maldives', 'KTM|Kathmandu||NP|Asia/Kathmandu', 'DAC|Dhaka||BD|Asia/Dhaka', 'PBH|Paro||BT|Asia/Thimphu',
    'TAS|Tashkent|Taschkent|UZ|Asia/Tashkent', 'ALA|Almaty||KZ|Asia/Almaty', 'SYD|Sydney||AU|Australia/Sydney', 'MEL|Melbourne||AU|Australia/Melbourne', 'PER|Perth||AU|Australia/Perth', 'AKL|Auckland||NZ|Pacific/Auckland',
    // Americas
    'JFK|New York JFK|New York|US|America/New_York', 'EWR|Newark||US|America/New_York', 'BOS|Boston||US|America/New_York', 'IAD|Washington|Washington Dulles|US|America/New_York', 'ORD|Chicago||US|America/Chicago',
    'ATL|Atlanta||US|America/New_York', 'MIA|Miami||US|America/New_York', 'MCO|Orlando||US|America/New_York', 'DFW|Dallas||US|America/Chicago', 'IAH|Houston||US|America/Chicago', 'DEN|Denver||US|America/Denver', 'LAX|Los Angeles||US|America/Los_Angeles',
    'SFO|San Francisco||US|America/Los_Angeles', 'SEA|Seattle||US|America/Los_Angeles', 'LAS|Las Vegas||US|America/Los_Angeles', 'SAN|San Diego||US|America/Los_Angeles', 'YYZ|Toronto||CA|America/Toronto', 'YVR|Vancouver||CA|America/Vancouver',
    'YUL|Montreal|Montréal|CA|America/Toronto', 'MEX|Mexico City|Mexiko-Stadt|MX|America/Mexico_City', 'CUN|Cancun|Cancún|MX|America/Cancun', 'GRU|São Paulo|Sao Paulo|BR|America/Sao_Paulo',
    'EZE|Buenos Aires||AR|America/Argentina/Buenos_Aires', 'BOG|Bogotá|Bogota|CO|America/Bogota', 'LIM|Lima||PE|America/Lima'
  ];

  // Codes that are also ordinary upper-case words; only trusted in brackets or when the city is named too.
  var RISKY_CODES = { ADD: 1, CAN: 1, PER: 1, MAN: 1, DEN: 1, LAS: 1, SAN: 1, MRS: 1, HEL: 1, SEA: 1, LIM: 1, HAN: 1, HER: 1, PAT: 1, TUN: 1, LOS: 1 };

  var AIRPORTS = {};      // code -> city
  var AIRPORT_INFO = {};  // code -> { cc: 'DE', tz: 'Europe/Berlin' }
  var CITY_NAMES = [];    // [{ name, code }]  longest first
  AIRPORT_LINES.forEach(function (line) {
    var p = line.split('|');
    var code = p[0], city = p[1], noName = false;
    if (city.charAt(0) === '!') { city = city.slice(1); noName = true; }
    AIRPORTS[code] = city;
    if (p[3]) AIRPORT_INFO[code] = { cc: p[3], tz: p[4] };
    if (!noName) {
      CITY_NAMES.push({ name: city, code: code });
      if (p[2]) p[2].split(',').forEach(function (n) { CITY_NAMES.push({ name: n, code: code }); });
    }
  });
  CITY_NAMES.sort(function (a, b) { return b.name.length - a.name.length; });

  var api = { AIRPORT_INFO: AIRPORT_INFO, AIRLINES: AIRLINES, WORDY_CODES: WORDY_CODES, AIRPORTS: AIRPORTS, CITY_NAMES: CITY_NAMES, RISKY_CODES: RISKY_CODES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FlightData = api;
})(typeof self !== 'undefined' ? self : globalThis);
