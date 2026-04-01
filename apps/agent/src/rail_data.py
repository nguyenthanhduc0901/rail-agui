"""Rail fleet tools â€” SQLite query + action tools.

TOOL SELECT:
  query_database                   <- ALL read queries via SQL (SELECT only)
  update_issue                     <- update single issue (status/priority)
  update_plan_step                 <- update a plan step status
  generate_maintenance_plan_stream <- streaming maintenance plan
  schedule_inspection              <- streaming inspection plan
  request_bulk_issue_status_update <- bulk update with human approval
"""

import asyncio
import json
import os
import random
import re
import sqlite3
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from langchain.tools import tool
from langchain_core.runnables import RunnableConfig
from langgraph.types import Command, interrupt
from copilotkit.langgraph import copilotkit_emit_state

_DB_FILE_PATH = Path(__file__).resolve().parents[1] / "fleet.db"

_ALLOWED_PRIORITIES     = {"low", "medium", "high", "critical"}
_ALLOWED_ISSUE_STATUSES = {"open", "in-progress", "resolved", "closed"}
_ALLOWED_STEP_STATUSES  = {"pending", "doing", "done"}
_MAX_PLAN_STEPS         = 12
_MAX_QUERY_ROWS         = 50

_SYSTEM_SPECIALIST: dict[str, list[str]] = {
    "HVAC":    ["HVAC", "Diagnostics", "Mechanics"],
    "Brakes":  ["Brake Systems", "Mechanics", "Safety Systems", "Diagnostics"],
    "Doors":   ["Doors & Access", "Structural", "Safety Systems", "Diagnostics"],
    "Power":   ["Power Systems", "Electronics", "Safety Systems", "Diagnostics"],
    "Network": ["Network", "Electronics", "Diagnostics"],
}
_ALL_SYSTEMS = list(_SYSTEM_SPECIALIST.keys())

_db_conn: sqlite3.Connection | None = None

_TECHNICIANS: list[tuple] = [
    ("TECH-01", "Gia Nguyen",     "Mechanics"),
    ("TECH-02", "Nhi Dang",       "Electronics"),
    ("TECH-03", "Linh Tran",      "HVAC"),
    ("TECH-04", "Minh Le",        "Power Systems"),
    ("TECH-05", "Bao Vu",         "Brake Systems"),
    ("TECH-06", "Phuc Do",        "Doors & Access"),
    ("TECH-07", "Sofia Martinez", "Network"),
    ("TECH-08", "Alex Chen",      "Structural"),
    ("TECH-09", "Raj Kumar",      "Diagnostics"),
    ("TECH-10", "Emma Wilson",    "Safety Systems"),
]

_TRAINS: list[tuple] = [
    ("T01", "Northline Express", "High-Speed", "in-service",  "Route 1A Northbound"),
    ("T02", "Delta Commuter",    "Commuter",   "in-service",  "Route 2B Southbound"),
    ("T03", "Harbor Intercity",  "Intercity",  "maintenance", "Northern Depot"),
    ("T04", "Metro Link",        "Commuter",   "in-service",  "Route 3C Eastbound"),
    ("T05", "East Freight",      "Freight",    "in-service",  "West Freight Yard"),
]
_PLAN_STEP_TEMPLATES: dict[str, list[str]] = {
    "HVAC":    ["Kiểm tra hệ thống điều hòa", "Vệ sinh bộ lọc khí", "Kiểm tra compressor", "Hiệu chỉnh nhiệt độ"],
    "Brakes":  ["Kiểm tra áp suất phanh", "Thay má phanh", "Hiệu chỉnh hệ thống ABS", "Kiểm tra dầu phanh"],
    "Doors":   ["Kiểm tra cơ cấu cửa", "Bôi trơn ray trượt", "Hiệu chỉnh cảm biến", "Kiểm tra khóa an toàn"],
    "Power":   ["Kiểm tra hệ thống điện", "Đo điện áp inverter", "Kiểm tra pin dự phòng", "Bảo dưỡng pantograph"],
    "Network": ["Kiểm tra kết nối mạng", "Cập nhật firmware", "Kiểm tra gateway", "Tối ưu tín hiệu RF"],
}
_CARRIAGE_TYPES = ["Passenger", "Cargo", "Service"]

_ISSUE_TITLES: dict[str, list[str]] = {
    "Brakes":  ["Brake Pressure Drift Detected", "Disc Wear Threshold Exceeded",
                "Regenerative Brake Mismatch", "Anti-Lock Brake Fault"],
    "HVAC":    ["Cabin Temperature Oscillation", "Compressor Cycle Instability",
                "Airflow Distribution Imbalance", "Refrigerant Leak Detected"],
    "Doors":   ["Door Actuator Response Delay", "Door Lock Sensor Mismatch",
                "Emergency Release Calibration Error", "Sliding Door Rail Wear"],
    "Power":   ["Auxiliary Power Voltage Sag", "Inverter Thermal Drift",
                "Battery Module Degradation", "Pantograph Contact Wear"],
    "Network": ["Telemetry Packet Loss Spike", "Onboard Gateway Timeout",
                "Train Control Link Interruption", "Radio Frequency Interference"],
}

_ISSUE_STATUSES = ["open", "in-progress", "resolved", "closed"]
_PRIORITIES     = ["low", "medium", "high", "critical"]
_EST_HOURS      = [1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 4.5, 6.0, 8.0]
_SERIAL_PFX     = {"Head": "LOC", "Power": "PWR", "Cargo": "CGO",
                   "Service": "SRV", "Passenger": "PAS"}


def _seed_db(db: sqlite3.Connection, rng: random.Random) -> None:
    """Create schema and populate demo data into a fresh DB."""
    cur = db.cursor()
    cur.executescript("""
        CREATE TABLE trains (
            id                TEXT PRIMARY KEY,
            name              TEXT NOT NULL,
            fleet_type        TEXT NOT NULL,
            operational_state TEXT NOT NULL,
            current_location  TEXT NOT NULL
        );
        CREATE TABLE carriages (
            id            TEXT PRIMARY KEY,
            train_id      TEXT NOT NULL REFERENCES trains(id),
            serial_number TEXT NOT NULL,
            sequence      INTEGER NOT NULL,
            type          TEXT NOT NULL
        );
        CREATE INDEX idx_car_train ON carriages(train_id);
        CREATE TABLE technicians (
            id        TEXT PRIMARY KEY,
            name      TEXT NOT NULL,
            specialty TEXT NOT NULL
        );
        CREATE TABLE issues (
            id                    TEXT PRIMARY KEY,
            carriage_id           TEXT NOT NULL REFERENCES carriages(id),
            system_category       TEXT NOT NULL,
            title                 TEXT NOT NULL,
            description           TEXT,
            priority              TEXT NOT NULL,
            status                TEXT NOT NULL,
            reported_at           TEXT NOT NULL,
            scheduled_date        TEXT,
            total_estimated_hours REAL
        );
        CREATE INDEX idx_iss_carriage ON issues(carriage_id);
        CREATE INDEX idx_iss_status   ON issues(status);
        CREATE INDEX idx_iss_priority ON issues(priority);
        CREATE TABLE plan_steps (
            id              TEXT PRIMARY KEY,
            issue_id        TEXT REFERENCES issues(id),
            technician_id   TEXT REFERENCES technicians(id),
            seq_order       INTEGER NOT NULL,
            title           TEXT NOT NULL,
            estimated_hours REAL,
            status          TEXT NOT NULL DEFAULT 'pending'
        );
        CREATE INDEX idx_ps_issue ON plan_steps(issue_id);
    """)

    cur.executemany("INSERT INTO technicians VALUES (?,?,?)", _TECHNICIANS)

    issue_seq = 1001
    plan_step_seq = 1
    epoch     = datetime(2026, 2, 1, tzinfo=timezone.utc)
    all_issues: list[tuple] = []

    for train_id, name, fleet_type, op_state, location in _TRAINS:
        cur.execute("INSERT INTO trains VALUES (?,?,?,?,?)",
                    (train_id, name, fleet_type, op_state, location))

        car_count = 5
        for i in range(1, car_count + 1):
            ctype = "Head" if i == 1 else "Power" if i == car_count else rng.choice(_CARRIAGE_TYPES)
            cid   = f"C{i:02d}-{train_id}"
            sn    = (f"{_SERIAL_PFX.get(ctype, 'PAS')}-"
                     f"{rng.randint(1000, 9999)}-{chr(65 + rng.randint(0, 3))}")
            cur.execute("INSERT INTO carriages VALUES (?,?,?,?,?)",
                        (cid, train_id, sn, i, ctype))

            for _ in range(rng.randint(1, 4)):
                sys_  = rng.choice(_ALL_SYSTEMS)
                pri_  = rng.choices(_PRIORITIES, weights=[0.20, 0.40, 0.28, 0.12])[0]
                stat_ = rng.choices(_ISSUE_STATUSES, weights=[0.50, 0.22, 0.14, 0.14])[0]
                ttl_  = rng.choice(_ISSUE_TITLES[sys_])
                iid   = f"ISS-{issue_seq}"
                issue_seq += 1

                rep   = epoch + timedelta(days=rng.randint(0, 50), hours=rng.randint(6, 22))
                sched: str | None = None
                if stat_ in ("closed", "resolved"):
                    sched = (rep + timedelta(days=rng.randint(2, 7))).isoformat()
                elif rng.random() < 0.6:
                    sched = (epoch + timedelta(days=60 + rng.randint(1, 14))).isoformat()

                desc = (f"{ttl_} detected on {cid} ({sys_}). "
                        f"Telemetry deviation observed across multiple sampling windows. "
                        f"Priority: {pri_}.")
                est_hours = rng.choice(_EST_HOURS)
                cur.execute(
                    "INSERT INTO issues VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (iid, cid, sys_, ttl_, desc, pri_, stat_,
                     rep.isoformat(), sched, est_hours),
                )
                all_issues.append((iid, sys_, stat_, est_hours))

    for issue_id, system_category, status, total_hours in all_issues:
        if status in ("open", "in-progress"):
            num_steps = rng.randint(2, 4)
        elif status == "resolved":
            num_steps = rng.randint(1, 3)
        else:
            num_steps = rng.randint(1, 2)
        
        specialties = _SYSTEM_SPECIALIST.get(system_category, ["Diagnostics"])
        step_templates = _PLAN_STEP_TEMPLATES.get(system_category, ["Kiểm tra tổng quát", "Sửa chữa", "Kiểm tra lại"])
        
        for step_idx in range(num_steps):
            step_id = f"STEP-{plan_step_seq:04d}"
            plan_step_seq += 1
            
            matching_techs = [t for t in _TECHNICIANS if t[2] in specialties]
            if matching_techs:
                tech = rng.choice(matching_techs)
                tech_id = tech[0]
            else:
                tech_id = rng.choice(_TECHNICIANS)[0]
            
            step_title = step_templates[step_idx % len(step_templates)]
            
            step_hours = round(total_hours / num_steps + rng.uniform(-0.5, 0.5), 1)
            step_hours = max(0.5, step_hours)
            
            if status == "closed":
                step_status = "done"
            elif status == "resolved":
                step_status = rng.choice(["done", "done", "doing"])
            elif status == "in-progress":
                step_status = rng.choice(["done", "doing", "pending"])
            else:
                step_status = "pending"
            
            cur.execute(
                "INSERT INTO plan_steps (id, issue_id, technician_id, seq_order, title, estimated_hours, status) "
                "VALUES (?,?,?,?,?,?,?)",
                (step_id, issue_id, tech_id, step_idx + 1, step_title, step_hours, step_status)
            )

    db.commit()


def _get_db() -> sqlite3.Connection:
    """Return the fleet SQLite connection (singleton per process).
    Creates and seeds fleet.db on first use if it does not already exist.
    """
    global _db_conn
    if _db_conn is not None:
        return _db_conn

    is_new = not _DB_FILE_PATH.exists()
    conn   = sqlite3.connect(str(_DB_FILE_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")

    if is_new:
        _seed_db(conn, random.Random(20260330))

    _db_conn = conn
    return conn


def _norm(v: str) -> str:
    return (v or "").strip()

def _norm_priority(v: str) -> str:
    n = _norm(v).lower()
    return n if n in _ALLOWED_PRIORITIES else ""

def _norm_issue_status(v: str) -> str:
    n = _norm(v).lower()
    return n if n in _ALLOWED_ISSUE_STATUSES else ""

def _norm_train_id(v: str) -> str:
    return _norm(v).upper()

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


@tool
def query_database(sql: str) -> str:
    """
    Execute a read-only SQL SELECT against the fleet SQLite database.
    Returns up to 50 rows as a JSON string. Use this for ALL data-lookup needs.

    DATABASE SCHEMA:
      trains(id, name, fleet_type, operational_state, current_location)
      carriages(id, train_id, serial_number, sequence, type)
      technicians(id, name, specialty)
      issues(id, carriage_id, system_category, title, description,
             priority, status, reported_at, scheduled_date, total_estimated_hours)
             priority: low | medium | high | critical
             status:   open | in-progress | resolved | closed
      plan_steps(id, issue_id, technician_id, seq_order, title,
                 estimated_hours, status)
                 status: pending | doing | done

    IMPORTANT: issues do NOT have train_id. Join through carriages to filter by train.

    EXAMPLE QUERIES:
      -- Count issues by status
      SELECT status, COUNT(*) AS cnt FROM issues GROUP BY status

      -- All active issues for train T01
      SELECT i.id, i.carriage_id, i.system_category, i.title, i.priority, i.status
      FROM issues i JOIN carriages c ON c.id = i.carriage_id
      WHERE c.train_id = 'T01' AND i.status NOT IN ('resolved','closed')
      ORDER BY i.priority DESC

      -- Overdue issues (scheduled past, not yet resolved/closed)
      SELECT i.id, c.train_id, i.title, i.priority, i.scheduled_date
      FROM issues i JOIN carriages c ON c.id = i.carriage_id
      WHERE i.status NOT IN ('resolved','closed') AND i.scheduled_date < date('now')
      ORDER BY i.scheduled_date LIMIT 10

      -- Technician workload (active plan steps)
      SELECT t.name, t.specialty, COUNT(ps.id) AS active_steps
      FROM technicians t
      LEFT JOIN plan_steps ps ON ps.technician_id = t.id AND ps.status != 'done'
      GROUP BY t.id ORDER BY active_steps DESC

      -- Risk ranking by train
      SELECT c.train_id,
             SUM(CASE WHEN i.priority='critical' THEN 4
                      WHEN i.priority='high'     THEN 2
                      WHEN i.priority='medium'   THEN 1 ELSE 0 END) AS risk_score
      FROM issues i JOIN carriages c ON c.id = i.carriage_id
      WHERE i.status NOT IN ('resolved','closed')
      GROUP BY c.train_id ORDER BY risk_score DESC

    SAFETY: Only SELECT / WITH are permitted. No mutations.
    """
    clean = sql.strip()
    upper = clean.upper().lstrip()
    if not (upper.startswith("SELECT") or upper.startswith("WITH")):
        return json.dumps({"error": "Only SELECT queries are allowed."})
    for kw in ("DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "CREATE", "ATTACH", "PRAGMA"):
        if re.search(r'\b' + kw + r'\b', upper):
            return json.dumps({"error": f"Keyword '{kw}' is not permitted."})
    try:
        cur = _get_db().cursor()
        cur.execute(clean)
        cols = [d[0] for d in cur.description] if cur.description else []
        rows = [dict(zip(cols, r)) for r in cur.fetchmany(_MAX_QUERY_ROWS)]
        return json.dumps(rows, ensure_ascii=False, default=str)
    except sqlite3.Error as e:
        return json.dumps({"error": f"SQL error: {e}"})


@tool
def update_issue(
    issue_id: str,
    status: str = "",
    priority: str = "",
) -> dict[str, Any]:
    """
    Update a single issue: change status and/or priority.
    status:   open | in-progress | resolved | closed
    priority: low | medium | high | critical
    Use for single-issue updates only. For bulk use request_bulk_issue_status_update.
    """
    iid      = _norm(issue_id).upper()
    new_stat = _norm_issue_status(status)  or None
    new_pri  = _norm_priority(priority)    or None

    if not any([new_stat, new_pri]):
        return {"error": "Provide at least one of: status, priority."}

    db  = _get_db()
    row = db.execute("SELECT * FROM issues WHERE id = ?", (iid,)).fetchone()
    if not row:
        return {"error": f"Issue '{iid}' not found."}
    current = dict(row)

    final_stat = new_stat or current["status"]
    final_pri  = new_pri  or current["priority"]

    changes: list[str] = []
    if new_stat and current["status"]   != new_stat: changes.append(f"status â†’ {new_stat}")
    if new_pri  and current["priority"] != new_pri:  changes.append(f"priority â†’ {new_pri}")

    if not changes:
        return {"message": f"Issue {iid} is already in the requested state."}

    db.execute("UPDATE issues SET status=?, priority=? WHERE id=?",
               (final_stat, final_pri, iid))
    db.commit()
    return {"success": True, "issueId": iid, "changes": changes,
            "current": {"status": final_stat, "priority": final_pri}}


@tool
async def generate_maintenance_plan_stream(
    config: RunnableConfig,
    train_id: str = "",
    system: str = "",
    priority: str = "high",
    max_steps: int = 8,
) -> dict[str, Any]:
    """
    Generate and STREAM a prioritized maintenance plan from real open issues.
    Each step shows: order, title, details, estimatedHours, assigned technician.
    Streams step-by-step live in the chat panel.
    train_id / system: optional scope filters.
    priority: issue priority to pull â€” use 'critical' or 'high' for urgent work.
    max_steps: 1-12 (default: 8).
    """
    cap  = max(1, min(max_steps, _MAX_PLAN_STEPS))
    tid  = _norm_train_id(train_id) or None
    sys_ = _norm(system) or None
    pri_ = _norm_priority(priority) or "high"

    db  = _get_db()
    cur = db.cursor()


    where: list[str] = ["i.status = 'open'", "i.priority = ?"]
    params: list[Any] = [pri_]
    if tid:
        where.append("c.train_id = ?")
        params.append(tid)
    if sys_:
        where.append("i.system_category = ?")
        params.append(sys_)
    params.append(cap)

    cur.execute(
        "SELECT i.id, c.train_id, i.carriage_id, i.system_category, "
        "i.title, i.total_estimated_hours "
        "FROM issues i JOIN carriages c ON c.id = i.carriage_id "
        "WHERE " + " AND ".join(where) +
        " ORDER BY i.scheduled_date ASC LIMIT ?",
        params,
    )
    candidates = [dict(r) for r in cur.fetchall()]

    if not candidates:
        await copilotkit_emit_state(config, {"maintenancePlan": [], "agentProgress": []})
        return {"summary": "No matching open issues found.", "stepCount": 0, "totalHours": 0}

    cur.execute(
        "SELECT technician_id, COUNT(*) AS cnt FROM plan_steps "
        "WHERE status != 'done' AND technician_id IS NOT NULL GROUP BY technician_id"
    )
    wl: dict[str, int] = {r["technician_id"]: r["cnt"] for r in cur.fetchall()}

    cur.execute("SELECT id, name, specialty FROM technicians")
    all_techs = [dict(r) for r in cur.fetchall()]

    assigned: set[str] = set()
    steps: list[dict] = []
    batch_id = _now_utc().strftime("%Y%m%d%H%M%S")

    # Initialise progress steps (one per candidate issue)
    progress_steps: list[dict] = [
        {
            "id": f"prog-{i+1}",
            "description": f"Phân tích {c['carriage_id']} — {c.get('system_category', '')}: {c.get('title', '')}",
            "status": "pending",
        }
        for i, c in enumerate(candidates)
    ]
    await copilotkit_emit_state(config, {"maintenancePlan": steps, "agentProgress": progress_steps})

    for order, issue in enumerate(candidates, start=1):
        # Mark current step as "doing"
        progress_steps[order - 1]["status"] = "doing"
        await copilotkit_emit_state(config, {"maintenancePlan": steps, "agentProgress": progress_steps})

        sys_name = issue.get("system_category", "")
        pref     = _SYSTEM_SPECIALIST.get(sys_name, ["Diagnostics"])
        tech_candidates = sorted(
            [(pref.index(t["specialty"]) if t["specialty"] in pref else 99,
              wl.get(t["id"], 0), t["id"], t)
             for t in all_techs if t["id"] not in assigned],
            key=lambda x: (x[0], x[1]),
        )
        tech = tech_candidates[0][3] if tech_candidates else None
        if tech:
            assigned.add(tech["id"])

        steps.append({
            "id":             f"PLAN-{batch_id}-{order}",
            "order":          order,
            "title":          f"{issue['train_id']} > {issue['carriage_id']} — {sys_name}: {issue.get('title', 'Untitled')}",
            "status":         "pending",
            "estimatedHours": issue.get("total_estimated_hours") or 2.0,
            "technicianId":   tech["id"]   if tech else "",
            "technicianName": tech["name"] if tech else "Unassigned",
            "issueId":        issue["id"],
            "carriageId":     issue["carriage_id"],
            "trainId":        issue["train_id"],
        })
        progress_steps[order - 1]["status"] = "done"
        await asyncio.sleep(0.12)
        await copilotkit_emit_state(config, {"maintenancePlan": steps, "agentProgress": progress_steps})

    total_hours = round(sum(s["estimatedHours"] for s in steps), 1)

    # Clear progress after completion
    await asyncio.sleep(0.5)
    await copilotkit_emit_state(config, {"maintenancePlan": steps, "agentProgress": []})


    db.execute("DELETE FROM plan_steps")
    db.executemany(
        "INSERT INTO plan_steps (id, issue_id, technician_id, seq_order, "
        "title, estimated_hours, status) VALUES (?,?,?,?,?,?,?)",
        [(s["id"], candidates[i]["id"],
          s["technicianId"] or None,
          s["order"], s["title"],
          s["estimatedHours"], s["status"])
         for i, s in enumerate(steps)],
    )
    db.commit()

    return {"summary": f"Created {len(steps)} steps, est. {total_hours}h.",
            "stepCount": len(steps), "totalHours": total_hours}


@tool
async def schedule_inspection(
    config: RunnableConfig,
    train_id: str,
    systems: list[str],
    note: str = "",
) -> dict[str, Any]:
    """
    Schedule a targeted inspection for specific systems on one train.
    Creates streaming plan steps â€” one per system, all starting as 'pending'.
    systems: list from HVAC | Brakes | Doors | Power | Network
    """
    tid = _norm_train_id(train_id)
    db  = _get_db()
    cur = db.cursor()

    cur.execute("SELECT id, name FROM trains WHERE id = ?", (tid,))
    train_row = cur.fetchone()
    if not train_row:
        return {"error": f"Train '{tid}' not found."}

    valid_sys = [s for s in systems if s in _SYSTEM_SPECIALIST]
    if not valid_sys:
        return {"error": f"Invalid systems. Supported: {_ALL_SYSTEMS}"}

    cur.execute(
        "SELECT technician_id, COUNT(*) AS cnt FROM plan_steps "
        "WHERE status != 'done' AND technician_id IS NOT NULL GROUP BY technician_id"
    )
    wl: dict[str, int] = {r["technician_id"]: r["cnt"] for r in cur.fetchall()}

    cur.execute("SELECT id, name, specialty FROM technicians")
    all_techs = [dict(r) for r in cur.fetchall()]

    assigned: set[str] = set()
    steps: list[dict] = []
    batch_id = f"INSP-{tid}-{_now_utc().strftime('%Y%m%d%H%M%S')}"

    # Initialise progress steps (one per system)
    progress_steps: list[dict] = [
        {
            "id": f"insp-prog-{i+1}",
            "description": f"Lập lịch kiểm tra hệ thống {sys_name} — {tid}",
            "status": "pending",
        }
        for i, sys_name in enumerate(valid_sys)
    ]
    await copilotkit_emit_state(config, {"maintenancePlan": steps, "agentProgress": progress_steps})

    for order, sys_name in enumerate(valid_sys, start=1):
        progress_steps[order - 1]["status"] = "doing"
        await copilotkit_emit_state(config, {"maintenancePlan": steps, "agentProgress": progress_steps})

        cur.execute(
            "SELECT i.total_estimated_hours FROM issues i "
            "JOIN carriages c ON c.id = i.carriage_id "
            "WHERE c.train_id = ? AND i.system_category = ? AND i.status = 'open' LIMIT 3",
            (tid, sys_name),
        )
        open_rows  = cur.fetchall()
        open_count = len(open_rows)
        h = round(sum(r["total_estimated_hours"] or 0 for r in open_rows) or 2.0, 1)

        pref = _SYSTEM_SPECIALIST.get(sys_name, ["Diagnostics"])
        tech_candidates = sorted(
            [(pref.index(t["specialty"]) if t["specialty"] in pref else 99,
              wl.get(t["id"], 0), t["id"], t)
             for t in all_techs if t["id"] not in assigned],
            key=lambda x: (x[0], x[1]),
        )
        tech = tech_candidates[0][3] if tech_candidates else None
        if tech:
            assigned.add(tech["id"])

        note_suffix = f" | {note}" if note else f" ({open_count} sự cố)"
        steps.append({
            "id":             f"{batch_id}-{order}",
            "order":          order,
            "title":          f"[Kiểm tra] {tid} — {sys_name}{note_suffix}",
            "status":         "pending",
            "estimatedHours": h,
            "technicianId":   tech["id"]   if tech else "",
            "technicianName": tech["name"] if tech else "Unassigned",
            "issueId":        "",
            "carriageId":     "",
            "trainId":        tid,
        })
        progress_steps[order - 1]["status"] = "done"
        await asyncio.sleep(0.18)
        await copilotkit_emit_state(config, {"maintenancePlan": steps, "agentProgress": progress_steps})

    total_hours = round(sum(s["estimatedHours"] for s in steps), 1)
    train_name  = dict(train_row)["name"]

    # Clear progress after completion
    await asyncio.sleep(0.5)
    await copilotkit_emit_state(config, {"maintenancePlan": steps, "agentProgress": []})

    db.execute("DELETE FROM plan_steps")
    db.executemany(
        "INSERT INTO plan_steps (id, issue_id, technician_id, seq_order, "
        "title, estimated_hours, status) VALUES (?,?,?,?,?,?,?)",
        [(s["id"], None, s["technicianId"] or None,
          s["order"], s["title"],
          s["estimatedHours"], s["status"])
         for s in steps],
    )
    db.commit()

    return {
        "summary":   f"Inspection plan: {len(steps)} systems on {train_name}, {total_hours}h.",
        "trainId":   tid, "trainName": train_name,
        "stepCount": len(steps), "totalHours": total_hours, "systems": valid_sys,
    }


@tool
def update_plan_step(step_id: str, status: str) -> dict[str, Any]:
    """
    Update the status of a maintenance plan step.
    step_id: the step ID (e.g. PLAN-20260330120000-1)
    status:  pending | doing | done
    """
    sid     = _norm(step_id)
    new_sta = status.strip().lower()
    if new_sta not in _ALLOWED_STEP_STATUSES:
        return {"error": f"Invalid status '{status}'. Use: pending, doing, done"}

    db  = _get_db()
    row = db.execute("SELECT id FROM plan_steps WHERE id = ?", (sid,)).fetchone()
    if not row:
        return {"error": f"Plan step '{sid}' not found. Use query_database to list steps."}

    db.execute("UPDATE plan_steps SET status = ? WHERE id = ?", (new_sta, sid))
    db.commit()
    return {"success": True, "stepId": sid, "status": new_sta}


@tool
def request_bulk_issue_status_update(
    priority: str = "high",
    target_status: str = "in-progress",
    train_id: str = "",
) -> dict[str, Any]:
    """
    Request human approval before bulk-updating open issues to a new status.
    ALWAYS triggers a human-in-the-loop approval dialog â€” never skips this.
    priority:      low | medium | high | critical
    target_status: in-progress | resolved | closed
    train_id:      optional (empty = all trains)
    """
    tid      = _norm_train_id(train_id)
    pri_     = _norm_priority(priority)
    tgt_sta_ = _norm_issue_status(target_status) or "in-progress"
    if tgt_sta_ not in ("in-progress", "resolved", "closed"):
        return {"approved": False, "count": 0,
                "message": f"Invalid target_status '{tgt_sta_}'. Use: in-progress | resolved | closed"}

    db = _get_db()
    conditions: list[str] = ["i.status = 'open'"]
    params_q: list[Any] = []
    if pri_:
        conditions.append("i.priority = ?")
        params_q.append(pri_)
    if tid:
        conditions.append("c.train_id = ?")
        params_q.append(tid)

    cur = db.execute(
        "SELECT i.id FROM issues i JOIN carriages c ON c.id = i.carriage_id "
        "WHERE " + " AND ".join(conditions),
        params_q,
    )
    target_ids = {r["id"] for r in cur.fetchall()}

    if not target_ids:
        return {"approved": False, "count": 0, "message": "No matching open issues."}

    approval = interrupt({
        "type":         "bulk_issue_update_approval",
        "priority":     priority,
        "targetStatus": tgt_sta_,
        "trainId":      tid or "all",
        "count":        len(target_ids),
    })

    approved = bool(isinstance(approval, dict) and approval.get("approved"))
    if approved:
        db.executemany("UPDATE issues SET status=? WHERE id=?",
                       [(tgt_sta_, iid) for iid in target_ids])
        db.commit()
        message = f"Updated {len(target_ids)} issues to '{tgt_sta_}'."
    else:
        message = "Bulk update rejected by user."

    return {"approved": approved, "count": len(target_ids),
            "targetStatus": tgt_sta_, "message": message}


@tool
async def generate_issue_report(report: str, config: RunnableConfig) -> str:
    """
    Write or update the issue report document. Use markdown formatting extensively.

    REPORT STRUCTURE (always include ALL sections):
    # Báo cáo Sự cố — [Tên tàu / Toa / Hệ thống]
    **Ngày lập:** [date]  **Người lập:** Trợ lý AI

    ## 1. Tóm tắt
    Brief executive summary of the situation.

    ## 2. Danh sách Sự cố
    | ID | Hệ thống | Tiêu đề | Mức độ | Trạng thái | Giờ ước tính |
    |---|---|---|---|---|---|
    ...rows...

    ## 3. Phân công Kỹ thuật viên
    List each technician and their assigned issues/steps.

    ## 4. Ước tính Chi phí & Thời gian
    Total hours, estimated labor cost (150k VND/hour), parts notes.

    ## 5. Khuyến nghị
    Prioritized action items.

    RULES:
    - You MUST write the FULL report even when only changing a few words.
    - Do NOT repeat the report content in your text message — just summarize changes in 1-2 sentences.
    - Use markdown tables for issue lists.
    - Call query_database first to get accurate data before writing the report.
    """
    await copilotkit_emit_state(config, {"issueReport": report})
    return "Report saved."





rail_tools = [
    query_database,
    update_issue,
    update_plan_step,
    generate_maintenance_plan_stream,
    schedule_inspection,
    request_bulk_issue_status_update,
    generate_issue_report,
]
