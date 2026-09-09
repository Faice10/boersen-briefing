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

GitHub-Cron kennt nur UTC und rechnet keine Sommerzeit. Deshalb startet der
Workflow zweimal, um 04:30 und 05:30 UTC. Das Skript prüft die Berliner Stunde
und bricht ab, wenn sie nicht passt — es läuft also immer genau einer der beiden
durch, im Sommer wie im Winter. Manuelle Läufe umgehen die Prüfung mit `--force`.
