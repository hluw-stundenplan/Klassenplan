# Klassenplan HLUW Yspertal – Einrichtung

Diese App zeigt den öffentlichen WebUntis-Stundenplan aller 14 Klassen und legt Schularbeiten, Tests und Termine farbig über die betroffenen Stunden. Sie läuft vollständig kostenlos auf GitHub. Ein Konto bei Claude oder Untis brauchen die Nutzerinnen und Nutzer nicht.

**Aufbau**
- `index.html`, `style.css`, `app.js` – die App selbst
- `config.json` – Einstellungen (Schularbeitsfächer, Hinweise, Link zur Termin-Tabelle)
- `scripts/update.py` – holt stündlich den Stundenplan aus WebUntis und die Termine aus der Google-Tabelle
- `.github/workflows/aktualisieren.yml` – führt das Skript automatisch aus und veröffentlicht die App
- `data/` – die abgeglichenen Daten (werden automatisch gepflegt, nicht von Hand bearbeiten)
- `vorlage/termine-vorlage.csv` – Startinhalt für die Google-Tabelle der Klassenvorstände

---

## Schritt 1: Projekt auf GitHub anlegen (ca. 10 Minuten)

1. Auf github.com anmelden, oben rechts **„+“ → „New repository“**.
2. Name: `klassenplan`. Sichtbarkeit: **Public** (für kostenlose Veröffentlichung nötig). Keine weiteren Häkchen setzen. **„Create repository“**.
3. Auf der leeren Projektseite den Link **„uploading an existing file“** anklicken.
4. Diese ZIP-Datei am Computer entpacken. **Den Inhalt des Ordners** (nicht den Ordner selbst) in das Browserfenster ziehen.
   - Wichtig: Der Ordner `.github` beginnt mit einem Punkt und ist am Mac im Finder unsichtbar. Im Finder **Cmd + Shift + .** drücken, dann wird er angezeigt und kann mitgezogen werden.
5. Unten **„Commit changes“**.

Falls der Ordner `.github` beim Hochladen fehlt: **„Add file“ → „Create new file“**, als Dateinamen `.github/workflows/aktualisieren.yml` eintippen (die Schrägstriche legen die Ordner an), den Inhalt der gleichnamigen Datei aus dem ZIP hineinkopieren und **„Commit changes“**.

**Prüfen:** In der Dateiliste müssen `index.html`, `config.json` und der Ordner `.github` zu sehen sein.

## Schritt 2: Veröffentlichung einschalten (2 Minuten)

1. Im Projekt **„Settings“ → links „Pages“**.
2. Bei **„Source“** die Option **„GitHub Actions“** wählen.
3. Oben auf den Reiter **„Actions“** wechseln. Erscheint ein Hinweis, Workflows zu erlauben, auf **„I understand my workflows, go ahead and enable them“** klicken.
4. Links **„Stundenplan aktualisieren und veröffentlichen“** wählen, rechts **„Run workflow“ → „Run workflow“**.
5. Nach etwa 3–5 Minuten ist der Lauf grün. Ab jetzt sind alle 14 Klassen geladen.

**Die Adresse der App** lautet: `https://<IHR-GITHUB-NAME>.github.io/klassenplan/`
Sie steht auch unter „Settings → Pages“.

Eine bestimmte Klasse direkt öffnen: `…/klassenplan/#3BUW`

## Schritt 3: Termin-Tabelle für die Klassenvorstände (10 Minuten)

1. In Google Drive eine neue Google-Tabelle anlegen, z. B. „Klassenplan – Termine“.
2. **Datei → Importieren → Hochladen** → `vorlage/termine-vorlage.csv` → „Aktuelles Tabellenblatt ersetzen“.
3. **Teilen** → die Klassenvorstände mit Berechtigung **„Bearbeiter“** hinzufügen.
4. **Datei → Teilen → Im Web veröffentlichen** → Tabellenblatt auswählen → Format **„Kommagetrennte Werte (.csv)“** → **„Veröffentlichen“**. Den angezeigten Link kopieren.
5. Auf GitHub: **Settings → Secrets and variables → Actions → Reiter „Variables“ → „New repository variable“**
   - Name: `SHEET_CSV_URL`
   - Wert: der kopierte Link
6. Optional: In `config.json` bei `"eintragenLink"` den normalen Bearbeitungslink der Tabelle eintragen. Dann zeigt die App unten „Für Klassenvorstände: Termine eintragen“.

**Spalten der Tabelle**

| Spalte | Beispiel | Hinweis |
|---|---|---|
| Klasse | 3BUW | genau wie in WebUntis |
| Datum | 06.11.2026 | |
| Art | Schularbeit / Test / Termin | leer lassen = automatisch nach Fach |
| Fach | D | Kürzel wie in WebUntis |
| Stunden | 1.–2. | diese Stunden werden komplett ersetzt; leer = Stunde des Fachs |
| Bezeichnung | Elternsprechtag | für Termine ohne Fach |
| Notiz | Stoff Kapitel 3 | erscheint in der Detailansicht |
| Unsicher | ja | markiert den Eintrag mit ⚠ |

Neue Zeilen erscheinen spätestens nach dem nächsten stündlichen Abgleich in der App.

## Schritt 4: Auf dem Handy installieren

- **iPhone:** Adresse in **Safari** öffnen → Teilen-Symbol → **„Zum Home-Bildschirm“**.
- **Android:** Adresse in **Chrome** öffnen → Menü ⋮ → **„App installieren“** bzw. **„Zum Startbildschirm hinzufügen“**.

---

## Betrieb

- **Abgleich:** an Schultagen stündlich von etwa 6 bis 17 Uhr, sonntags um 18:30 Uhr mit Vorschau auf 20 Wochen. GitHub startet geplante Abläufe manchmal einige Minuten verspätet.
- **Manuell aktualisieren:** Reiter „Actions“ → Ablauf auswählen → „Run workflow“.
- **Schularbeitsfächer anpassen:** in `config.json` unter `schularbeitsfaecher`. `standard` gilt für alle Klassen; für einzelne Klassen kann eine eigene Liste ergänzt werden, z. B. `"5WKW": ["M", "D", "E", "F"]`.
- **Fehlerfall:** Ist ein Lauf rot, schickt GitHub eine E-Mail. Die App zeigt dann weiter den letzten Stand; unten steht immer, wann zuletzt abgeglichen wurde.
- **Längere Ruhephasen:** GitHub pausiert geplante Abläufe in öffentlichen Projekten, wenn 60 Tage lang keine Änderung am Projekt erfolgt. Durch die laufenden Stundenplan-Änderungen passiert das im Schuljahr praktisch nicht; nach den Sommerferien den Ablauf bei Bedarf unter „Actions“ wieder aktivieren.

## Wichtig

- **Zustimmung der Schule einholen**, bevor der Link verteilt wird. Der Stundenplan ist zwar öffentlich, das automatische Abrufen und Weiterveröffentlichen sollte die Direktion aber kennen und erlauben.
- Das Skript ruft WebUntis höflich ab (kurze Pausen zwischen den Anfragen). Die Abfragehäufigkeit nicht erhöhen.
- Verbindlich bleibt immer WebUntis. Dieser Hinweis steht auch in der App.
