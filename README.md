# Börsen-Briefing

Schickt werktags um 6:30 Uhr ein kurzes Marktbriefing per Telegram: Indizes,
Rohstoffe und Währungen, anstehende Dividenden-Ex- und Zahltage, auf Wunsch
Wirtschaftstermine, dazu ein paar Schlagzeilen.

Kein Sprachmodell im Spiel — festes Format, immer gleich aufgebaut.

## Einrichtung

**1. Telegram-Bot anlegen.** In Telegram `@BotFather` anschreiben, `/newbot`
schicken, Namen vergeben. Du bekommst ein Token der Form `123456789:AA...`.

**2. Chat-ID herausfinden.** Dem neuen Bot einmal irgendeine Nachricht schicken,
dann im Browser öffnen:

```
https://api.telegram.org/bot<DEIN_TOKEN>/getUpdates
```

Die Zahl unter `"chat":{"id":...}` ist deine Chat-ID.

**3. Lokal testen.**

```bash
npm install
cp .env.example .env     # Token und Chat-ID eintragen
npm run dev              # zeigt die Nachricht nur an
npm run send             # verschickt sie wirklich
```

**4. Auf GitHub scharfstellen.** Repo anlegen, Code pushen, dann unter
Settings → Secrets and variables → Actions anlegen:

| Secret | Pflicht |
|---|---|
| `TELEGRAM_BOT_TOKEN` | ja |
| `TELEGRAM_CHAT_ID` | ja |
| `FMP_API_KEY` | nein, siehe unten |

Danach unter Actions den Workflow einmal von Hand starten („Run workflow"),
um zu sehen, ob alles durchläuft.

## Aufrufe

```bash
node src/index.js --dry-run                     # anzeigen statt senden
node src/index.js --dry-run --section=markets   # nur ein Baustein
node src/index.js --send                        # verschicken
node src/index.js --send --force                # Stundenprüfung überspringen
node src/index.js --refresh-all                 # Dividenden komplett neu holen
```

`--section` kennt `markets`, `dividends`, `calendar` und `news`.

## Woher die Daten kommen

**Kurse** über Yahoos Chart-Endpunkt, ohne Schlüssel. Welche Werte angezeigt
werden, steht in `MARKETS` in [src/config.js](src/config.js).

**Dividenden** über `yahoo-finance2`. Einen kostenlosen Gesamtkalender gibt es
nicht, deshalb fragt das Skript ein festes Universum ab: DAX 40, Euro Stoxx und
Dow 30, zusammen rund 100 Titel. Eigene Werte kommen einfach in die Listen in
`config.js`.

Damit das nicht jeden Morgen 100 Abfragen kostet, liegt das Ergebnis in
`data/dividends-cache.json`. Der tägliche Lauf frischt nur auf, was abgelaufen
oder älter als sieben Tage ist; sonntags läuft ein Vollabgleich. Der Workflow
committet die Datei zurück ins Repo.

**Schlagzeilen** aus RSS: tagesschau Wirtschaft, FAZ Finanzen, Yahoo Finance.
Ratgeberstrecken werden über `NEWS_BLOCKLIST` aussortiert.

**Termine** über Financial Modeling Prep, und nur dann, wenn `FMP_API_KEY`
gesetzt ist. Ohne Schlüssel — oder wenn FMP den Endpunkt im Gratistarif sperrt —
entfällt der Abschnitt, das übrige Briefing geht trotzdem raus.

## Was du über die Zahlen wissen solltest

**Zahltage gibt es nur für US-Titel.** Yahoo liefert das Feld für europäische
Aktien nicht. Für die rechnet das Skript den zweiten Geschäftstag nach dem
Ex-Tag aus — so ist es in Deutschland und den Nachbarmärkten üblich. Solche
Werte sind in der Nachricht mit einer Tilde markiert (`Zahltag ~14.05.`).
Feiertage kennt die Rechnung nicht, nur Wochenenden.

**Der Betrag ist die einzelne Zahlung**, nicht die Jahresdividende — bei
Quartalszahlern wie Coca-Cola also 0,53 $ statt 2,12 $. Grundlage ist die
zuletzt gezahlte Dividende; kündigt ein Unternehmen eine Erhöhung an, steht
noch der alte Wert da.

**Ex-Termine erscheinen erst, wenn Yahoo sie kennt.** Von rund 100 Titeln haben
zu einem beliebigen Zeitpunkt nur 15 bis 20 einen Termin in der Zukunft; beim
Rest steht noch der letzte. Außerhalb der Frühjahrssaison ist das Sieben-Tage-
Fenster deshalb oft leer — dann zeigt das Briefing ersatzweise die nächsten drei
anstehenden Termine.

Kurz: gut genug, um nichts zu verpassen. Vor einer Kaufentscheidung kurz vor dem
Ex-Tag lohnt der Blick auf die Investor-Relations-Seite.

## Wenn etwas ausfällt

Jeder Abschnitt läuft für sich. Fällt einer aus, steht dort „Daten nicht
verfügbar" und der Rest geht trotzdem raus. Erst wenn Kurse, Dividenden und
Nachrichten gleichzeitig fehlschlagen, bricht der Lauf ab und der Workflow
schlägt fehl.

Yahoo ist eine inoffizielle Quelle und kann ohne Vorwarnung sperren oder das
Antwortformat ändern. Dann trifft es Kurse und Dividenden zugleich. Naheliegender
Ersatz wäre Twelve Data (800 Abrufe am Tag gratis) hinter derselben Schnittstelle
in `src/sources/`.

## Zeitsteuerung

Das Briefing kommt **werktags**, Montag bis Freitag, morgens ab etwa 5:30 Uhr.
Eine feste Minute gibt es nicht, und das hat einen Grund.

GitHub hält Cron-Zeiten nicht zuverlässig ein: Läufe kommen verspätet, und
einzelne fallen ersatzlos aus. Beim ersten Zeitplan-Lauf dieses Repos ist genau
das passiert — beide Cron-Zeiten wurden übersprungen, obwohl Syntax, Branch und
Berechtigungen stimmten.

Deshalb ist der Ablauf auf Wiederholung ausgelegt statt auf Pünktlichkeit:

- Der Workflow startet **siebenmal** über den Morgen verteilt (siehe die
  `cron`-Einträge in [briefing.yml](.github/workflows/briefing.yml)).
- Gesendet wird nur im Fenster zwischen 5 und 10 Uhr Berliner Zeit, entschieden
  in [src/schedule.js](src/schedule.js). Die Grenze steht als `SEND_HOUR` in
  [src/config.js](src/config.js) — wer sie verschiebt, muss die `cron`-Zeiten
  mitziehen.
- Der erste Lauf, der es in das Fenster schafft, sendet und schreibt das Datum
  nach `data/state.json`. Alle weiteren Läufe des Tages sehen das und steigen
  sofort wieder aus.

Damit die überzähligen Läufe kaum Rechenzeit kosten, entscheidet
[scripts/gate.js](scripts/gate.js) direkt nach dem Checkout — vor `npm ci`.
Ein übersprungener Lauf ist nach wenigen Sekunden vorbei.

Zwei Cron-Zeiten decken den Sommer mit ab (03:28 und 03:58 UTC sind im Winter
noch zu früh), der Rest greift ganzjährig. Manuelle Läufe über „Run workflow"
umgehen Fenster und Tagessperre mit `--force`.

Ein Restrisiko bleibt: schlägt der Push von `state.json` fehl, hält der nächste
Lauf den Tag für offen und schickt das Briefing ein zweites Mal. Doppelt ist mir
hier lieber als gar nicht.

## Warum das Repo öffentlich ist

Solange es privat war, sind die geplanten Läufe vier bis fünf Stunden zu spät
gestartet (Cron 04:28 UTC, tatsächlicher Start 08:58 UTC, und so weiter an
mehreren Tagen). Das Briefing fiel damit regelmäßig aus dem Sendefenster.
Geplante Läufe in öffentlichen Repos werden bevorzugt eingeplant, deshalb die
Umstellung am 11.09.2026.

Im Code steht nichts Vertrauliches. Bot-Token und Chat-ID liegen in den
Actions-Secrets und bleiben auch bei einem öffentlichen Repo verborgen; `.env`
ist ignoriert und war nie committet. Der Workflow reagiert nur auf `schedule`
und `workflow_dispatch`, nicht auf `pull_request` — ein fremder Fork kann ihn
also nicht auslösen und kommt an die Secrets nicht heran.
