"""
Rail operations tools — fleet management agent.

TOOL SELECTION GUIDE (for LLM routing):
  count_issues                     ← "bao nhiêu sự cố..."
  get_fleet_overview               ← "tổng quan / KPI đội tàu"
  get_train_summary                ← "chi tiết tàu T0X"
  get_carriage_detail              ← "chi tiết toa C0X-T0X"
  get_issue_detail                 ← "chi tiết sự cố ISS-XXXX"
  list_issues                      ← "liệt kê / danh sách sự cố"
  get_system_analytics             ← "hệ thống nào tệ / phân tích hệ thống"
  find_overdue_issues              ← "sự cố trễ hạn / quá deadline"
  rank_trains_by_risk              ← "tàu nào nguy hiểm / xếp hạng rủi ro"
  get_technician_workload          ← "ai bận / khối lượng công việc kỹ thuật viên"
  find_available_technician        ← "tìm người rảnh / ai nhận được việc"
  update_issue                     ← "cập nhật / giao / đổi trạng thái sự cố đơn lẻ"
  generate_maintenance_plan_stream ← "lập kế hoạch bảo trì"
  schedule_inspection              ← "lên lịch kiểm tra hệ thống cụ thể"
  request_bulk_issue_status_update ← "cập nhật hàng loạt (yêu cầu xác nhận)"
"""

import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from langchain.tools import tool
from langchain_core.runnables import RunnableConfig
from langgraph.types import interrupt
from copilotkit.langgraph import copilotkit_emit_state

# ── Path & env ────────────────────────────────────────────────────────────────
_DATA_PATH = (
    Path(__file__).resolve().parents[2]
    / "app"
    / "src"
    / "features"
    / "rail-dashboard"
    / "data"
    / "rail-data.json"
)

_TOOL_DEBUG = os.getenv("AGENT_TOOL_DEBUG", "0") == "1"

# ── Constants ─────────────────────────────────────────────────────────────────
_ALLOWED_PRIORITIES = {"high", "medium", "low"}
_ALLOWED_STATUSES   = {"open", "in-progress", "closed"}
_MAX_LIST_LIMIT     = 20
_MAX_PLAN_STEPS     = 12

# System → technician specialty preferences (best-fit first)
_SYSTEM_SPECIALIST: dict[str, list[str]] = {
    "HVAC":    ["HVAC", "Diagnostics", "Mechanics"],
    "Brakes":  ["Brake Systems", "Mechanics", "Safety Systems", "Diagnostics"],
    "Doors":   ["Doors & Access", "Structural", "Safety Systems", "Diagnostics"],
    "Power":   ["Power Systems", "Electronics", "Safety Systems", "Diagnostics"],
    "Network": ["Network", "Electronics", "Diagnostics"],
}
_ALL_SYSTEMS = list(_SYSTEM_SPECIALIST.keys())



# ── Lazy data ─────────────────────────────────────────────────────────────────
_rail_data: dict[str, Any] | None = None


def _get_rail_data() -> dict[str, Any]:
    global _rail_data
    if _rail_data is None:
        with open(_DATA_PATH, encoding="utf-8") as f:
            _rail_data = json.load(f)
    return _rail_data


def _get_issues() -> list[dict[str, Any]]:
    return _get_rail_data().get("issues", [])


def _get_trains() -> list[dict[str, Any]]:
    return _get_rail_data().get("trains", [])


def _get_technicians() -> list[dict[str, Any]]:
    return _get_rail_data().get("technicians", [])


def _get_carriages_for_train(train_id: str) -> list[dict[str, Any]]:
    return _get_rail_data().get("carriages", {}).get(train_id, [])


def _get_technician_by_id(tech_id: str) -> dict[str, Any] | None:
    if not tech_id:
        return None
    return next((t for t in _get_technicians() if t.get("id") == tech_id), None)


# ── Normalisation ─────────────────────────────────────────────────────────────
def _norm(v: str) -> str:
    return (v or "").strip()


def _norm_priority(v: str) -> str:
    n = _norm(v).lower()
    return n if n in _ALLOWED_PRIORITIES else ""


def _norm_status(v: str) -> str:
    n = _norm(v).lower()
    return n if n in _ALLOWED_STATUSES else ""


def _norm_train_id(v: str) -> str:
    return _norm(v).upper()


# ── Date helpers ──────────────────────────────────────────────────────────────
def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(s: str) -> datetime | None:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def _days_until(date_str: str) -> int | None:
    """Days remaining until date. Negative = already overdue."""
    d = _parse_iso(date_str)
    if not d:
        return None
    return int((_now_utc() - d.astimezone(timezone.utc)).total_seconds() / -86400)


# ── Debug log ─────────────────────────────────────────────────────────────────
def _log(name: str, **kw: Any) -> None:
    if not _TOOL_DEBUG:
        return
    safe = {k: v for k, v in kw.items() if isinstance(v, (str, int, float, bool, type(None)))}
    print(f"[agent-tool] {name}", safe)


# ── Core issue filter ─────────────────────────────────────────────────────────
def _filter_issues(
    train_id: str | None = None,
    carriage_id: str | None = None,
    system: str | None = None,
    priority: str | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    tid  = _norm_train_id(train_id   or "") or None
    cid  = _norm(carriage_id         or "") or None
    sys_ = _norm(system              or "") or None
    pri_ = _norm_priority(priority   or "") or None
    sta_ = _norm_status(status       or "") or None

    def matches(i: dict) -> bool:
        if tid  and i.get("trainId")        != tid:  return False
        if cid  and i.get("carriageId")     != cid:  return False
        if sys_ and i.get("systemCategory") != sys_: return False
        if pri_ and i.get("priority")       != pri_: return False
        if sta_ and i.get("status")         != sta_: return False
        return True

    result = [i for i in _get_issues() if matches(i)]
    result.sort(
        key=lambda i: (i.get("planning") or {}).get("reportedAt", ""),
        reverse=True,
    )
    return result


# ── Workload helper (shared by multiple tools) ────────────────────────────────
def _compute_technician_workload() -> list[dict[str, Any]]:
    """Internal: per-technician workload without @tool overhead."""
    techs = _get_technicians()
    wl: dict[str, dict] = {
        t["id"]: {
            "technicianId":   t["id"],
            "name":           t["name"],
            "specialty":      t["specialty"],
            "open":           0,
            "inProgress":     0,
            "estimatedHours": 0.0,
            "trains":         set(),
        }
        for t in techs
    }
    for issue in _get_issues():
        aid = issue.get("assigneeId") or ""
        if aid not in wl or issue.get("status") == "closed":
            continue
        if issue.get("status") == "open":
            wl[aid]["open"] += 1
        elif issue.get("status") == "in-progress":
            wl[aid]["inProgress"] += 1
        wl[aid]["estimatedHours"] += (issue.get("planning") or {}).get("estimatedHours", 0)
        wl[aid]["trains"].add(issue.get("trainId", ""))

    rows = []
    for e in wl.values():
        rows.append({
            "technicianId":      e["technicianId"],
            "name":              e["name"],
            "specialty":         e["specialty"],
            "openIssues":        e["open"],
            "inProgressIssues":  e["inProgress"],
            "totalActiveIssues": e["open"] + e["inProgress"],
            "estimatedHours":    round(e["estimatedHours"], 1),
            "affectedTrains":    sorted(e["trains"]),
        })
    rows.sort(key=lambda x: -x["totalActiveIssues"])
    return rows


# ── Technician assignment ─────────────────────────────────────────────────────
def _best_tech_for_system(
    system: str,
    exclude_ids: set[str] | None = None,
    workload_snapshot: dict[str, int] | None = None,
) -> dict[str, Any] | None:
    """
    Return the least-loaded technician whose specialty best fits `system`.
    workload_snapshot: {tech_id: total_active_issues} pre-computed for batch calls.
    """
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

    # Sort: primary = specialty preference rank, secondary = workload
    candidates = [
        (pref.index(t["specialty"]) if t["specialty"] in pref else 99, wl.get(tid, 0), tid, t)
        for tid, t in techs.items()
        if tid not in excl
    ]
    candidates.sort(key=lambda x: (x[0], x[1]))
    return candidates[0][3] if candidates else None


# ─────────────────────────── QUERY TOOLS ──────────────────────────────────────

@tool
def get_fleet_overview() -> dict[str, Any]:
    """
    Return fleet-level KPIs: train counts by health status and operational state,
    total/open/in-progress issue counts by priority, and estimated repair hours.
    Call first when user asks for a general fleet status or high-level summary.
    Does NOT list individual trains — use get_train_summary for per-train detail.
    """
    _log("get_fleet_overview")
    trains = _get_trains()
    issues = _get_issues()
    open_i = [i for i in issues if i.get("status") == "open"]
    inp_i  = [i for i in issues if i.get("status") == "in-progress"]
    return {
        "totalTrains": len(trains),
        "byHealthStatus": {
            "healthy":  sum(1 for t in trains if t.get("healthStatus") == "healthy"),
            "warning":  sum(1 for t in trains if t.get("healthStatus") == "warning"),
            "critical": sum(1 for t in trains if t.get("healthStatus") == "critical"),
        },
        "byOperationalState": {
            "inService":    sum(1 for t in trains if t.get("operationalState") == "in-service"),
            "maintenance":  sum(1 for t in trains if t.get("operationalState") == "maintenance"),
            "outOfService": sum(1 for t in trains if t.get("operationalState") == "out-of-service"),
        },
        "issues": {
            "total":      len(issues),
            "open":       len(open_i),
            "inProgress": len(inp_i),
            "closed":     len(issues) - len(open_i) - len(inp_i),
        },
        "openByPriority": {
            "high":   sum(1 for i in open_i if i.get("priority") == "high"),
            "medium": sum(1 for i in open_i if i.get("priority") == "medium"),
            "low":    sum(1 for i in open_i if i.get("priority") == "low"),
        },
        "estimatedRepairHours": {
            "all": round(sum((i.get("planning") or {}).get("estimatedHours", 0) for i in open_i), 1),
            "highPriority": round(
                sum((i.get("planning") or {}).get("estimatedHours", 0)
                    for i in open_i if i.get("priority") == "high"), 1,
            ),
        },
    }


@tool
def count_issues(
    train_id: str = "",
    system: str = "",
    priority: str = "",
    status: str = "",
) -> dict[str, int]:
    """
    Count issues matching any combination of filters. Returns a single number.
    Use this whenever user asks HOW MANY — far cheaper than list_issues.
    system: HVAC | Brakes | Doors | Power | Network
    priority: high | medium | low   |   status: open | in-progress | closed
    Empty string = no filter for that field.
    """
    filtered = _filter_issues(
        train_id=_norm_train_id(train_id) or None,
        system=_norm(system) or None,
        priority=_norm_priority(priority) or None,
        status=_norm_status(status) or None,
    )
    _log("count_issues", count=len(filtered))
    return {"count": len(filtered)}


@tool
def get_train_summary(train_id: str) -> dict[str, Any]:
    """
    Full summary for one train: operational state, efficiency, health status,
    carriage breakdown (healthy/warning/critical), issue counts by priority and
    by system, estimated repair hours for open issues.
    Does NOT list individual issue titles — use list_issues for that.
    """
    tid = _norm_train_id(train_id)
    train = next((t for t in _get_trains() if t.get("id") == tid), None)
    if not train:
        return {"error": f"Train '{tid}' not found."}

    carriages   = _get_carriages_for_train(tid)
    all_issues  = _filter_issues(train_id=tid)
    open_issues = [i for i in all_issues if i.get("status") == "open"]

    systems: dict[str, int] = {}
    for i in all_issues:
        if i.get("status") != "closed":
            s = i.get("systemCategory", "Unknown")
            systems[s] = systems.get(s, 0) + 1

    _log("get_train_summary", train_id=tid, open=len(open_issues))
    return {
        "id":               train.get("id"),
        "name":             train.get("name"),
        "fleetType":        train.get("fleetType"),
        "operationalState": train.get("operationalState"),
        "healthStatus":     train.get("healthStatus"),
        "currentLocation":  train.get("currentLocation"),
        "efficiency":       (train.get("metrics") or {}).get("efficiency"),
        "carriages": {
            "total":    len(carriages),
            "healthy":  sum(1 for c in carriages if c.get("healthStatus") == "healthy"),
            "warning":  sum(1 for c in carriages if c.get("healthStatus") == "warning"),
            "critical": sum(1 for c in carriages if c.get("healthStatus") == "critical"),
        },
        "issues": {
            "open":       len(open_issues),
            "inProgress": sum(1 for i in all_issues if i.get("status") == "in-progress"),
            "closed":     sum(1 for i in all_issues if i.get("status") == "closed"),
            "byPriority": {
                "high":   sum(1 for i in all_issues if i.get("priority") == "high"),
                "medium": sum(1 for i in all_issues if i.get("priority") == "medium"),
                "low":    sum(1 for i in all_issues if i.get("priority") == "low"),
            },
            "bySystem":             systems,
            "estimatedRepairHours": round(
                sum((i.get("planning") or {}).get("estimatedHours", 0) for i in open_issues), 1,
            ),
        },
    }


@tool
def list_issues(
    train_id: str = "",
    carriage_id: str = "",
    system: str = "",
    priority: str = "",
    status: str = "",
    limit: int = 10,
) -> list[dict[str, Any]]:
    """
    List issues with FULL detail: title, description excerpt, priority, status,
    system, assignee name & specialty, reportedAt, scheduledDate, estimatedHours,
    daysUntilDue (negative = overdue).
    Hard limit: 20. Use count_issues first if you only need a number.
    system: HVAC | Brakes | Doors | Power | Network
    priority: high | medium | low   |   status: open | in-progress | closed
    """
    cap = max(1, min(limit, _MAX_LIST_LIMIT))
    filtered = _filter_issues(
        train_id=_norm_train_id(train_id) or None,
        carriage_id=_norm(carriage_id) or None,
        system=_norm(system) or None,
        priority=_norm_priority(priority) or None,
        status=_norm_status(status) or None,
    )[:cap]

    result = []
    for i in filtered:
        tech     = _get_technician_by_id(i.get("assigneeId") or "")
        planning = i.get("planning") or {}
        days     = _days_until(planning.get("scheduledDate", ""))
        result.append({
            "id":                i.get("id"),
            "trainId":           i.get("trainId"),
            "carriageId":        i.get("carriageId"),
            "systemCategory":    i.get("systemCategory"),
            "title":             i.get("title") or i.get("description", "")[:80],
            "description":       i.get("description", "")[:120],
            "priority":          i.get("priority"),
            "status":            i.get("status"),
            "assigneeId":        i.get("assigneeId") or "unassigned",
            "assigneeName":      tech["name"]      if tech else "Unassigned",
            "assigneeSpecialty": tech["specialty"] if tech else None,
            "reportedAt":        planning.get("reportedAt"),
            "scheduledDate":     planning.get("scheduledDate"),
            "estimatedHours":    planning.get("estimatedHours"),
            "daysUntilDue":      days,
        })
    _log("list_issues", returned=len(result))
    return result


@tool
def get_carriage_detail(train_id: str, carriage_id: str) -> dict[str, Any]:
    """
    Detailed info for one carriage: serial number, type, health status, open/in-progress
    counts, and up to 8 active issues (id, system, title, priority, status, assignee).
    Use when user asks about a specific carriage by ID (e.g. 'toa C01-T05').
    """
    tid = _norm_train_id(train_id)
    cid = _norm(carriage_id)
    carriage = next(
        (c for c in _get_carriages_for_train(tid) if c.get("id") == cid), None
    )
    if not carriage:
        return {"error": f"Carriage '{cid}' not found on train '{tid}'."}

    active = [
        i for i in _filter_issues(train_id=tid, carriage_id=cid)
        if i.get("status") != "closed"
    ]
    issue_list = []
    for i in active[:8]:
        tech = _get_technician_by_id(i.get("assigneeId") or "")
        issue_list.append({
            "id":             i.get("id"),
            "systemCategory": i.get("systemCategory"),
            "title":          i.get("title") or i.get("description", "")[:60],
            "priority":       i.get("priority"),
            "status":         i.get("status"),
            "assigneeName":   tech["name"] if tech else "Unassigned",
        })

    _log("get_carriage_detail", train_id=tid, carriage_id=cid)
    return {
        "id":              cid,
        "trainId":         tid,
        "serialNumber":    carriage.get("serialNumber"),
        "sequence":        carriage.get("sequence"),
        "type":            carriage.get("type"),
        "healthStatus":    carriage.get("healthStatus"),
        "openIssuesCount": sum(1 for i in active if i.get("status") == "open"),
        "inProgressCount": sum(1 for i in active if i.get("status") == "in-progress"),
        "activeIssues":    issue_list,
    }


@tool
def get_issue_detail(issue_id: str) -> dict[str, Any]:
    """
    Full detail for a single issue by ID (e.g. 'ISS-1023'): title, full description,
    priority, status, system, assignee name & specialty, reportedAt, scheduledDate,
    estimatedHours, daysUntilDue (negative = overdue), isOverdue flag.
    Use when user asks about one specific issue.
    """
    iid   = _norm(issue_id).upper()
    issue = next((i for i in _get_issues() if i.get("id") == iid), None)
    if not issue:
        return {"error": f"Issue '{iid}' not found."}

    tech     = _get_technician_by_id(issue.get("assigneeId") or "")
    planning = issue.get("planning") or {}
    days     = _days_until(planning.get("scheduledDate", ""))
    _log("get_issue_detail", issue_id=iid)
    return {
        "id":                issue.get("id"),
        "trainId":           issue.get("trainId"),
        "carriageId":        issue.get("carriageId"),
        "systemCategory":    issue.get("systemCategory"),
        "title":             issue.get("title"),
        "description":       issue.get("description"),
        "priority":          issue.get("priority"),
        "status":            issue.get("status"),
        "assigneeId":        issue.get("assigneeId") or "unassigned",
        "assigneeName":      tech["name"]      if tech else "Unassigned",
        "assigneeSpecialty": tech["specialty"] if tech else None,
        "reportedAt":        planning.get("reportedAt"),
        "scheduledDate":     planning.get("scheduledDate"),
        "estimatedHours":    planning.get("estimatedHours"),
        "daysUntilDue":      days,
        "isOverdue":         bool(
            days is not None and days < 0 and issue.get("status") != "closed"
        ),
    }


@tool
def get_system_analytics(system: str = "") -> dict[str, Any]:
    """
    Analyse issue distribution across all 5 systems: HVAC, Brakes, Doors, Power, Network.
    If system is given, return a deep-dive for that system only.
    Returns per-system counts (open/inProgress/closed), high-priority share,
    avg estimated hours, and top-3 worst-affected trains for each system.
    Call when user asks 'hệ thống nào tệ nhất', 'phân tích hệ thống Brakes', etc.
    """
    issues = _get_issues()

    def _analyse(sys_name: str) -> dict[str, Any]:
        all_s  = [i for i in issues if i.get("systemCategory") == sys_name]
        open_  = [i for i in all_s  if i.get("status") == "open"]
        inp    = [i for i in all_s  if i.get("status") == "in-progress"]
        closed = [i for i in all_s  if i.get("status") == "closed"]
        total_h = sum((i.get("planning") or {}).get("estimatedHours", 0) for i in open_)
        avg_h   = round(total_h / len(open_), 1) if open_ else 0.0
        train_counts: dict[str, int] = {}
        for i in open_:
            t = i.get("trainId", "?")
            train_counts[t] = train_counts.get(t, 0) + 1
        top = sorted(train_counts.items(), key=lambda x: -x[1])[:3]
        return {
            "system":               sys_name,
            "total":                len(all_s),
            "open":                 len(open_),
            "inProgress":           len(inp),
            "closed":               len(closed),
            "highPriority":         sum(1 for i in open_ if i.get("priority") == "high"),
            "totalEstimatedHours":  round(total_h, 1),
            "avgHoursPerOpenIssue": avg_h,
            "worstTrains":          [{"trainId": t, "openIssues": c} for t, c in top],
        }

    target = _norm(system)
    if target and target in _SYSTEM_SPECIALIST:
        _log("get_system_analytics", target=target)
        return _analyse(target)

    rows = [_analyse(s) for s in _ALL_SYSTEMS]
    rows.sort(key=lambda x: -x["open"])
    _log("get_system_analytics", most_problematic=rows[0]["system"] if rows else None)
    return {
        "totalOpenIssues": sum(r["open"] for r in rows),
        "mostProblematic": rows[0]["system"] if rows else None,
        "systems":         rows,
    }


@tool
def find_overdue_issues(
    priority: str = "",
    train_id: str = "",
    limit: int = 10,
) -> dict[str, Any]:
    """
    Find open/in-progress issues whose scheduledDate has already passed (overdue).
    Returns issues sorted by most overdue first, with daysOverdue field.
    Call when user asks about 'trễ hạn', 'quá deadline', 'quá hạn sửa chữa'.
    priority: high | medium | low (optional filter)
    train_id: optional — scope to one train
    """
    cap = max(1, min(limit, _MAX_LIST_LIMIT))
    candidates = _filter_issues(
        train_id=_norm_train_id(train_id) or None,
        priority=_norm_priority(priority) or None,
    )
    overdue: list[tuple[int, dict]] = []
    for issue in candidates:
        if issue.get("status") == "closed":
            continue
        sched = (issue.get("planning") or {}).get("scheduledDate", "")
        if not sched:
            continue
        days = _days_until(sched)
        if days is not None and days < 0:
            overdue.append((abs(days), issue))

    overdue.sort(key=lambda x: -x[0])
    result = []
    for days_over, i in overdue[:cap]:
        tech = _get_technician_by_id(i.get("assigneeId") or "")
        result.append({
            "id":             i.get("id"),
            "trainId":        i.get("trainId"),
            "carriageId":     i.get("carriageId"),
            "systemCategory": i.get("systemCategory"),
            "title":          i.get("title") or i.get("description", "")[:60],
            "priority":       i.get("priority"),
            "status":         i.get("status"),
            "scheduledDate":  (i.get("planning") or {}).get("scheduledDate"),
            "daysOverdue":    days_over,
            "assigneeName":   tech["name"] if tech else "Unassigned",
        })

    _log("find_overdue_issues", found=len(overdue), returning=len(result))
    return {"totalOverdue": len(overdue), "issues": result}


@tool
def rank_trains_by_risk(top_n: int = 5) -> list[dict[str, Any]]:
    """
    Rank trains by composite risk score to identify which need the most urgent attention.
    Score = (critical_carriages × 3) + (high_open_issues × 2)
              + (medium_open_issues × 1) + (100 − efficiency) × 0.2
              + (overdue_issues × 1.5)
    Returns top N trains (default 5) sorted by risk score descending with rank field.
    Call when user asks 'tàu nào nguy hiểm nhất', 'xếp hạng rủi ro', 'ưu tiên tàu nào'.
    """
    cap    = max(1, min(top_n, 20))
    trains = _get_trains()

    # Single-pass pre-compute overdue per train
    overdue_per_train: dict[str, int] = {}
    for issue in _get_issues():
        if issue.get("status") == "closed":
            continue
        sched = (issue.get("planning") or {}).get("scheduledDate", "")
        days  = _days_until(sched)
        if days is not None and days < 0:
            t = issue.get("trainId", "")
            overdue_per_train[t] = overdue_per_train.get(t, 0) + 1

    ranked = []
    for train in trains:
        tid        = train.get("id", "")
        carriages  = _get_carriages_for_train(tid)
        open_i     = _filter_issues(train_id=tid, status="open")
        efficiency = (train.get("metrics") or {}).get("efficiency", 100)
        crit_c     = sum(1 for c in carriages if c.get("healthStatus") == "critical")
        high_o     = sum(1 for i in open_i   if i.get("priority") == "high")
        med_o      = sum(1 for i in open_i   if i.get("priority") == "medium")
        overdue    = overdue_per_train.get(tid, 0)
        score      = (crit_c * 3) + (high_o * 2) + (med_o * 1) + \
                     ((100 - efficiency) * 0.2) + (overdue * 1.5)
        ranked.append({
            "rank":                     0,  # filled below
            "trainId":                  tid,
            "trainName":                train.get("name"),
            "healthStatus":             train.get("healthStatus"),
            "operationalState":         train.get("operationalState"),
            "riskScore":                round(score, 1),
            "criticalCarriages":        crit_c,
            "highPriorityOpenIssues":   high_o,
            "mediumPriorityOpenIssues": med_o,
            "overdueIssues":            overdue,
            "efficiency":               efficiency,
        })

    ranked.sort(key=lambda x: -x["riskScore"])
    for i, r in enumerate(ranked[:cap]):
        r["rank"] = i + 1
    _log("rank_trains_by_risk", top_n=cap)
    return ranked[:cap]


@tool
def get_technician_workload() -> list[dict[str, Any]]:
    """
    Workload breakdown for all 10 technicians: name, specialty, open/in-progress counts,
    total estimated repair hours assigned, and train IDs they are currently covering.
    Results sorted by total active issues descending (busiest first).
    Call when user asks 'ai đang bận nhất', 'phân bổ công việc', 'khối lượng kỹ thuật viên'.
    """
    result = _compute_technician_workload()
    _log("get_technician_workload", technicians=len(result))
    return result


@tool
def find_available_technician(
    specialty: str = "",
    max_workload: int = 5,
) -> list[dict[str, Any]]:
    """
    Find technicians with fewer than max_workload active issues (default: 5).
    Optionally filter by specialty keyword (partial match, e.g. 'HVAC', 'Brake', 'Network').
    Returns sorted by active issues ascending (least busy first) with available capacity.
    Call when user asks 'ai rảnh để nhận việc', 'tìm kỹ thuật viên cho X'.
    """
    spec_filter = _norm(specialty).lower()
    all_wl = _compute_technician_workload()
    result = []
    for e in all_wl:
        if e["totalActiveIssues"] >= max_workload:
            continue
        if spec_filter and spec_filter not in e["specialty"].lower():
            continue
        result.append({
            "technicianId":      e["technicianId"],
            "name":              e["name"],
            "specialty":         e["specialty"],
            "activeIssues":      e["totalActiveIssues"],
            "availableCapacity": max_workload - e["totalActiveIssues"],
        })
    result.sort(key=lambda x: x["activeIssues"])
    _log("find_available_technician", specialty=specialty or "any", found=len(result))
    return result


# ─────────────────────────── ACTION TOOLS ─────────────────────────────────────

@tool
def update_issue(
    issue_id: str,
    status: str = "",
    priority: str = "",
    assignee_id: str = "",
) -> dict[str, Any]:
    """
    Update a single issue: change status, priority, and/or re-assign to a technician.
    At least one field must be different from the current value to apply an update.
    The change is applied to in-memory data and reflected in all subsequent queries.
    status: open | in-progress | closed
    priority: high | medium | low
    assignee_id: TECH-01 … TECH-10
    Use for single-issue updates only. For bulk changes use request_bulk_issue_status_update.
    """
    iid      = _norm(issue_id).upper()
    new_stat = _norm_status(status)    or None
    new_pri  = _norm_priority(priority) or None
    new_asn  = _norm(assignee_id).upper() or None

    if not any([new_stat, new_pri, new_asn]):
        return {"error": "Cần cung cấp ít nhất một trong: status, priority, assignee_id."}

    issues = _get_rail_data().get("issues", [])
    target = next((i for i in issues if i.get("id") == iid), None)
    if not target:
        return {"error": f"Issue '{iid}' không tồn tại."}

    if new_asn and not _get_technician_by_id(new_asn):
        return {"error": f"Kỹ thuật viên '{new_asn}' không tồn tại. Dùng TECH-01…TECH-10."}

    changes: list[str] = []
    if new_stat and target.get("status") != new_stat:
        target["status"] = new_stat
        changes.append(f"status → {new_stat}")
    if new_pri and target.get("priority") != new_pri:
        target["priority"] = new_pri
        changes.append(f"priority → {new_pri}")
    if new_asn and target.get("assigneeId") != new_asn:
        target["assigneeId"] = new_asn
        tech = _get_technician_by_id(new_asn)
        changes.append(f"assignee → {tech['name'] if tech else new_asn}")

    if not changes:
        return {"message": f"Issue {iid} đã ở trạng thái yêu cầu, không có gì thay đổi."}

    tech = _get_technician_by_id(target.get("assigneeId") or "")
    _log("update_issue", issue_id=iid, changes=str(changes))
    return {
        "success": True,
        "issueId": iid,
        "changes": changes,
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
    Each step is assigned to the best-matching available technician and includes
    real estimatedHours from the issue data. Streams live step completions in chat.
    train_id / system: optional scope filters.
    priority: which priority level to pull issues from (default: high).
    max_steps: 1–12 (default: 8).
    Use when user asks to create a maintenance plan or repair schedule.
    """
    cap = max(1, min(max_steps, _MAX_PLAN_STEPS))
    tid = _norm_train_id(train_id) or None
    sys_ = _norm(system) or None
    pri_ = _norm_priority(priority) or "high"

    candidates = _filter_issues(
        train_id=tid, system=sys_, priority=pri_, status="open",
    )[:cap]

    if not candidates:
        await copilotkit_emit_state(config, {"maintenancePlan": []})
        return {"summary": "Không có sự cố open phù hợp để lập kế hoạch.", "stepCount": 0, "totalHours": 0}

    wl_snapshot = {e["technicianId"]: e["totalActiveIssues"] for e in _compute_technician_workload()}
    assigned: set[str] = set()
    steps = []
    for i, issue in enumerate(candidates):
        sys_name = issue.get("systemCategory", "")
        tech     = _best_tech_for_system(
            sys_name,
            exclude_ids=assigned if len(assigned) < 9 else set(),
            workload_snapshot=wl_snapshot,
        )
        if tech:
            assigned.add(tech["id"])
        planning = issue.get("planning") or {}
        steps.append({
            "id":             issue.get("id", f"STEP-{i+1}"),
            "title":          f"{issue.get('trainId')} › {issue.get('carriageId')} — {sys_name}",
            "details":        (issue.get("title") or issue.get("description", ""))[:80],
            "priority":       issue.get("priority", "medium"),
            "estimatedHours": planning.get("estimatedHours", 2.0),
            "assigneeId":     tech["id"]   if tech else "",
            "assigneeName":   tech["name"] if tech else "Unassigned",
            "done":           False,
        })

    total_hours = round(sum(s["estimatedHours"] for s in steps), 1)
    await copilotkit_emit_state(config, {"maintenancePlan": steps})

    for idx in range(len(steps)):
        await asyncio.sleep(0.15)
        steps[idx]["done"] = True
        await copilotkit_emit_state(config, {"maintenancePlan": steps})

    _log("generate_maintenance_plan_stream", steps=len(steps), hours=total_hours)
    return {
        "summary":    f"Đã tạo {len(steps)} bước bảo trì, ước tính {total_hours} giờ.",
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
    Creates a streaming maintenance plan — one step per system — each assigned
    to the best-matching available technician, with estimated hours from data.
    systems: list from HVAC | Brakes | Doors | Power | Network
    note: optional context (e.g. 'pre-Q3 audit')
    Streams live step completions visible in the chat panel.
    Call when user says 'lên lịch kiểm tra', 'schedule inspection for tàu X hệ thống Y'.
    """
    tid = _norm_train_id(train_id)
    train = next((t for t in _get_trains() if t.get("id") == tid), None)
    if not train:
        return {"error": f"Train '{tid}' không tồn tại."}

    valid_sys = [s for s in systems if s in _SYSTEM_SPECIALIST]
    if not valid_sys:
        return {"error": f"Hệ thống không hợp lệ. Các hệ thống được hỗ trợ: {_ALL_SYSTEMS}"}

    wl_snapshot = {e["technicianId"]: e["totalActiveIssues"] for e in _compute_technician_workload()}
    assigned: set[str] = set()
    steps = []
    for sys_name in valid_sys:
        open_for_sys = _filter_issues(train_id=tid, system=sys_name, status="open")
        # Use average of up to 3 open issues for hour estimate; fallback 2h
        h = round(
            sum((i.get("planning") or {}).get("estimatedHours", 0) for i in open_for_sys[:3])
            or 2.0, 1,
        )
        tech = _best_tech_for_system(sys_name, exclude_ids=assigned, workload_snapshot=wl_snapshot)
        if tech:
            assigned.add(tech["id"])
        open_count = len(open_for_sys)
        steps.append({
            "id":             f"INSP-{tid}-{sys_name[:3].upper()}",
            "title":          f"[Inspection] {tid} — {sys_name}" + (f"  |  {note}" if note else ""),
            "details":        f"{open_count} open issue(s) detected. Estimated: {h}h.",
            "priority":       "high" if open_count > 2 else ("medium" if open_count > 0 else "low"),
            "estimatedHours": h,
            "assigneeId":     tech["id"]   if tech else "",
            "assigneeName":   tech["name"] if tech else "Unassigned",
            "done":           False,
        })

    total_hours = round(sum(s["estimatedHours"] for s in steps), 1)
    await copilotkit_emit_state(config, {"maintenancePlan": steps})

    for idx in range(len(steps)):
        await asyncio.sleep(0.20)
        steps[idx]["done"] = True
        await copilotkit_emit_state(config, {"maintenancePlan": steps})

    _log("schedule_inspection", train_id=tid, systems=valid_sys, hours=total_hours)
    return {
        "summary":    f"Kế hoạch kiểm tra {len(steps)} hệ thống trên {train.get('name')}, ước tính {total_hours} giờ.",
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
    ALWAYS triggers a human-in-the-loop approval dialog first — never skips this.
    If approved, applies the update to all matched issues in-memory immediately.
    Use when user asks to update many issues at once (e.g. 'mark all high priority as in-progress').
    priority: high | medium | low
    target_status: in-progress | closed
    train_id: optional — scope to one train (empty = all trains)
    """
    tid      = _norm_train_id(train_id)
    pri_     = _norm_priority(priority)
    tgt_sta_ = _norm_status(target_status) or "in-progress"

    targets = _filter_issues(
        train_id=tid or None,
        priority=pri_ or None,
        status="open",
    )
    if not targets:
        return {"approved": False, "count": 0, "message": "Không có sự cố open phù hợp."}

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
        message = f"Đã cập nhật {updated} sự cố sang '{tgt_sta_}'."
    else:
        message = "Người dùng từ chối bulk update."

    _log("request_bulk_issue_status_update", approved=approved, count=len(targets))
    return {"approved": approved, "count": len(targets), "targetStatus": tgt_sta_, "message": message}


# ── Tool registry ─────────────────────────────────────────────────────────────
rail_tools = [
    # ── Query (read-only) ──
    get_fleet_overview,
    count_issues,
    get_train_summary,
    list_issues,
    get_carriage_detail,
    get_issue_detail,
    get_system_analytics,
    find_overdue_issues,
    rank_trains_by_risk,
    get_technician_workload,
    find_available_technician,
    # ── Action (write / stream) ──
    update_issue,
    generate_maintenance_plan_stream,
    schedule_inspection,
    request_bulk_issue_status_update,
]

