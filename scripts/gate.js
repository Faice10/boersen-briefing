// Frueher Ausstieg fuer den Workflow.
//
// Der Zeitplan startet den Job mehrmals am Morgen, weil GitHub einzelne
// Cron-Zeiten verzoegert oder ganz auslaesst. Gesendet wird trotzdem nur
// einmal. Damit die ueberzaehligen Laeufe kaum Rechenzeit kosten, entscheidet
// dieses Skript direkt nach dem Checkout — vor npm ci — ob es ueberhaupt
// weitergeht. Es kommt ohne Abhaengigkeiten aus und laeuft mit dem Node,
// das auf dem Runner ohnehin installiert ist.

import { appendFileSync } from 'node:fs';
import { isoDateInTZ, hourInTZ } from '../src/dates.js';
import { shouldRun } from '../src/schedule.js';
import { readState } from '../src/state.js';

const manual = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';
const today = isoDateInTZ();

let verdict;
if (manual) {
  verdict = { ok: true, reason: 'manuell ausgeloest' };
} else {
  const { lastSentDate } = await readState();
  verdict = shouldRun({ hour: hourInTZ(), today, lastSentDate });
}

console.log(verdict.ok
  ? `Weiter: ${verdict.reason ?? 'im Zeitfenster, heute noch nichts gesendet'}`
  : `Uebersprungen: ${verdict.reason}`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `run=${verdict.ok}\n`);
}
