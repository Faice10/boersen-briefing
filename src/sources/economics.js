// Wirtschaftstermine und Quartalszahlen ueber Financial Modeling Prep.
// Ohne FMP_API_KEY entfaellt der Abschnitt. Sperrt FMP den Endpunkt auf der
// Gratisstufe (402/403), ebenfalls: lieber kein Abschnitt als kein Briefing.

import { ECONOMIC_COUNTRIES, EARNINGS_WATCH, EARNINGS_MAX_ITEMS } from '../config.js';

const BASE = 'https://financialmodelingprep.com/stable';

class QuietSkip extends Error {}

async function fmp(path, params, key) {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('apikey', key);

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (res.status === 401 || res.status === 402 || res.status === 403) {
    throw new QuietSkip(`FMP: ${path} nicht im Gratis-Tarif (HTTP ${res.status})`);
  }
  if (!res.ok) throw new Error(`FMP: ${path} HTTP ${res.status}`);

  const data = await res.json();
  if (!Array.isArray(data)) {
    // FMP antwortet bei Limits mit { "Error Message": ... } und Status 200.
    throw new QuietSkip(`FMP: ${path} ${JSON.stringify(data).slice(0, 120)}`);
  }
  return data;
}

const HIGH = new Set(['high', 'High', 'HIGH', '3']);

export async function getCalendar(today, { log = () => {} } = {}) {
  const key = process.env.FMP_API_KEY?.trim();
  if (!key) {
    log('Termine: kein FMP_API_KEY gesetzt, Abschnitt entfaellt');
    return null;
  }

  const range = { from: today, to: today };
  const [econRes, earnRes] = await Promise.allSettled([
    fmp('economic-calendar', range, key),
    fmp('earnings-calendar', range, key),
  ]);

  const skip = [econRes, earnRes].find((r) => r.status === 'rejected' && r.reason instanceof QuietSkip);
  if (skip) log(skip.reason.message);

  const countries = new Set(ECONOMIC_COUNTRIES);
  const economic = (econRes.status === 'fulfilled' ? econRes.value : [])
    .filter((e) => countries.has(e.country) && HIGH.has(String(e.impact)))
    .map((e) => ({
      time: e.date?.slice(11, 16) ?? '',
      country: e.country,
      event: e.event,
      previous: e.previous,
      estimate: e.estimate,
    }))
    .sort((a, b) => a.time.localeCompare(b.time));

  const watch = new Set(EARNINGS_WATCH);
  const earnings = (earnRes.status === 'fulfilled' ? earnRes.value : [])
    .filter((e) => watch.has(e.symbol))
    .map((e) => e.symbol)
    .slice(0, EARNINGS_MAX_ITEMS);

  if (!economic.length && !earnings.length) return null;
  return { economic, earnings };
}
