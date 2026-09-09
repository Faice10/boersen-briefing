// Dividendenkalender. Es gibt keinen kostenlosen Gesamtkalender, also fragen
// wir unser Universum aus config.js selbst ab und halten das Ergebnis in
// data/dividends-cache.json vor. Der taegliche Lauf frischt nur auf, was
// abgelaufen oder aelter als CACHE_TTL_DAYS ist.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YahooFinanceImport from 'yahoo-finance2';
import {
  DIVIDEND_UNIVERSE, CACHE_TTL_DAYS, CONCURRENCY, EX_LOOKAHEAD_DAYS, EX_FALLBACK_COUNT,
} from '../config.js';
import { toIsoDate, addDays, addBusinessDays, daysBetween } from '../dates.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE_PATH = resolve(ROOT, 'data/dividends-cache.json');

// yahoo-finance2 exportiert je nach Major-Version eine fertige Instanz (v2)
// oder eine Klasse (v3+). Beides abfangen, damit ein npm-Update nichts bricht.
// Die Bibliothek schreibt Validierungshinweise samt Abfrage-URL nach stdout.
// Ungefiltert landet das mitten in der fertigen Nachricht.
// Alle fuenf Methoden sind Pflicht, sonst wirft die Bibliothek beim Start.
const quiet = {
  info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, dir: () => {},
};
const QUIET_OPTS = {
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  validation: { logErrors: false, logOptionsErrors: false, allowAdditionalProps: true },
  logger: quiet,
  versionCheck: false,
};

const yf = typeof YahooFinanceImport === 'function'
  ? new YahooFinanceImport(QUIET_OPTS)
  : YahooFinanceImport;
yf.suppressNotices?.(['yahooSurvey', 'ripHistorical']);
// v4 nimmt die Optionen ueber den Konstruktor, v2 ueber setGlobalConfig.
yf.setGlobalConfig?.(QUIET_OPTS);

// Aendert sich das Feldschema, ist der alte Cache wertlos und wird verworfen.
const CACHE_VERSION = 2;

const MODULES = ['calendarEvents', 'summaryDetail', 'defaultKeyStatistics', 'price'];

async function loadCache() {
  const empty = { version: CACHE_VERSION, updatedAt: null, symbols: {} };
  try {
    const cache = JSON.parse(await readFile(CACHE_PATH, 'utf8'));
    if (cache.version !== CACHE_VERSION) return empty;
    return cache;
  } catch {
    return empty;
  }
}

async function saveCache(cache) {
  cache.version = CACHE_VERSION;
  cache.updatedAt = new Date().toISOString();
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

function needsRefresh(entry, today) {
  if (!entry || !entry.fetchedAt) return true;
  const ageDays = (Date.now() - Date.parse(entry.fetchedAt)) / 86400000;
  if (ageDays > CACHE_TTL_DAYS) return true;
  // Ex-Tag vorbei: der naechste Termin steht vermutlich schon bereit.
  if (entry.exDate && entry.exDate < today) return true;
  return false;
}

// Yahoo haengt an shortName gern Fuellzeichen an ("Allianz SE            v").
function cleanName(raw, symbol) {
  if (!raw) return symbol;
  const name = String(raw).replace(/\s+/g, ' ').trim().replace(/\s+[a-z]$/i, '').trim();
  return name || symbol;
}

// Zahltag liefert Yahoo nur fuer US-Titel. In Deutschland und den meisten
// Nachbarmaerkten wird am dritten Geschaeftstag nach der Hauptversammlung
// gezahlt, also zwei Geschaeftstage nach dem Ex-Tag. Das rechnen wir aus und
// kennzeichnen es in der Nachricht mit einer Tilde als Schaetzung.
function estimatePayDate(exDate) {
  return exDate ? addBusinessDays(exDate, 2) : null;
}

async function fetchSymbol(symbol) {
  const r = await yf.quoteSummary(symbol, { modules: MODULES });
  const cal = r?.calendarEvents ?? {};
  const sum = r?.summaryDetail ?? {};
  const stats = r?.defaultKeyStatistics ?? {};
  const price = r?.price ?? {};

  const exDate = toIsoDate(cal.exDividendDate ?? sum.exDividendDate);
  const reported = toIsoDate(cal.dividendDate);

  return {
    symbol,
    name: cleanName(price.shortName || price.longName, symbol),
    exDate,
    payDate: reported ?? estimatePayDate(exDate),
    payDateEstimated: !reported && Boolean(exDate),
    // dividendRate ist die Jahresdividende. Bei Quartalszahlern waere das als
    // Betrag einer einzelnen Zahlung das Vierfache des Richtigen, deshalb
    // steht lastDividendValue vorn.
    amount: stats.lastDividendValue ?? sum.dividendRate ?? null,
    annualRate: sum.dividendRate ?? null,
    yield: sum.dividendYield ?? null,
    currency: price.currency || sum.currency || null,
    fetchedAt: new Date().toISOString(),
  };
}

// Einfacher Worker-Pool, damit Yahoo nicht mit 100 parallelen Anfragen bedacht wird.
async function mapPool(items, limit, worker) {
  const out = [];
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        out.push(await worker(items[idx]));
      } catch {
        // Einzelne Titel duerfen scheitern, der Rest zaehlt.
      }
    }
  });
  await Promise.all(runners);
  return out;
}

export async function getDividends(today, { refreshAll = false, log = () => {} } = {}) {
  const cache = await loadCache();
  const todo = refreshAll
    ? DIVIDEND_UNIVERSE
    : DIVIDEND_UNIVERSE.filter((s) => needsRefresh(cache.symbols[s], today));

  if (todo.length) {
    log(`Dividenden: ${todo.length} von ${DIVIDEND_UNIVERSE.length} Titeln werden neu abgefragt`);
    const fresh = await mapPool(todo, CONCURRENCY, fetchSymbol);
    for (const entry of fresh) cache.symbols[entry.symbol] = entry;
    log(`Dividenden: ${fresh.length} Titel aktualisiert`);
    await saveCache(cache);
  } else {
    log('Dividenden: Cache aktuell, keine Abfrage noetig');
  }

  const all = Object.values(cache.symbols);
  const horizon = addDays(today, EX_LOOKAHEAD_DAYS);

  // Yahoo liefert bei dividendDate manchmal den letzten statt den naechsten
  // Zahltag. Alles vor heute fliegt raus.
  const exToday = all.filter((e) => e.exDate === today);
  const exSoon = all
    .filter((e) => e.exDate && e.exDate > today && e.exDate <= horizon)
    .sort((a, b) => a.exDate.localeCompare(b.exDate) || a.name.localeCompare(b.name));
  const payToday = all.filter((e) => e.payDate === today);

  // Ausserhalb der Fruehjahrssaison ist das Sieben-Tage-Fenster meist leer.
  // Dann lieber die naechsten Termine zeigen als einen leeren Abschnitt.
  const fallback = (exToday.length || exSoon.length) ? [] : all
    .filter((e) => e.exDate && e.exDate > horizon)
    .sort((a, b) => a.exDate.localeCompare(b.exDate))
    .slice(0, EX_FALLBACK_COUNT);

  return {
    exToday: exToday.sort((a, b) => a.name.localeCompare(b.name)),
    exSoon,
    fallback,
    payToday: payToday.sort((a, b) => a.name.localeCompare(b.name)),
    universeSize: DIVIDEND_UNIVERSE.length,
    cachedSize: all.length,
    horizonDays: EX_LOOKAHEAD_DAYS,
    daysBetween,
  };
}
