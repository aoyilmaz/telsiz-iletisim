#!/usr/bin/env python3
"""
hearham.com açık API'sinden dünya röle verilerini tek seferde çeker,
ülkelere böler ve data/<KOD>.json dosyalarına kaydeder.

Kurulum:  pip install requests
Kullanım: python fetch_world_data.py            # tüm ülkeler
          python fetch_world_data.py DE FR GB   # sadece belirtilen ülkeler
"""

import json, re, os, sys, io, time
import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ─── Ülke haritası: ISO kodu → (Türkçe ad, hearham city alanındaki anahtar kelimeler) ───

COUNTRY_MAP = {
    "DE": ("Almanya",          ["Germany"]),
    "AT": ("Avusturya",        ["Austria"]),
    "BE": ("Belçika",          ["Belgium"]),
    "BG": ("Bulgaristan",      ["Bulgaria"]),
    "CZ": ("Çek Cumhuriyeti",  ["Czech"]),
    "DK": ("Danimarka",        ["Denmark"]),
    "EE": ("Estonya",          ["Estonia"]),
    "FI": ("Finlandiya",       ["Finland"]),
    "FR": ("Fransa",           ["France"]),
    "NL": ("Hollanda",         ["Netherlands"]),
    "HR": ("Hırvatistan",      ["Croatia"]),
    "GB": ("İngiltere",        ["England", "Scotland", "Wales", "UK)", "United Kingdom"]),
    "IE": ("İrlanda",          ["Ireland"]),
    "ES": ("İspanya",          ["Spain"]),
    "SE": ("İsveç",            ["Sweden"]),
    "CH": ("İsviçre",          ["Switzerland"]),
    "IT": ("İtalya",           ["Italy"]),
    "IS": ("İzlanda",          ["Iceland"]),
    "LV": ("Letonya",          ["Latvia"]),
    "LT": ("Litvanya",         ["Lithuania"]),
    "HU": ("Macaristan",       ["Hungary"]),
    "MK": ("Kuzey Makedonya",  ["Macedonia"]),
    "NO": ("Norveç",           ["Norway"]),
    "PL": ("Polonya",          ["Poland"]),
    "PT": ("Portekiz",         ["Portugal"]),
    "RO": ("Romanya",          ["Romania"]),
    "RS": ("Sırbistan",        ["Serbia"]),
    "SK": ("Slovakya",         ["Slovakia"]),
    "SI": ("Slovenya",         ["Slovenia"]),
    "GR": ("Yunanistan",       ["Greece"]),
    "US": ("ABD",              ["USA", "United States"]),
    "CA": ("Kanada",           ["Canada"]),
    "MX": ("Meksika",          ["Mexico"]),
    "BR": ("Brezilya",         ["Brazil"]),
    "AR": ("Arjantin",         ["Argentina"]),
    "CL": ("Şili",             ["Chile"]),
    "CO": ("Kolombiya",        ["Colombia"]),
    "AU": ("Avustralya",       ["Australia"]),
    "NZ": ("Yeni Zelanda",     ["Zealand"]),
    "JP": ("Japonya",          ["Japan"]),
    "KR": ("Güney Kore",       ["Korea"]),
    "IN": ("Hindistan",        ["India"]),
    "SG": ("Singapur",         ["Singapore"]),
    "MY": ("Malezya",          ["Malaysia"]),
    "TH": ("Tayland",          ["Thailand"]),
    "PH": ("Filipinler",       ["Philippines"]),
    "ID": ("Endonezya",        ["Indonesia"]),
    "HK": ("Hong Kong",        ["Hong Kong"]),
    "IL": ("İsrail",           ["Israel"]),
    "JO": ("Ürdün",            ["Jordan"]),
    "AE": ("BAE",              ["Emirates"]),
    "ZA": ("Güney Afrika",     ["South Africa"]),
    "EG": ("Mısır",            ["Egypt"]),
}

# ─── Mod → tip/protokol eşlemesi ──────────────────────────────────────────────

MODE_MAP = {
    "DMR":     ("digital", "DMR"),
    "D-STAR":  ("digital", "D-STAR"),
    "D-STAR ": ("digital", "D-STAR"),
    "D-star":  ("digital", "D-STAR"),
    "YSF":     ("digital", "C4FM"),
    "YSF/FM":  ("digital", "C4FM"),
    "YSF/FM ": ("digital", "C4FM"),
    "NXDN":    ("digital", "NXDN"),
    "P25":     ("digital", "P25"),
    "P25/FM":  ("digital", "P25"),
    "TETRA":   ("digital", "TETRA"),
}

# ─── Dönüştürücü ──────────────────────────────────────────────────────────────

def convert_hearham(entry, country_label):
    try:
        lat  = float(entry.get("latitude",  0) or 0)
        lon  = float(entry.get("longitude", 0) or 0)
        freq_hz   = int(entry.get("frequency", 0) or 0)
        offset_hz = int(entry.get("offset",   0) or 0)
    except (ValueError, TypeError):
        return None

    if not freq_hz or (lat == 0 and lon == 0):
        return None
    if not entry.get("operational", 1):
        return None

    tx_mhz = freq_hz   / 1_000_000
    off_mhz = offset_hz / 1_000_000

    band  = "UHF" if 430 <= tx_mhz < 450 else "VHF"
    mode  = (entry.get("mode") or "FM").strip()
    rtype, proto = MODE_MAP.get(mode, ("analog", None))

    callsign = (entry.get("callsign") or "").strip()
    city_raw = (entry.get("city")     or "").strip()
    # şehir: ilk virgüle kadar
    city = city_raw.split(",")[0].strip()
    name = " ".join(filter(None, [callsign, city])) or f"{tx_mhz:.4f} MHz"

    encode = entry.get("encode") or ""
    ctcss  = None
    try:
        v = float(encode)
        if v > 0:
            ctcss = v
    except (ValueError, TypeError):
        pass

    slug = re.sub(r"[^a-zA-Z0-9]", "", callsign)
    rid  = f"hh-{slug}-{round(lat * 1000)}"

    region = country_label + (" - " + city if city else "")

    return {
        "id":          rid,
        "name":        name,
        "region":      region,
        "type":        rtype,
        "band":        band,
        "protocol":    proto,
        "listen_freq": round(tx_mhz, 4),
        "send_freq":   round(tx_mhz + off_mhz, 4),
        "offset":      round(off_mhz, 3),
        "ctcss":       ctcss,
        "lat":         lat,
        "lon":         lon,
        "operator":    callsign or None,
        "notes":       (entry.get("description") or "").strip()[:200] or None,
    }

# ─── Ülke eşleştirici ─────────────────────────────────────────────────────────

def find_country(city_field):
    """city alanından ISO ülke kodu döndürür veya None."""
    if not city_field:
        return None
    for code, (label, keywords) in COUNTRY_MAP.items():
        for kw in keywords:
            if kw in city_field:
                return code
    return None

# ─── Ana program ──────────────────────────────────────────────────────────────

def main():
    wanted = set(a.upper() for a in sys.argv[1:])
    targets = {k: v for k, v in COUNTRY_MAP.items() if not wanted or k in wanted}

    print("hearham.com API'sinden tüm röle verisi indiriliyor…")
    r = requests.get(
        "https://hearham.com/api/repeaters/v1",
        headers={"User-Agent": "Mozilla/5.0 AfetTelsiz-DataFetcher/2.0",
                 "Accept": "application/json"},
        timeout=60,
    )
    r.raise_for_status()
    all_entries = r.json()
    print(f"Toplam {len(all_entries)} röle indirildi. Ülkelere ayrılıyor…\n")

    # Ülkelere böl
    buckets = {code: [] for code in targets}
    skipped = 0
    for entry in all_entries:
        code = find_country(entry.get("city", ""))
        if code and code in targets:
            relay = convert_hearham(entry, targets[code][0])
            if relay:
                buckets[code].append(relay)
        elif code is None:
            skipped += 1

    os.makedirs("data", exist_ok=True)
    ok = 0
    for code, (label, _) in targets.items():
        relays = buckets.get(code, [])
        out = os.path.join("data", code + ".json")
        with open(out, "w", encoding="utf-8") as f:
            json.dump({"relays": relays}, f, ensure_ascii=False, separators=(",", ":"))
        print(f"  {code}  {label:20s}  {len(relays):4d} röle  →  {out}")
        if relays:
            ok += 1

    print(f"\nTamamlandı: {ok}/{len(targets)} ülkede veri var.")
    print(f"(Eşleştirilemeyen giriş: {skipped})")
    print("\nGitHub'a göndermek için:")
    print("  git add data/ && git commit -m 'Dünya röle verisi güncellendi'")

if __name__ == "__main__":
    main()
