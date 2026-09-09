import { SEND_HOUR, SEND_WINDOW_HOURS, TZ } from './config.js';

// Der Workflow startet zweimal, damit Sommer- wie Winterzeit getroffen wird.
// Gesendet wird in einem Zeitfenster statt zu einer festen Stunde, weil GitHub
// Cron-Zeiten oft um eine halbe Stunde und mehr verfehlt — ein verspaeteter
// Lauf soll nicht ersatzlos ausfallen. Dass aus dem Fenster keine zwei
// Nachrichten werden, verhindert die Tagessperre.
export function shouldRun({ hour, today, lastSentDate }) {
  const until = SEND_HOUR + SEND_WINDOW_HOURS;
  if (hour < SEND_HOUR || hour >= until) {
    return { ok: false, reason: `${hour} Uhr in ${TZ}, Fenster ist ${SEND_HOUR}–${until} Uhr` };
  }
  if (lastSentDate === today) {
    return { ok: false, reason: `heute (${today}) wurde bereits gesendet` };
  }
  return { ok: true };
}
