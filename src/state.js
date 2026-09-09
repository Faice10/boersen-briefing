// Merkt sich, an welchem Tag zuletzt gesendet wurde.
// Liegt in data/, weil der Workflow dieses Verzeichnis ohnehin zurueckcommittet.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATE_PATH = resolve(ROOT, 'data/state.json');

export async function readState() {
  try {
    return JSON.parse(await readFile(STATE_PATH, 'utf8'));
  } catch {
    return { lastSentDate: null };
  }
}

export async function markSent(isoDate) {
  const state = await readState();
  state.lastSentDate = isoDate;
  state.lastSentAt = new Date().toISOString();
  await mkdir(dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}
`, 'utf8');
}
