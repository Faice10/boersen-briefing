// Zentrale Stellschrauben. Wer etwas am Briefing aendern will, aendert es hier.

export const TZ = 'Europe/Berlin';

// Stunde (Berliner Zeit), ab der das Briefing rausgehen darf.
export const SEND_HOUR = 5;

// GitHub haelt Cron-Zeiten nicht genau ein; Verzoegerungen von einer halben
// Stunde und mehr kommen vor. Deshalb ein Fenster statt einer festen Stunde:
// gesendet wird zwischen SEND_HOUR und SEND_HOUR + dieser Spanne. Dass daraus
// nicht mehrere Nachrichten werden, verhindert die Tagessperre in state.json.
export const SEND_WINDOW_HOURS = 5;

// Abschnitt MAERKTE. Reihenfolge = Reihenfolge in der Nachricht.
export const MARKETS = [
  { symbol: '^GDAXI',    label: 'DAX',        digits: 0 },
  { symbol: '^MDAXI',     label: 'MDAX',       digits: 0 },
  { symbol: '^STOXX50E',  label: 'Euro Stoxx', digits: 0 },
  { symbol: '^GSPC',      label: 'S&P 500',    digits: 0 },
  { symbol: '^IXIC',      label: 'Nasdaq',     digits: 0 },
  { symbol: '^N225',      label: 'Nikkei',     digits: 0 },
  { symbol: '^TNX',       label: 'US-Zins 10J', digits: 2, suffix: ' %' },
  { symbol: 'GC=F',       label: 'Gold',       digits: 0, suffix: ' $' },
  { symbol: 'BZ=F',       label: 'Brent',      digits: 2, suffix: ' $' },
  { symbol: 'EURUSD=X',   label: 'EUR/USD',    digits: 4 },
  { symbol: 'BTC-USD',    label: 'Bitcoin',    digits: 0, suffix: ' $' },
];

// Universum fuer den Dividendenkalender.
// Ein allgemeiner Kalender ist ohne Bezahlquelle nicht zu haben, deshalb
// fragen wir diese Liste selbst ab. Eigene Werte einfach ergaenzen.
export const DAX40 = [
  'ADS.DE','AIR.DE','ALV.DE','BAS.DE','BAYN.DE','BEI.DE','BMW.DE','BNR.DE',
  'CBK.DE','CON.DE','1COV.DE','DTG.DE','DBK.DE','DB1.DE','DHL.DE','DTE.DE',
  'EOAN.DE','FRE.DE','HNR1.DE','HEI.DE','HEN3.DE','IFX.DE','MBG.DE','MRK.DE',
  'MTX.DE','MUV2.DE','P911.DE','PAH3.DE','QIA.DE','RHM.DE','RWE.DE','SAP.DE',
  'SRT3.DE','SIE.DE','ENR.DE','SHL.DE','SY1.DE','VOW3.DE','VNA.DE','ZAL.DE',
];

export const EURO_STOXX = [
  'ASML.AS','MC.PA','OR.PA','TTE.PA','SAN.PA','AI.PA','SU.PA','BNP.PA',
  'CS.PA','RMS.PA','EL.PA','SAF.PA','DG.PA','BN.PA','KER.PA','ENGI.PA',
  'ISP.MI','ENI.MI','ENEL.MI','UCG.MI','G.MI','STLAM.MI',
  'SAN.MC','IBE.MC','ITX.MC','BBVA.MC','TEF.MC',
  'INGA.AS','ADYEN.AS','PRX.AS','AD.AS','WKL.AS','PHIA.AS',
  'ABI.BR','KBC.BR','NOKIA.HE','NDA-FI.HE','FLTR.L',
];

export const DOW30 = [
  'AAPL','AMGN','AXP','BA','CAT','CRM','CSCO','CVX','DIS','DOW',
  'GS','HD','HON','IBM','INTC','JNJ','JPM','KO','MCD','MMM',
  'MRK','MSFT','NKE','PG','SHW','TRV','UNH','V','VZ','WMT',
];

export const DIVIDEND_UNIVERSE = [...new Set([...DAX40, ...EURO_STOXX, ...DOW30])];

// Wie weit voraus zeigen wir Ex-Tage an?
export const EX_LOOKAHEAD_DAYS = 7;

// Faellt in dieses Fenster nichts (im Sommer die Regel, weil deutsche
// Dividenden im Fruehjahr geballt kommen), zeigen wir ersatzweise die
// naechsten anstehenden Termine.
export const EX_FALLBACK_COUNT = 3;

// Cache-Eintraege gelten so lange als frisch.
export const CACHE_TTL_DAYS = 7;

// Gleichzeitige Yahoo-Abfragen. Hoeher = schneller, aber Sperrgefahr.
export const CONCURRENCY = 5;

// Abschnitt SCHLAGZEILEN
export const FEEDS = [
  { url: 'https://www.tagesschau.de/wirtschaft/index~rss2.xml', source: 'tagesschau' },
  { url: 'https://www.faz.net/rss/aktuell/finanzen/',           source: 'FAZ' },
  { url: 'https://finance.yahoo.com/rss/topstories',            source: 'Yahoo Finance' },
];

// Ratgeber- und Lifestyle-Strecken, die in denselben Feeds mitlaufen.
export const NEWS_BLOCKLIST = [
  '/personal-finance/', '/lifestyle/', '/entertainment/', '/sports/',
  'horoskop', 'gewinnspiel',
];
export const NEWS_MAX_ITEMS = 4;
export const NEWS_MAX_AGE_HOURS = 24;

// Abschnitt TERMINE (nur mit FMP_API_KEY)
export const ECONOMIC_COUNTRIES = ['DE', 'EU', 'US'];
export const EARNINGS_WATCH = DIVIDEND_UNIVERSE;
export const EARNINGS_MAX_ITEMS = 6;
