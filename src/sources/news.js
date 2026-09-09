// Schlagzeilen aus RSS. Kostenlos, kein Key, und die beiden Feeds antworten
// zuverlaessig. Weitere Quellen kommen in config.js dazu.

import Parser from 'rss-parser';
import { FEEDS, NEWS_BLOCKLIST, NEWS_MAX_ITEMS, NEWS_MAX_AGE_HOURS } from '../config.js';

const parser = new Parser({
  timeout: 12000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; boersen-briefing/1.0)' },
});

export async function getNews() {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return (parsed.items ?? []).map((item) => ({
        title: (item.title ?? '').trim(),
        link: item.link,
        source: feed.source,
        date: item.isoDate ? Date.parse(item.isoDate) : Date.parse(item.pubDate ?? '') || 0,
      }));
    }),
  );

  const cutoff = Date.now() - NEWS_MAX_AGE_HOURS * 3600000;
  const seen = new Set();
  const items = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .filter((i) => i.title && i.date >= cutoff)
    .filter((i) => {
      const hay = `${i.link ?? ''} ${i.title}`.toLowerCase();
      return !NEWS_BLOCKLIST.some((bad) => hay.includes(bad));
    })
    .filter((i) => {
      const k = i.title.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.date - a.date)
    .slice(0, NEWS_MAX_ITEMS);

  if (!items.length) throw new Error('Keine aktuellen Schlagzeilen');
  return items;
}
