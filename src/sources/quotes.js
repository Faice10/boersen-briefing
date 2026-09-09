// Kurse ueber Yahoos Chart-Endpunkt. Der laeuft ohne Key und ohne Crumb.

import { MARKETS } from '../config.js';

const BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

async function fetchOne(entry) {
  const url = `${BASE}/${encodeURIComponent(entry.symbol)}?range=5d&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${entry.symbol}: HTTP ${res.status}`);
  const meta = (await res.json())?.chart?.result?.[0]?.meta;
  if (!meta || meta.regularMarketPrice == null) throw new Error(`${entry.symbol}: keine Kursdaten`);

  // changePercent fehlt bei manchen Symbolen. Dann selbst rechnen.
  let changePct = meta.regularMarketChangePercent;
  if (changePct == null && meta.chartPreviousClose) {
    changePct = ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100;
  }

  return {
    ...entry,
    price: meta.regularMarketPrice,
    changePct: changePct ?? null,
    currency: meta.currency,
    marketTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000) : null,
  };
}

export async function getMarkets() {
  const results = await Promise.allSettled(MARKETS.map(fetchOne));
  const rows = [];
  const failed = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') rows.push(r.value);
    else failed.push(MARKETS[i].label);
  });
  if (rows.length === 0) throw new Error('Kein einziger Kurs abrufbar');
  return { rows, failed };
}
