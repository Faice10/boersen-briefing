// Datumshilfen. Alles, was mit Zeitzonen zu tun hat, laeuft ueber diese Datei,
// damit der Sommerzeit-Aerger an genau einer Stelle sitzt.

import { TZ } from './config.js';

// "2026-09-09" fuer einen Zeitpunkt, gerechnet in Berliner Zeit.
export function isoDateInTZ(date = new Date(), tz = TZ) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(date);
}

// Stunde 0-23 in Berliner Zeit.
export function hourInTZ(date = new Date(), tz = TZ) {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false });
  return Number(fmt.format(date));
}

// Yahoo liefert Dividendentermine als Unix-Sekunden um Mitternacht UTC.
// Rechnet man die in Berliner Zeit um, landet man je nach Vorzeichen einen Tag
// daneben. Deshalb wird hier bewusst in UTC formatiert.
export function unixToIsoDateUTC(seconds) {
  if (!seconds) return null;
  const ms = seconds > 1e11 ? seconds : seconds * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// Yahoo gibt je nach Version Zahl, Date oder ISO-String zurueck.
export function toIsoDate(value) {
  if (value == null) return null;
  if (typeof value === 'number') return unixToIsoDateUTC(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  if (typeof value === 'object' && value.raw != null) return unixToIsoDateUTC(value.raw);
  return null;
}

// "2026-09-09" plus n Tage, wieder als ISO-Datum.
export function addDays(isoDate, n) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso, toIso) {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

// "09.09." fuer die Nachricht
export function shortDE(isoDate) {
  const [, m, d] = isoDate.split('-');
  return `${d}.${m}.`;
}

// "Mittwoch, 9. September 2026"
export function longDE(isoDate) {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

// Wochentag 0=So .. 6=Sa in Berliner Zeit
export function weekdayInTZ(date = new Date(), tz = TZ) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

// Naechster Geschaeftstag (Wochenende uebersprungen, Feiertage nicht).
export function addBusinessDays(isoDate, n) {
  let d = isoDate;
  let left = n;
  while (left > 0) {
    d = addDays(d, 1);
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (dow !== 0 && dow !== 6) left -= 1;
  }
  return d;
}
