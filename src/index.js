// Ablauf des Briefings.
//
//   node src/index.js --dry-run              Nachricht nur auf der Konsole
//   node src/index.js --send                 wirklich verschicken
//   node src/index.js --dry-run --section=dividends   nur ein Baustein
//   node src/index.js --send --force         Stundenpruefung ueberspringen
//   node src/index.js --refresh-all          kompletter Dividenden-Abgleich

import 'dotenv/config';
import { SEND_HOUR, TZ } from './config.js';
import { isoDateInTZ, hourInTZ, weekdayInTZ } from './dates.js';
import { getMarkets } from './sources/quotes.js';
import { getDividends } from './sources/dividends.js';
import { getCalendar } from './sources/economics.js';
import { getNews } from './sources/news.js';
import { buildMessage } from './format.js';
import { sendMessage } from './telegram.js';

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const value = (name) => argv.find((a) => a.startsWith(`${name}=`))?.split('=')[1];

const send = has('--send');
const force = has('--force') || has('--dry-run');
const refreshAll = has('--refresh-all');
const only = value('--section');

const log = (msg) => console.error(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
const wanted = (name) => !only || only === name;

async function section(name, fn) {
  if (!wanted(name)) return null;
  try {
    return await fn();
  } catch (err) {
    log(`Abschnitt "${name}" fehlgeschlagen: ${err.message}`);
    return null;
  }
}

// Auf stdout gehoert nur die fertige Nachricht. Abhaengigkeiten schreiben dort
// gelegentlich Diagnosen hin; die werden waehrend der Datensammlung umgeleitet.
function captureStdout() {
  const original = console.log;
  console.log = (...args) => console.error(...args);
  return () => { console.log = original; };
}

async function main() {
  const now = new Date();
  const today = isoDateInTZ(now);

  // Der Workflow startet zweimal (Sommer- und Winterzeit). Genau einer der
  // beiden Laeufe trifft die Zielstunde, der andere bricht hier ab.
  if (!force && hourInTZ(now) !== SEND_HOUR) {
    log(`Abbruch: ${hourInTZ(now)} Uhr in ${TZ}, gesendet wird um ${SEND_HOUR} Uhr`);
    return;
  }

  // Sonntags einmal alles neu einlesen, damit der Cache nicht ausduennt.
  const fullRefresh = refreshAll || weekdayInTZ(now) === 0;

  const restore = captureStdout();
  let markets, dividends, calendar, news;
  try {
    [markets, dividends, calendar, news] = await Promise.all([
      section('markets',   () => getMarkets()),
      section('dividends', () => getDividends(today, { refreshAll: fullRefresh, log })),
      section('calendar',  () => getCalendar(today, { log })),
      section('news',      () => getNews()),
    ]);
  } finally {
    restore();
  }

  if (!markets && !dividends && !news) {
    throw new Error('Alle Datenquellen ausgefallen, es gibt nichts zu senden');
  }

  const message = buildMessage({ today, markets, dividends, calendar, news });

  if (send) {
    await sendMessage(message);
    log(`Gesendet (${message.length} Zeichen)`);
  } else {
    console.log(message);
    log(`Testlauf, nichts gesendet (${message.length} Zeichen)`);
  }
}

main().catch((err) => {
  log(`Fehler: ${err.message}`);
  process.exitCode = 1;
});
