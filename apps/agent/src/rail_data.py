"""Rail fleet tools — SQLite query + action tools.

TOOL SELECT:
  query_database                   <- ALL read queries via SQL (SELECT only)
  update_issue                     <- update single issue
  generate_maintenance_plan_stream <- streaming maintenance plan
  schedule_inspection              <- streaming inspection plan
  request_bulk_issue_status_update <- bulk update with human approval
"""

import asyncio
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from langchain.tools import tool
from langchain_core.runnables import RunnableConfig
from langgraph.types import interrupt
from copilotkit.langgraph import copilotkit_emit_state

# -- Path & env ----------------------------------------------------------------
_DATA_PATH = (
    Path(__file__).resolve().parents[2]
    / "app" / "src" / "features" / "rail-dashboard" / "data" / "rail-data.json"
)
_TOOL_DEBUG = os.getenv("AGENT_TOOL_DEBUG", "0") == "1"

# -- Constants -----------------------------------------------------------------
_ALLOWED_PRIORITIES = {"high", "medium", "low"}
_ALLOWED_STATUSES   = {"open", "in-progress", "closed"}
_MAX_PLAN_STEPS     = 12
_MAX_QUERY_ROWS     = 50

_SYSTEM_SPECIALIST: dict[str, list[str]] = {
    "HVAC":    ["HVAC", "Diagnostics", "Mechanics"],
    "Brakes":  ["Brake Systems", "Mechanics", "Safety Systems", "Diagnostics"],
    "Doors":   ["Doors & Access", "Structural", "Safety Systems", "Diagnostics"],
    "Power":   ["Power Systems", "Electronics", "Safety Systems", "Diagnostics"],
    "Network": ["Network", "Electronics", "Diagnostics"],
}
_ALL_SYSTEMS = list(_SYSTEM_SPECIALIST.keys())

# -- Lazy state ----------------------------------------------------------------
_rail_data: dict[str, Any] | None = None
_db_conn:   sqlite3.Connection | None = None


def _get_rail_data() -> dict[str, Any]:
    global _rail_data
    if _rail_data is None:
        with open(_DATA_PATH, encoding="utf-8") as f:
            _rail_data = json.load(f)
    return _rail_data


def _get_db() -> sqlite3.Connection:
    """Return (or lazily build) the in-memory SQLite fleet database."""
    global _db_conn
    if _db_conn is not None:
        return _db_conn

    data = _get_rail_data()
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.executescript("""
        CREATE TABLE trains (
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
        CREATE TABLE carriages (
            id            TEXT PRIMARY KEY,
            train_id      TEXT REFERENCES trains(id),
            serial_number TEXT,
            sequence      INTEGER,
            type          TEXT,
            health_status TEXT
        );
        CREATE INDEX idx_car_train ON carriages(train_id);
        CREATE TABLE technicians (
            id        TEXT PRIMARY KEY,
            name      TEXT,
            specialty TEXT,
            available INTEGER DEFAULT 1
        );
        CREATE TABLE issues (
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
        CREATE INDEX idx_iss_train    ON issues(train_id);
        CREATE INDEX idx_iss_status   ON issues(status);
        CREATE INDEX idx_iss_priority ON issues(priority);
    """)

    for t in data.get("trains", []):
        m = t.get("metrics") or {}
        cur.execute(
            "INSERT OR IGNORE INTO trains VALUES (?,?,?,?,?,?,?,?,?,?)",
            (t.get("id"), t.get("name"), t.get("fleetType"), t.get("operationalState"),
             t.get("healthStatus"), t.get("currentLocation"),
             m.get("efficiency", 100), m.get("totalCarriages", 0),
             m.get("healthyCarriages", 0), m.get("openIssues", 0)),
        )

    for train_id, cars in data.get("carriages", {}).items():
        for c in cars:
            cur.execute(
                "INSERT OR IGNORE INTO carriages VALUES (?,?,?,?,?,?)",
                (c.get("id"), train_id, c.get("serialNumber"),
                 c.get("sequence"), c.get("type"), c.get("healthStatus")),
            )

    for t in data.get("technicians", []):
        cur.execute(
            "INSERT OR IGNORE INTO technicians VALUES (?,?,?,?)",
            (t.get("id"), t.get("name"), t.get("specialty"), 1),
        )

    for i in data.get("issues", []):
        p = i.get("planning") or {}
        cur.execute(
            "INSERT OR IGNORE INTO issues VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (i.get("id"), i.get("trainId"), i.get("carriageId"),
             i.get("systemCategory"), i.get("title"), i.get("description"),
             i.get("priority"), i.get("status"), i.get("assigneeId"),
             p.get("reportedAt"), p.get("scheduledDate"), p.get("estimatedHours")),
        )

    conn.commit()
    _db_conn = conn
    return conn


# -- Utility helpers -----------------------------------------------------------
def _norm(v: str) -> str:            return (v or "").strip()
def _norm_priority(v: str) -> str:   n = _norm(v).lower(); return n if n in _ALLOWED_PRIORITIES else ""
def _norm_status(v: str) -> str:     n = _norm(v).lower(); return n if n in _ALLOWED_STATUSES   else ""
def _norm_train_id(v: str) -> str:   return _norm(v).upper()
def _now_utc() -> datetime:          return datetime.now(timezone.utc)


def _days_until(s: str) -> int | None:
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return int((_now_utc() - d.astimezone(timezone.utc)).total_seconds() / -86400)
    except Exception:
        return None


def _log(name: str, **kw: Any) -> None:
    if not _TOOL_DEBUG:
        return
    print(f"[agent-tool] {name}",
          {k: v for k, v in kw.items() if isinstance(v, (str, int, float, bool, type(None)))})


def _get_issues()                      -> list[dict[str, Any]]: return _get_rail_data().get("issues", [])
def _get_trains()                      -> list[dict[str, Any]]: return _get_rail_data().get("trains", [])
def _get_technicians()                 -> list[dict[str, Any]]: return _get_rail_data().get("technicians", [])
def _get_carriages_for_train(tid: str) -> list[dict[str, Any]]: return _get_rail_data().get("carriages", {}).get(tid, [])


def _get_technician_by_id(tid: str) -> dict[str, Any] | None:
    return next((t for t in _get_technicians() if t.get("id") == tid), None) if tid else None


def _filter_issues(
    train_id: str | None = None,
    carriage_id: str | None = None,
    system: str | None = None,
    priority: str | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    def ok(i: dict) -> bool:
        if train_id    and i.get("trainId")        != train_id:    return False
        if carriage_id and i.get("carriageId")     != carriage_id: return False
        if system      and i.get("systemCategory") != system:      return False
        if priority    and i.get("priority")       != priority:    return False
        if status      and i.get("status")         != status:      return False
        return True
    result = [i for i in _get_issues() if ok(i)]
    result.sort(key=lambda i: (i.get("planning") or {}).get("reportedAt", ""), reverse=True)
    return result


def _compute_technician_workload() -> list[dict[str, Any]]:
    wl: dict[str, dict] = {
        t["id"]: {"technicianId": t["id"], "name": t["name"], "specialty": t["specialty"],
                  "open": 0, "inProgress": 0, "estimatedHours": 0.0, "trains": set()}
        for t in _get_technicians()
    }
    for issue in _get_issues():
        aid = issue.get("assigneeId") or ""
        if aid not in wl or issue.get("status") == "closed":
            continue
        if issue.get("status") == "open":          wl[aid]["open"] += 1
        elif issue.get("status") == "in-progress": wl[aid]["inProgress"] += 1
        wl[aid]["estimatedHours"] += (issue.get("planning") or {}).get("estimatedHours", 0)
        wl[aid]["trains"].add(issue.get("trainId", ""))
    rows = [{
        "technicianId": e["technicianId"], "name": e["name"], "specialty": e["specialty"],
        "openIssues": e["open"], "inProgressIssues": e["inProgress"],
        "totalActiveIssues": e["open"] + e["inProgress"],
        "estimatedHours": round(e["estimatedHours"], 1),
        "affectedTrains": sorted(e["trains"]),
    } for e in wl.values()]
    rows.sort(key=lambda x: -x["totalActiveIssues"])
    return rows


def _best_tech_for_system(
    system: str,
    exclude_ids: set[str] | None = None,
    workload_snapshot: dict[str, int] | None = None,
) -> dict[str, Any] | None:
    techs = {t["id"]: t for t in _get_technicians()}
    excl  = exclude_ids or set()
    pref  = _SYSTEM_SPECIALIST.get(system, ["Diagnostics"])
    if workload_snapshot is None:
        wl: dict[str, int] = {tid: 0 for tid in techs}
        for issue in _get_issues():
            if issue.get("status") in ("open", "in-progress"):
                aid = issue.get("assigneeId")
                if aid and aid in wl:
                    wl[aid] += 1
    else:
        wl = workload_snapshot
    candidates = [
        (pref.index(t["specialty"]) if t["specialty"] in pref else 99, wl.get(tid, 0), tid, t)
        for tid, t in techs.items() if tid not in excl
    ]
    candidates.sort(key=lambda x: (x[0], x[1]))
    return candidates[0][3] if candidates else None


# ========================= QUERY TOOL =========================================

@tool
def query_database(sql: str) -> str:
    """
    Execute a read-only SQL SELECT against the in-memory SQLite fleet database.
    Returns up to 50 rows as a JSON string. Use this for ALL data-lookup needs.

    DATABASE SCHEMA:
      trains(id, name, fleet_type, operational_state, health_status,
             current_location, efficiency, total_carriages, healthy_carriages, open_issues)
      carriages(id, train_id, serial_number, sequence, type, health_status)
      technicians(id, name, specialty, available)
      issues(id, train_id, carriage_id, system_category, title, description,
             priority, status, assignee_id, reported_at, scheduled_date, estimated_hours)

    EXAMPLE QUERIES:
      -- Fleet KPIs
      SELECT health_status, COUNT(*) AS cnt FROM trains GROUP BY health_status

      -- Count open high-priority issues
      SELECT COUNT(*) AS count FROM issues WHERE status='open' AND priority='high'

      -- Full issue list for a train
      SELECT id, carriage_id, system_category, title, priority, status
      FROM issues WHERE train_id='T01' AND status!='closed' ORDER BY priority DESC

      -- Overdue issues (scheduled_date in the past)
      SELECT id, train_id, title, priority, scheduled_date
      FROM issues WHERE status!='closed' AND scheduled_date < date('now')
      ORDER BY scheduled_date LIMIT 10

      -- Technician workload
      SELECT t.name, t.specialty,
             SUM(CASE WHEN i.status='open'        THEN 1 ELSE 0 END) AS open_cnt,
             SUM(CASE WHEN i.status='in-progress' THEN 1 ELSE 0 END) AS wip_cnt
      FROM technicians t
      LEFT JOIN issues i ON t.id=i.assignee_id AND i.status!='closed'
      GROUP BY t.id ORDER BY open_cnt DESC

      -- Risk ranking (critical carriages x3 + high-open x2 + efficiency gap x0.2)
      SELECT t.id, t.name,
             SUM(CASE WHEN c.health_status='critical' THEN 3 ELSE 0 END)
             + SUM(CASE WHEN i.priority='high' AND i.status='open' THEN 2 ELSE 0 END)
             + (100 - t.efficiency) * 0.2 AS risk_score
      FROM trains t
      LEFT JOIN carriages c ON c.train_id=t.id
      LEFT JOIN issues    i ON i.train_id=t.id
      GROUP BY t.id ORDER BY risk_score DESC LIMIT 5

    SAFETY: Only SELECT / WITH are permitted. No mutations.
    """
    clean = sql.strip()
    upper = clean.upper().lstrip()
    if not (upper.startswith("SELECT") or upper.startswith("WITH")):
        return json.dumps({"error": "Only SELECT queries are allowed."})
    for kw in ("DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "CREATE", "ATTACH", "PRAGMA"):
        if kw in upper:
            return json.dumps({"error": f"Keyword '{kw}' is not permitted."})
    try:
        cur = _get_db().cursor()
        cur.execute(clean)
        cols = [d[0] for d in cur.description] if cur.description else []
        rows = [dict(zip(cols, r)) for r in cur.fetchmany(_MAX_QUERY_ROWS)]
        _log("query_database", rows=len(rows))
        return json.dumps(rows, ensure_ascii=False, default=str)
    except sqlite3.Error as e:
        return json.dumps({"error": f"SQL error: {e}"})


# ========================= ACTION TOOLS =======================================

@tool
def update_issue(
    issue_id: str,
    status: str = "",
    priority: str = "",
    assignee_id: str = "",
) -> dict[str, Any]:
    """
    Update a single issue: change status, priority, and/or re-assign to a technician.
    Also syncs the change to SQLite so subsequent query_database calls see it.
    status: open | in-progress | closed
    priority: high | medium | low
    assignee_id: TECH-01 ... TECH-10
    Use for single-issue updates only. For bulk changes use request_bulk_issue_status_update.
    """
    iid      = _norm(issue_id).upper()
    new_stat = _norm_status(status)       or None
    new_pri  = _norm_priority(priority)   or None
    new_asn  = _norm(assignee_id).upper() or None

    if not any([new_stat, new_pri, new_asn]):
        return {"error": "Can provide at least one of: status, priority, assignee_id."}

    issues = _get_rail_data().get("issues", [])
    target = next((i for i in issues if i.get("id") == iid), None)
    if not target:
        return {"error": f"Issue '{iid}' not found."}
    if new_asn and not _get_technician_by_id(new_asn):
        return {"error": f"Technician '{new_asn}' not found. Use TECH-01...TECH-10."}

    changes: list[str] = []
    if new_stat and target.get("status") != new_stat:
        target["status"] = new_stat;   changes.append(f"status -> {new_stat}")
    if new_pri  and target.get("priority") != new_pri:
        target["priority"] = new_pri;  changes.append(f"priority -> {new_pri}")
    if new_asn  and target.get("assigneeId") != new_asn:
        target["assigneeId"] = new_asn
        tech = _get_technician_by_id(new_asn)
        changes.append(f"assignee -> {tech['name'] if tech else new_asn}")

    if not changes:
        return {"message": f"Issue {iid} is already in the requested state."}

    if _db_conn is not None:
        _db_conn.execute(
            "UPDATE issues SET status=?, priority=?, assignee_id=? WHERE id=?",
            (target["status"], target["priority"], target.get("assigneeId"), iid),
        )
        _db_conn.commit()

    tech = _get_technician_by_id(target.get("assigneeId") or "")
    _log("update_issue", issue_id=iid, changes=str(changes))
    return {
        "success": True, "issueId": iid, "changes": changes,
        "current": {
            "status":       target.get("status"),
            "priority":     target.get("priority"),
            "assigneeId":   target.get("assigneeId"),
            "assigneeName": tech["name"] if tech else "Unassigned",
        },
    }


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
    Each step has: order (1-based sequence), status (pending/in-progress/done),
    title, details, estimatedHours, and best-matching assigned technician.
    Streams step-by-step completions live in the chat panel.
    train_id / system: optional scope filters.
    priority: issue priority level to pull (default: high).
    max_steps: 1-12 (default: 8).
    Use when user asks to create a maintenance plan or repair schedule.
    """
    cap  = max(1, min(max_steps, _MAX_PLAN_STEPS))
    tid  = _norm_train_id(train_id) or None
    sys_ = _norm(system) or None
    pri_ = _norm_priority(priority) or "high"

    candidates = _filter_issues(train_id=tid, system=sys_, priority=pri_, status="open")[:cap]
    if not candidates:
        await copilotkit_emit_state(config, {"maintenancePlan": []})
        return {"summary": "No matching open issues found.", "stepCount": 0, "totalHours": 0}

    wl       = {e["technicianId"]: e["totalActiveIssues"] for e in _compute_technician_workload()}
    assigned: set[str] = set()
    steps = []

    for order, issue in enumerate(candidates, start=1):
        sys_name = issue.get("systemCategory", "")
        tech     = _best_tech_for_system(
            sys_name,
            exclude_ids=assigned if len(assigned) < 9 else set(),
            workload_snapshot=wl,
        )
        if tech:
            assigned.add(tech["id"])
        planning = issue.get("planning") or {}
        steps.append({
            "id":             issue.get("id", f"STEP-{order}"),
            "order":          order,
            "title":          f"{issue.get('trainId')} > {issue.get('carriageId')} — {sys_name}",
            "details":        (issue.get("title") or issue.get("description", ""))[:80],
            "priority":       issue.get("priority", "medium"),
            "status":         "pending",
            "estimatedHours": planning.get("estimatedHours", 2.0),
            "assigneeId":     tech["id"]   if tech else "",
            "assigneeName":   tech["name"] if tech else "Unassigned",
        })

    total_hours = round(sum(s["estimatedHours"] for s in steps), 1)
    await copilotkit_emit_state(config, {"maintenancePlan": steps})

    for idx in range(len(steps)):
        await asyncio.sleep(0.15)
        steps[idx]["status"] = "done"
        await copilotkit_emit_state(config, {"maintenancePlan": steps})

    _log("generate_maintenance_plan_stream", steps=len(steps), hours=total_hours)
    return {
        "summary":    f"Created {len(steps)} maintenance steps, est. {total_hours}h.",
        "stepCount":  len(steps),
        "totalHours": total_hours,
    }


@tool
async def schedule_inspection(
    config: RunnableConfig,
    train_id: str,
    systems: list[str],
    note: str = "",
) -> dict[str, Any]:
    """
    Schedule a targeted inspection for specific systems on one train.
    Creates a streaming plan with one step per system — each step has order,
    status (pending -> done), assigned technician, and estimated hours from data.
    systems: list from HVAC | Brakes | Doors | Power | Network
    Streams live step completions in the chat panel.
    """
    tid   = _norm_train_id(train_id)
    train = next((t for t in _get_trains() if t.get("id") == tid), None)
    if not train:
        return {"error": f"Train '{tid}' not found."}

    valid_sys = [s for s in systems if s in _SYSTEM_SPECIALIST]
    if not valid_sys:
        return {"error": f"Invalid systems. Supported: {_ALL_SYSTEMS}"}

    wl       = {e["technicianId"]: e["totalActiveIssues"] for e in _compute_technician_workload()}
    assigned: set[str] = set()
    steps = []

    for order, sys_name in enumerate(valid_sys, start=1):
        open_for_sys = _filter_issues(train_id=tid, system=sys_name, status="open")
        h = round(
            sum((i.get("planning") or {}).get("estimatedHours", 0) for i in open_for_sys[:3]) or 2.0,
            1,
        )
        tech = _best_tech_for_system(sys_name, exclude_ids=assigned, workload_snapshot=wl)
        if tech:
            assigned.add(tech["id"])
        open_count = len(open_for_sys)
        steps.append({
            "id":             f"INSP-{tid}-{sys_name[:3].upper()}",
            "order":          order,
            "title":          f"[Inspection] {tid} — {sys_name}" + (f"  |  {note}" if note else ""),
            "details":        f"{open_count} open issue(s). Est: {h}h.",
            "priority":       "high" if open_count > 2 else ("medium" if open_count > 0 else "low"),
            "status":         "pending",
            "estimatedHours": h,
            "assigneeId":     tech["id"]   if tech else "",
            "assigneeName":   tech["name"] if tech else "Unassigned",
        })

    total_hours = round(sum(s["estimatedHours"] for s in steps), 1)
    await copilotkit_emit_state(config, {"maintenancePlan": steps})

    for idx in range(len(steps)):
        await asyncio.sleep(0.20)
        steps[idx]["status"] = "done"
        await copilotkit_emit_state(config, {"maintenancePlan": steps})

    _log("schedule_inspection", train_id=tid, systems=valid_sys, hours=total_hours)
    return {
        "summary":    f"Inspection plan: {len(steps)} systems on {train.get('name')}, {total_hours}h.",
        "trainId":    tid,
        "trainName":  train.get("name"),
        "stepCount":  len(steps),
        "totalHours": total_hours,
        "systems":    valid_sys,
    }


@tool
def request_bulk_issue_status_update(
    priority: str = "high",
    target_status: str = "in-progress",
    train_id: str = "",
) -> dict[str, Any]:
    """
    Request human approval before bulk-updating open issues to a new status.
    ALWAYS triggers a human-in-the-loop approval dialog — never skips this.
    If approved, applies the update in-memory and syncs to SQLite.
    priority: high | medium | low
    target_status: in-progress | closed
    train_id: optional (empty = all trains)
    """
    tid      = _norm_train_id(train_id)
    pri_     = _norm_priority(priority)
    tgt_sta_ = _norm_status(target_status) or "in-progress"

    targets = _filter_issues(train_id=tid or None, priority=pri_ or None, status="open")
    if not targets:
        return {"approved": False, "count": 0, "message": "No matching open issues."}

    approval = interrupt({
        "type":         "bulk_issue_update_approval",
        "priority":     priority,
        "targetStatus": tgt_sta_,
        "trainId":      tid or "all",
        "count":        len(targets),
    })

    approved = bool(isinstance(approval, dict) and approval.get("approved"))
    if approved:
        target_ids = {t["id"] for t in targets}
        updated = 0
        for issue in _get_rail_data().get("issues", []):
            if issue.get("id") in target_ids:
                issue["status"] = tgt_sta_
                updated += 1
        if _db_conn is not None:
            _db_conn.executemany(
                "UPDATE issues SET status=? WHERE id=?",
                [(tgt_sta_, iid) for iid in target_ids],
            )
            _db_conn.commit()
        message = f"Updated {updated} issues to '{tgt_sta_}'."
    else:
        message = "Bulk update rejected by user."

    _log("request_bulk_issue_status_update", approved=approved, count=len(targets))
    return {"approved": approved, "count": len(targets), "targetStatus": tgt_sta_, "message": message}


# -- Tool registry -------------------------------------------------------------
rail_tools = [
    query_database,
    update_issue,
    generate_maintenance_plan_stream,
    schedule_inspection,
    request_bulk_issue_status_update,
]
