#!/usr/bin/env python3
"""
Build (or rebuild) the fleet SQLite database from rail-data.json.

Usage:
    python build_db.py            # build to default path: apps/agent/fleet.db
    python build_db.py --force    # force rebuild even if DB is already up-to-date
    python build_db.py --out path/to/custom.db

Run this after regenerating rail-data.json (e.g. after `pnpm generate-rail-data`).
The agent (rail_data.py) loads this file automatically on startup; if it does not
exist yet, the agent builds it on first request.
"""

import argparse
import json
import sqlite3
import sys
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────
_ROOT      = Path(__file__).resolve().parent
_JSON_PATH = (
    _ROOT.parent
    / "app" / "src" / "features" / "rail-dashboard" / "data" / "rail-data.json"
)
_DB_PATH   = _ROOT / "fleet.db"

DDL = """
CREATE TABLE IF NOT EXISTS trains (
    id                TEXT PRIMARY KEY,
    name              TEXT,
    fleet_type        TEXT,
    operational_state TEXT,
    health_status     TEXT,
    current_location  TEXT,
    efficiency        INTEGER,
    total_carriages   INTEGER,
    healthy_carriages INTEGER,
    open_issues       INTEGER
);
CREATE TABLE IF NOT EXISTS carriages (
    id            TEXT PRIMARY KEY,
    train_id      TEXT REFERENCES trains(id),
    serial_number TEXT,
    sequence      INTEGER,
    type          TEXT,
    health_status TEXT
);
CREATE INDEX IF NOT EXISTS idx_car_train ON carriages(train_id);
CREATE TABLE IF NOT EXISTS technicians (
    id        TEXT PRIMARY KEY,
    name      TEXT,
    specialty TEXT,
    available INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS issues (
    id              TEXT PRIMARY KEY,
    train_id        TEXT REFERENCES trains(id),
    carriage_id     TEXT REFERENCES carriages(id),
    system_category TEXT,
    title           TEXT,
    description     TEXT,
    priority        TEXT,
    status          TEXT,
    assignee_id     TEXT REFERENCES technicians(id),
    reported_at     TEXT,
    scheduled_date  TEXT,
    estimated_hours REAL
);
CREATE INDEX IF NOT EXISTS idx_iss_train    ON issues(train_id);
CREATE INDEX IF NOT EXISTS idx_iss_status   ON issues(status);
CREATE INDEX IF NOT EXISTS idx_iss_priority ON issues(priority);
CREATE TABLE IF NOT EXISTS _meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);
"""


def build(db_path: Path, json_path: Path, force: bool = False) -> None:
    if not json_path.exists():
        print(f"[build_db] ERROR: JSON not found at {json_path}", file=sys.stderr)
        sys.exit(1)

    json_mtime = json_path.stat().st_mtime

    # Skip rebuild if DB is already newer than JSON (unless --force)
    if not force and db_path.exists():
        db_mtime = db_path.stat().st_mtime
        if db_mtime >= json_mtime:
            print(f"[build_db] fleet.db is up-to-date ({db_path}). Use --force to rebuild.")
            return

    print(f"[build_db] Loading {json_path} …")
    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)

    db_path.unlink(missing_ok=True)  # remove stale DB
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.executescript(DDL)

    # trains
    trains = data.get("trains", [])
    for t in trains:
        m = t.get("metrics") or {}
        cur.execute(
            "INSERT OR REPLACE INTO trains VALUES (?,?,?,?,?,?,?,?,?,?)",
            (t.get("id"), t.get("name"), t.get("fleetType"), t.get("operationalState"),
             t.get("healthStatus"), t.get("currentLocation"),
             m.get("efficiency", 100), m.get("totalCarriages", 0),
             m.get("healthyCarriages", 0), m.get("openIssues", 0)),
        )
    print(f"[build_db]   {len(trains)} trains")

    # carriages
    total_c = 0
    for train_id, cars in data.get("carriages", {}).items():
        for c in cars:
            cur.execute(
                "INSERT OR REPLACE INTO carriages VALUES (?,?,?,?,?,?)",
                (c.get("id"), train_id, c.get("serialNumber"),
                 c.get("sequence"), c.get("type"), c.get("healthStatus")),
            )
            total_c += 1
    print(f"[build_db]   {total_c} carriages")

    # technicians
    techs = data.get("technicians", [])
    for t in techs:
        cur.execute(
            "INSERT OR REPLACE INTO technicians VALUES (?,?,?,?)",
            (t.get("id"), t.get("name"), t.get("specialty"), 1),
        )
    print(f"[build_db]   {len(techs)} technicians")

    # issues
    issues = data.get("issues", [])
    for i in issues:
        p = i.get("planning") or {}
        cur.execute(
            "INSERT OR REPLACE INTO issues VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (i.get("id"), i.get("trainId"), i.get("carriageId"),
             i.get("systemCategory"), i.get("title"), i.get("description"),
             i.get("priority"), i.get("status"), i.get("assigneeId"),
             p.get("reportedAt"), p.get("scheduledDate"), p.get("estimatedHours")),
        )
    print(f"[build_db]   {len(issues)} issues")

    # metadata
    import time
    cur.execute(
        "INSERT OR REPLACE INTO _meta VALUES (?,?)",
        ("built_at", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
    )
    cur.execute(
        "INSERT OR REPLACE INTO _meta VALUES (?,?)",
        ("source_json", str(json_path)),
    )

    conn.commit()
    conn.close()

    size_kb = db_path.stat().st_size // 1024
    print(f"[build_db] ✓ Written {db_path}  ({size_kb} KB)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build fleet SQLite DB from rail-data.json")
    parser.add_argument("--force", action="store_true", help="Rebuild even if DB is up-to-date")
    parser.add_argument("--out",   type=Path, default=_DB_PATH, help="Output .db path")
    parser.add_argument("--json",  type=Path, default=_JSON_PATH, help="Source JSON path")
    args = parser.parse_args()
    build(db_path=args.out, json_path=args.json, force=args.force)
