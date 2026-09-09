// Baut die Telegram-Nachricht (parse_mode: HTML).
// Einspaltig statt tabellarisch, weil Handys Tabellen umbrechen.

import { longDE, shortDE } from './dates.js';

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function num(value, digits = 2) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(value);
}

function pct(value) {
  if (value == null) return '';
  const sign = value > 0 ? '+' : value < 0 ? '\u2212' : '\u00b1';
  const arrow = value > 0 ? '\u25b2' : value < 0 ? '\u25bc' : '\u25ac';
  return `${arrow} ${sign}${num(Math.abs(value), 2)} %`;
}

function money(amount, currency) {
  if (amount == null) return null;
  const sym = { EUR: '\u20ac', USD: '$', GBP: '\u00a3', CHF: 'CHF' }[currency] ?? currency ?? '';
  return `${num(amount, 2)}\u00a0${sym}`.trim();
}

function marketsSection(markets) {
  const lines = markets.rows.map((r) => {
    const value = `${num(r.price, r.digits ?? 2)}${r.suffix ?? ''}`;
    return `${esc(r.label)}  <b>${esc(value)}</b>  ${pct(r.changePct)}`;
  });
  if (markets.failed.length) {
    lines.push(`<i>ohne Daten: ${esc(markets.failed.join(', '))}</i>`);
  }
  return lines;
}

function dividendLine(entry, { withExDate = false, withPayDate = true } = {}) {
  const parts = [`• <b>${esc(entry.name)}</b>`];

  const amount = money(entry.amount, entry.currency);
  if (amount) parts.push(esc(amount));
  if (entry.yield) parts.push(esc(`${num(entry.yield * 100, 1)} %`));
  if (withExDate && entry.exDate) parts.push(`Ex ${shortDE(entry.exDate)}`);

  let line = parts.join(' · ');
  if (withPayDate && entry.payDate) {
    const mark = entry.payDateEstimated ? '~' : '';
    line += `
  <i>Zahltag ${mark}${shortDE(entry.payDate)}</i>`;
  }
  return line;
}

function dividendsSection(div) {
  const out = [];
  let estimated = false;
  const note = (list) => { if (list.some((e) => e.payDateEstimated && e.payDate)) estimated = true; };

  if (div.exToday.length) {
    note(div.exToday);
    out.push('<u>Ex-Tag heute</u>');
    out.push(...div.exToday.map((e) => dividendLine(e)));
  }

  if (div.exSoon.length) {
    note(div.exSoon);
    if (out.length) out.push('');
    out.push(`<u>Ex-Tag in den nächsten ${div.horizonDays} Tagen</u>`);
    out.push(...div.exSoon.map((e) => dividendLine(e, { withExDate: true })));
  }

  if (div.fallback?.length) {
    note(div.fallback);
    out.push(`<u>Nächste Ex-Tage</u>`);
    out.push(...div.fallback.map((e) => dividendLine(e, { withExDate: true })));
  }

  if (div.payToday.length) {
    if (out.length) out.push('');
    out.push('<u>Zahltag heute</u>');
    out.push(...div.payToday.map((e) => dividendLine(e, { withPayDate: false })));
  }

  if (!out.length) out.push('<i>Keine Termine im Universum.</i>');
  if (estimated) {
    out.push('');
    out.push('<i>~ Zahltag geschätzt: zweiter Geschäftstag nach dem Ex-Tag.</i>');
  }
  return out;
}

function calendarSection(cal) {
  const out = [];
  for (const e of cal.economic) {
    const extra = e.estimate != null ? ` \u00b7 erwartet ${esc(e.estimate)}` : '';
    out.push(`${esc(e.time)}  ${esc(e.country)} \u2013 ${esc(e.event)}${extra}`);
  }
  if (cal.earnings.length) {
    if (out.length) out.push('');
    out.push(`Zahlen: ${esc(cal.earnings.join(', '))}`);
  }
  return out;
}

function newsSection(items) {
  return items.map((i) => {
    const title = esc(i.title);
    const body = i.link ? `<a href="${esc(i.link)}">${title}</a>` : title;
    return `\u2022 ${body}\n  <i>${esc(i.source)}</i>`;
  });
}

function block(title, lines) {
  return [`<b>${title}</b>`, ...lines].join('\n');
}

const FAILED = '<i>Daten nicht verfügbar.</i>';

export function buildMessage({ today, markets, dividends, calendar, news }) {
  const blocks = [`\uD83D\uDCCA <b>B\u00f6rsen-Briefing</b>\n${esc(longDE(today))}`];

  blocks.push(block('\uD83D\uDCC8 M\u00c4RKTE', markets ? marketsSection(markets) : [FAILED]));
  blocks.push(block('\uD83D\uDCB0 DIVIDENDEN', dividends ? dividendsSection(dividends) : [FAILED]));

  // Abschnitt TERMINE nur, wenn es wirklich etwas zu zeigen gibt.
  if (calendar) blocks.push(block('\uD83D\uDCC5 TERMINE', calendarSection(calendar)));

  blocks.push(block('\uD83D\uDCF0 SCHLAGZEILEN', news ? newsSection(news) : [FAILED]));

  return blocks.join('\n\n');
}
