#!/usr/bin/env python3
"""Build the compact, source-linked data snapshot used by Atlantic Ledger."""

import json
import os
import pathlib
import urllib.request
from datetime import datetime, timezone


API = "https://api.slavevoyages.org"
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "ledger.json"


def auth_header():
    token = os.environ.get("SLAVEVOYAGES_TOKEN", "").strip()
    if not token:
        raise SystemExit(
            "Set SLAVEVOYAGES_TOKEN to a SlaveVoyages API token before rebuilding."
        )
    return token if token.startswith("Token ") else f"Token {token}"


def request_json(path, payload=None):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{API}{path}",
        data=body,
        headers={
            "Authorization": auth_header(),
            "Content-Type": "application/json",
            "User-Agent": "Atlantic-Ledger-data-builder/0.1",
        },
        method="GET" if body is None else "POST",
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.load(response)


def location(value):
    if not value:
        return None
    return {
        "name": value.get("name"),
        "lat": value.get("latitude"),
        "lon": value.get("longitude"),
    }


def date(value):
    if not value:
        return None
    return {"label": value.get("date_str"), "year": value.get("year")}


def featured_voyage(voyage):
    itinerary = voyage.get("voyage_itinerary") or {}
    numbers = voyage.get("voyage_slaves_numbers") or {}
    dates = voyage.get("voyage_dates") or {}
    ship = voyage.get("voyage_ship") or {}
    outcome = voyage.get("voyage_outcome") or {}
    return {
        "id": voyage.get("voyage_id"),
        "ship": ship.get("ship_name"),
        "rig": (ship.get("rig_of_vessel") or {}).get("name"),
        "nation": (ship.get("imputed_nationality") or {}).get("name"),
        "tonnage": ship.get("tonnage_mod") or ship.get("tonnage"),
        "built": ship.get("year_of_construction"),
        "origin": location(itinerary.get("principal_place_of_slave_purchase")),
        "origin_region": location(
            itinerary.get("imp_principal_region_of_slave_purchase")
        ),
        "destination": location(itinerary.get("imp_principal_port_slave_dis")),
        "destination_region": location(
            itinerary.get("imp_principal_region_slave_dis")
        ),
        "departure": date(dates.get("date_departed_africa_sparsedate")),
        "arrival": date(dates.get("first_dis_of_slaves_sparsedate")),
        "days_middle_passage": dates.get("imp_length_leaving_africa_to_disembark"),
        "embarked": numbers.get("imp_total_num_slaves_embarked"),
        "landed": numbers.get("imp_total_num_slaves_disembarked"),
        "deaths": (
            numbers.get("slave_deaths_between_africa_america")
            if numbers.get("slave_deaths_between_africa_america") is not None
            else numbers.get("imp_mortality_during_voyage")
        ),
        "mortality_ratio": numbers.get("imp_mortality_ratio"),
        "men": numbers.get("imp_num_male_embarked"),
        "women": numbers.get("imp_num_female_embarked"),
        "outcome": (outcome.get("particular_outcome") or {}).get("name"),
        "resistance": (outcome.get("resistance") or {}).get("name"),
        "enslavers": voyage.get("enslavers") or [],
        "sources": [
            {
                "title": source.get("title"),
                "reference": source.get("bib"),
                "short": (source.get("short_ref") or {}).get("name"),
            }
            for source in voyage.get("sources") or []
        ],
    }


def compact_ports(routes):
    result = {}
    for role in ("src", "dst"):
        for port_id, port in routes["ports"][role].items():
            path = port.get("path") or []
            point = path[0] if path else None
            if point and point[0] is not None and point[1] is not None:
                result[str(port_id)] = [point[0], point[1], port.get("name", "Unknown")]
    return result


def compact_voyages(records, ports):
    rows = []
    for record in records:
        src = str(record.get("src"))
        dst = str(record.get("dst"))
        if src not in ports or dst not in ports or not record.get("year"):
            continue
        rows.append(
            [
                record.get("voyage_id"),
                int(src),
                int(dst),
                record.get("embarked") or 0,
                record.get("disembarked") or 0,
                record.get("year"),
                record.get("month") or 0,
                record.get("ship_name") or "",
                record.get("nat_id") or 0,
            ]
        )
    return rows


def build():
    routes = request_json("/timelapse/get-compiled-routes/?networkName=trans")
    nations_raw = request_json("/timelapse/nations/")
    records = request_json(
        "/timelapse/records/",
        {"filter": [{"varName": "dataset", "searchTerm": 0, "op": "exact"}]},
    )
    ports = compact_ports(routes)
    voyages = compact_voyages(records, ports)
    nations = {
        str(item["code"]): item["name"]
        for item in nations_raw.values()
        if item.get("code") is not None
    }

    clotilda = featured_voyage(request_json("/voyage/36990"))
    zong = featured_voyage(request_json("/voyage/84106"))
    bora_person = request_json("/past/enslaved/1")
    bora_voyage = featured_voyage(request_json("/voyage/2314"))

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "schema": {
            "voyage": [
                "id",
                "src",
                "dst",
                "embarked",
                "landed",
                "year",
                "month",
                "ship",
                "nation_id",
            ],
            "port": ["lat", "lon", "name"],
        },
        "stats": {
            "source_voyage_records": len(records),
            "drawable_voyages": len(voyages),
            "documented_embarked": sum(row[3] for row in voyages),
            "documented_landed": sum(row[4] for row in voyages),
            "estimated_embarked": 12520000,
            "estimated_landed": 10700000,
            "named_captives": 91491,
        },
        "ports": ports,
        "nations": nations,
        "voyages": voyages,
        "featured": {
            "clotilda": clotilda,
            "zong": zong,
            "bora": {
                "id": bora_person.get("enslaved_id"),
                "documented_name": bora_person.get("documented_name"),
                "modern_name": bora_person.get("modern_name"),
                "age": bora_person.get("age"),
                "gender": bora_person.get("gender"),
                "height_inches": bora_person.get("height"),
                "language_group": (bora_person.get("language_group") or {}).get("name"),
                "language_group_location": location(bora_person.get("language_group")),
                "post_disembark_location": location(
                    bora_person.get("post_disembark_location")
                ),
                "fate": (bora_person.get("captive_fate") or {}).get("name"),
                "captain": (bora_person.get("enslavers") or [{}])[0].get(
                    "name_and_role"
                ),
                "voyage": bora_voyage,
                "sources": [
                    {
                        "title": source.get("title"),
                        "url": source.get("zotero_url"),
                        "short": (source.get("short_ref") or {}).get("name"),
                    }
                    for source in bora_person.get("sources") or []
                ],
                "certainty": {
                    "name": "documented",
                    "ship": "documented",
                    "embarkation": "documented at port level",
                    "language_group": "inferred from recorded name",
                    "ancestral_home": "unknown",
                    "cause_of_enslavement": "unknown",
                },
            },
        },
        "sources": [
            {
                "name": "SlaveVoyages",
                "url": "https://www.slavevoyages.org/",
                "role": "Voyages, ships, routes, counts, named captives, and sources",
            },
            {
                "name": "Enslaved.org",
                "url": "https://enslaved.org/",
                "role": "Linked people, events, places, and source records",
            },
            {
                "name": "Slave Societies Digital Archive",
                "url": "https://slavesocieties.org/",
                "role": "Baptism, marriage, burial, sale, and manumission records",
            },
            {
                "name": "Enslaved.org Recommended Practices",
                "url": "https://docs.enslaved.org/recommendedPractices/",
                "role": "Ethical and evidence-aware historical data modeling",
            },
        ],
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=True, separators=(",", ":"))
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size:,} bytes, {len(voyages):,} voyages)")


if __name__ == "__main__":
    build()
