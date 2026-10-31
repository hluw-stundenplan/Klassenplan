#!/usr/bin/env python3
"""Holt den öffentlichen WebUntis-Stundenplan aller Klassen und die Termine aus der
Google-Tabelle der Klassenvorstände und schreibt sie nach data/.

Läuft stündlich über GitHub Actions. Benötigt nur die Python-Standardbibliothek.
Umgebungsvariablen:
  WEEKS          Anzahl Wochen ab der aktuellen (Standard 6)
  SHEET_CSV_URL  Veröffentlichte CSV-Adresse der Google-Tabelle (optional)
"""
import csv, io, json, os, re, sys, time, urllib.request, urllib.error
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CFG = json.load(open(os.path.join(ROOT, "config.json"), encoding="utf-8"))
SERVER, SCHOOL = CFG["webuntisServer"], CFG["webuntisSchule"]
BASE = f"https://{SERVER}/WebUntis/api/rest/view/v1"
WEEKS = int(os.environ.get("WEEKS") or 6)
HEADERS = {"Accept": "application/json", "anonymous-school": SCHOOL,
           "User-Agent": "Klassenplan-Schulprojekt (stuendlicher Abgleich, oeffentlicher Plan)"}


def get_json(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            if i == tries - 1:
                raise
            time.sleep(3 * (i + 1))


def write_json(path, obj, pretty=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1 if pretty else None,
                  separators=None if pretty else (",", ":"))
    os.replace(tmp, path)


def load_json(path, default):
    try:
        return json.load(open(path, encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def pos(arr, kind, d):
    """Kodiert eine Position (Fach, Lehrkraft, Raum, Klasse) so wie die App sie liest:
    [Statuskürzel:]Aktuell[~Entfernt], mehrere durch Komma getrennt."""
    out = []
    for x in arr or []:
        cur, rem = x.get("current"), x.get("removed")
        if cur:
            d[kind][cur["shortName"]] = cur.get("longName") or cur["shortName"]
        if rem:
            d[kind][rem["shortName"]] = rem.get("longName") or rem["shortName"]
        st = cur.get("status", "") if cur else ""
        s = (st[0] + ":" if st and st != "REGULAR" else "") + (cur["shortName"] if cur else "")
        if rem:
            s += "~" + rem["shortName"]
        out.append(s)
    return ",".join(out)


def clean(v):
    return str(v if v is not None else "").replace("|", "/")


def fetch_class(cid, start, weeks, d):
    days = {}
    for w in range(weeks):
        s = start + timedelta(days=7 * w)
        e = s + timedelta(days=4)
        url = (f"{BASE}/timetable/entries?start={s}&end={e}&format=0&resourceType=CLASS"
               f"&resources={cid}&periodTypes=&timetableType=STANDARD&layout=START_TIME")
        j = get_json(url)
        for day in j.get("days", []):
            h = [clean(x.get("type")) + "|" + clean(x.get("shortName") or x.get("name")) + "|" + clean(x.get("longName"))
                 for x in (day.get("backEntries") or []) + (day.get("dayEntries") or [])]
            g = []
            for x in day.get("gridEntries") or []:
                dur = x["duration"]
                g.append("|".join(clean(v) for v in [
                    dur["start"][11:16], dur["end"][11:16], x.get("type"), x.get("status"),
                    x.get("statusDetail") or "", x.get("layoutStartPosition", 0), x.get("layoutWidth", 1000),
                    pos(x.get("position2"), "su", d), pos(x.get("position1"), "te", d),
                    pos(x.get("position3"), "ro", d), pos(x.get("position4"), "cl", d), ""]))
            days[day["date"]] = {"h": h, "g": g}
        time.sleep(0.4)  # Schulserver schonen
    return days


def update_timetables():
    today = date.today()
    start = today - timedelta(days=today.weekday())
    if today.weekday() >= 5:
        start += timedelta(days=7)
    filt = get_json(f"{BASE}/timetable/filter?resourceType=CLASS&timetableType=STANDARD&start={start}&end={start + timedelta(days=4)}")
    klassen = [{"id": c["class"]["id"], "name": c["class"]["shortName"], "kv": c["class"].get("longName", "")}
               for c in filt.get("classes", [])]
    if not klassen:
        raise SystemExit("Keine Klassen von WebUntis erhalten – Abbruch ohne Änderungen.")
    write_json(os.path.join(DATA, "klassen.json"), klassen, pretty=True)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    keep_from = (start - timedelta(days=28)).isoformat()  # vier Wochen Vergangenheit behalten
    changed = 0
    for k in klassen:
        path = os.path.join(DATA, "stundenplan", k["name"] + ".json")
        old = load_json(path, {})
        d = {"su": {}, "te": {}, "ro": {}, "cl": {}}
        try:
            new_days = fetch_class(k["id"], start, WEEKS, d)
        except Exception as e:  # eine Klasse darf die anderen nicht blockieren
            print(f"! {k['name']}: {e}", file=sys.stderr)
            continue
        days = {ds: v for ds, v in (old.get("days") or {}).items() if ds >= keep_from}
        content_changed = any(days.get(ds) != v for ds, v in new_days.items())
        days.update(new_days)
        dict_ = old.get("dict") or {"su": {}, "te": {}, "ro": {}, "cl": {}}
        for key in d:
            dict_.setdefault(key, {}).update(d[key])
        if not content_changed and old:
            continue
        ds_sorted = sorted(days)
        write_json(path, {"klasse": k["name"], "id": k["id"], "kv": k["kv"], "updatedAt": now,
                          "from": ds_sorted[0], "to": ds_sorted[-1], "dict": dict_, "days": days})
        changed += 1
        print(f"✓ {k['name']}: aktualisiert")
    # Zeitstempel des letzten erfolgreichen Abgleichs, auch ohne inhaltliche Änderung
    write_json(os.path.join(DATA, "stand.json"), {"letzterAbgleich": now, "wochen": WEEKS}, pretty=True)
    print(f"{changed} Klasse(n) mit Änderungen.")


DATE_PATTERNS = [r"^(\d{4})-(\d{1,2})-(\d{1,2})$", r"^(\d{1,2})\.(\d{1,2})\.(\d{4})$", r"^(\d{1,2})\.(\d{1,2})\.(\d{2})$"]


def parse_date(s):
    s = (s or "").strip()
    for i, p in enumerate(DATE_PATTERNS):
        m = re.match(p, s)
        if m:
            a, b, c = (int(x) for x in m.groups())
            y, mo, d = (a, b, c) if i == 0 else (c if c > 99 else 2000 + c, b, a)
            try:
                return date(y, mo, d).isoformat()
            except ValueError:
                return None
    return None


def update_events():
    url = (os.environ.get("SHEET_CSV_URL") or "").strip()
    if not url:
        print("Keine Google-Tabelle hinterlegt – data/termine.json bleibt unverändert.")
        return
    req = urllib.request.Request(url, headers={"User-Agent": HEADERS["User-Agent"]})
    with urllib.request.urlopen(req, timeout=30) as r:
        text = r.read().decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(text)))
    norm = lambda k: re.sub(r"[^a-zäöü]", "", (k or "").lower())
    out, skipped = [], 0
    for row in rows:
        r = {norm(k): (v or "").strip() for k, v in row.items()}
        datum = parse_date(r.get("datum"))
        klasse = r.get("klasse", "").upper().replace(" ", "")
        if not datum or not klasse:
            if any(r.values()):
                skipped += 1
            continue
        out.append({"klasse": klasse, "datum": datum, "art": r.get("art", ""),
                    "fach": r.get("fach", "").upper(), "stunden": r.get("stunden") or r.get("stunde", ""),
                    "titel": r.get("bezeichnung") or r.get("titel", ""), "notiz": r.get("notiz", ""),
                    "unsicher": r.get("unsicher", "").lower() in ("ja", "x", "1", "true")})
    if not out and rows:
        raise SystemExit("Tabelle gelesen, aber keine gültige Zeile gefunden – termine.json bleibt unverändert.")
    out.sort(key=lambda e: (e["datum"], e["klasse"]))
    write_json(os.path.join(DATA, "termine.json"), out, pretty=True)
    print(f"{len(out)} Termine aus der Tabelle übernommen, {skipped} Zeile(n) ohne gültiges Datum/Klasse übersprungen.")


if __name__ == "__main__":
    errors = 0
    for step in (update_timetables, update_events):
        try:
            step()
        except SystemExit as e:
            print(e, file=sys.stderr); errors += 1
        except Exception as e:
            print(f"Fehler in {step.__name__}: {e}", file=sys.stderr); errors += 1
    sys.exit(1 if errors == 2 else 0)
