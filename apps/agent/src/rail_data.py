import json
import asyncio
import os
from pathlib import Path
from typing import Any

from langchain.tools import tool
from langchain_core.runnables import RunnableConfig
from langgraph.types import interrupt
from copilotkit.langgraph import copilotkit_emit_state

_DATA_PATH = (
    Path(__file__).resolve().parents[2]
    / "app"
    / "src"
    / "features"
    / "rail-dashboard"
    / "data"
    / "rail-data.json"
)

_rail_data = None  # lazy load
_TOOL_DEBUG = os.getenv("AGENT_TOOL_DEBUG", "0") == "1"
_ALLOWED_PRIORITIES = {"high", "medium", "low"}
_ALLOWED_STATUSES = {"open", "in-progress", "closed"}
_MAX_LIST_LIMIT = 15
_MAX_PLAN_STEPS = 8


def _log_tool(tool_name: str, **meta: Any) -> None:
    if not _TOOL_DEBUG:
        return
    safe_meta = {k: v for k, v in meta.items() if isinstance(v, (str, int, float, bool, type(None)))}
    print(f"[agent-tool] {tool_name}", safe_meta)


def _normalize_text(value: str) -> str:
    return (value or "").strip()


def _normalize_priority(value: str) -> str:
    normalized = _normalize_text(value).lower()
    return normalized if normalized in _ALLOWED_PRIORITIES else ""


def _normalize_status(value: str) -> str:
    normalized = _normalize_text(value).lower()
    return normalized if normalized in _ALLOWED_STATUSES else ""


def _normalize_train_id(value: str) -> str:
    normalized = _normalize_text(value).upper()
    return normalized


def _get_rail_data():
    """Lazy load rail data on first use."""
    global _rail_data
    if _rail_data is None:
        with open(_DATA_PATH, encoding="utf-8") as data_file:
            _rail_data = json.load(data_file)
    return _rail_data


def _filter_issues(
    train_id: str | None = None,
    carriage_id: str | None = None,
    system: str | None = None,
    priority: str | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    """Internal filter — returns full issue objects, never called directly by LLM."""
    issues = _get_rail_data().get("issues", [])
    train_id = _normalize_train_id(train_id or "") or None
    carriage_id = _normalize_text(carriage_id or "") or None
    system = _normalize_text(system or "") or None
    priority = _normalize_priority(priority or "") or None
    status = _normalize_status(status or "") or None

    def matches(issue: dict[str, Any]) -> bool:
        if train_id and issue.get("trainId") != train_id:
            return False
        if carriage_id and issue.get("carriageId") != carriage_id:
            return False
        if system and issue.get("systemCategory") != system:
            return False
        if priority and issue.get("priority") != priority:
            return False
        if status and issue.get("status") != status:
            return False
        return True

    filtered = [issue for issue in issues if matches(issue)]
    filtered.sort(key=lambda issue: (issue.get("planning") or {}).get("reportedAt", ""), reverse=True)
    return filtered


# ── Tool 1: Fleet overview — counts only, no per-train list ──────────────────

@tool
def get_fleet_overview() -> dict[str, Any]:
    """Get fleet-level counts and status breakdown.
    Returns only aggregate numbers — use get_train_summary for one train detail.
    """
    _log_tool("get_fleet_overview:start")
    trains = _get_rail_data().get("trains", [])
    issues = _get_rail_data().get("issues", [])
    open_issues = [i for i in issues if i.get("status") == "open"]
    result = {
        "totalTrains": len(trains),
        "byStatus": {
            "healthy": sum(1 for t in trains if t.get("healthStatus") == "healthy"),
            "warning": sum(1 for t in trains if t.get("healthStatus") == "warning"),
            "critical": sum(1 for t in trains if t.get("healthStatus") == "critical"),
        },
        "openIssues": {
            "total": len(open_issues),
            "high": sum(1 for i in open_issues if i.get("priority") == "high"),
            "medium": sum(1 for i in open_issues if i.get("priority") == "medium"),
            "low": sum(1 for i in open_issues if i.get("priority") == "low"),
        },
    }
    _log_tool("get_fleet_overview:done", totalTrains=result["totalTrains"], openIssues=result["openIssues"]["total"])
    return result


# ── Tool 2: Count only — for "how many" questions ────────────────────────────

@tool
def count_issues(
    train_id: str = "",
    system: str = "",
    priority: str = "",
    status: str = "",
) -> dict[str, int]:
    """Count issues matching filters. Use this when the user asks HOW MANY issues exist.
    Returns a single number — far cheaper than listing all issues.
    Empty string = no filter for that field.
    """
    normalized_train_id = _normalize_train_id(train_id)
    normalized_system = _normalize_text(system)
    normalized_priority = _normalize_priority(priority)
    normalized_status = _normalize_status(status)
    _log_tool(
        "count_issues:start",
        train_id=normalized_train_id or "all",
        system=normalized_system or "all",
        priority=normalized_priority or "all",
        status=normalized_status or "all",
    )

    filtered = _filter_issues(
        train_id=normalized_train_id or None,
        system=normalized_system or None,
        priority=normalized_priority or None,
        status=normalized_status or None,
    )
    result = {"count": len(filtered)}
    _log_tool("count_issues:done", count=result["count"])
    return result


# ── Tool 3: Train summary — stats only, no issue list ────────────────────────

@tool
def get_train_summary(train_id: str) -> dict[str, Any]:
    """Get summary stats for one train: status, efficiency, carriage breakdown,
    and issue counts by priority/status. Does NOT return individual issue objects.
    Use list_issues if you need the actual issue titles.
    """
    normalized_train_id = _normalize_train_id(train_id)
    _log_tool("get_train_summary:start", train_id=normalized_train_id or "")
    train = next(
        (t for t in _get_rail_data().get("trains", []) if t.get("id") == normalized_train_id),
        None,
    )
    if not train:
        _log_tool("get_train_summary:not_found", train_id=normalized_train_id or "")
        return {"error": f"Train '{normalized_train_id or train_id}' not found."}

    carriages = _get_rail_data().get("carriages", {}).get(normalized_train_id, [])
    all_issues = _filter_issues(train_id=normalized_train_id)

    carriage_summary = {
        "total": len(carriages),
        "healthy": sum(1 for c in carriages if c.get("healthStatus") == "healthy"),
        "warning": sum(1 for c in carriages if c.get("healthStatus") == "warning"),
        "critical": sum(1 for c in carriages if c.get("healthStatus") == "critical"),
    }

    issue_summary = {
        "open": sum(1 for i in all_issues if i.get("status") == "open"),
        "inProgress": sum(1 for i in all_issues if i.get("status") == "in-progress"),
        "closed": sum(1 for i in all_issues if i.get("status") == "closed"),
        "byPriority": {
            "high": sum(1 for i in all_issues if i.get("priority") == "high"),
            "medium": sum(1 for i in all_issues if i.get("priority") == "medium"),
            "low": sum(1 for i in all_issues if i.get("priority") == "low"),
        },
        "bySystems": {},
    }

    # Group open issues by system
    systems: dict[str, int] = {}
    for i in all_issues:
        if i.get("status") != "closed":
            s = i.get("systemCategory", "Unknown")
            systems[s] = systems.get(s, 0) + 1
    issue_summary["bySystems"] = systems

    result = {
        "id": train.get("id"),
        "name": train.get("name"),
        "status": train.get("healthStatus"),
        "efficiency": (train.get("metrics") or {}).get("efficiency"),
        "carriages": carriage_summary,
        "issues": issue_summary,
    }
    _log_tool(
        "get_train_summary:done",
        train_id=str(result["id"]),
        open_issues=issue_summary["open"],
        efficiency=result["efficiency"] if isinstance(result["efficiency"], (int, float)) else None,
    )
    return result


# ── Tool 4: List issues — trimmed fields, hard limit 15 ──────────────────────

@tool
def list_issues(
    train_id: str = "",
    carriage_id: str = "",
    system: str = "",
    priority: str = "",
    status: str = "",
    limit: int = 10,
) -> list[dict[str, Any]]:
    """List issues matching filters. Returns trimmed fields only (id, trainId,
    carriageId, system, title, priority, status). Hard limit: 15 items.
    Use count_issues first if you only need a number.
    """
    normalized_train_id = _normalize_train_id(train_id)
    normalized_carriage_id = _normalize_text(carriage_id)
    normalized_system = _normalize_text(system)
    normalized_priority = _normalize_priority(priority)
    normalized_status = _normalize_status(status)
    capped_limit = max(1, min(limit, _MAX_LIST_LIMIT))

    _log_tool(
        "list_issues:start",
        train_id=normalized_train_id or "all",
        carriage_id=normalized_carriage_id or "all",
        system=normalized_system or "all",
        priority=normalized_priority or "all",
        status=normalized_status or "all",
        limit=capped_limit,
    )

    filtered = _filter_issues(
        train_id=normalized_train_id or None,
        carriage_id=normalized_carriage_id or None,
        system=normalized_system or None,
        priority=normalized_priority or None,
        status=normalized_status or None,
    )
    capped = filtered[:capped_limit]
    result = [
        {
            "id": i.get("id"),
            "trainId": i.get("trainId"),
            "carriageId": i.get("carriageId"),
            "systemCategory": i.get("systemCategory"),
            "title": i.get("title") or i.get("description", "")[:80],
            "priority": i.get("priority"),
            "status": i.get("status"),
        }
        for i in capped
    ]
    _log_tool("list_issues:done", returned=len(result))
    return result


# ── Tool 5: Maintenance plan stream ──────────────────────────────────────────

@tool
async def generate_maintenance_plan_stream(
    config: RunnableConfig,
    train_id: str = "",
    priority: str = "high",
    max_steps: int = 8,
) -> dict[str, Any]:
    """Generate and stream a step-by-step maintenance plan.
    Use when user asks to create a maintenance plan or repair schedule.
    """
    normalized_train_id = _normalize_train_id(train_id)
    normalized_priority = _normalize_priority(priority)
    capped_steps = max(1, min(max_steps, _MAX_PLAN_STEPS))

    _log_tool(
        "generate_maintenance_plan_stream:start",
        train_id=normalized_train_id or "all",
        priority=normalized_priority or "all",
        max_steps=capped_steps,
    )

    candidates = _filter_issues(
        train_id=normalized_train_id or None,
        priority=normalized_priority or None,
        status="open",
    )[:capped_steps]

    if not candidates:
        await copilotkit_emit_state(config, {"maintenancePlan": []})
        _log_tool("generate_maintenance_plan_stream:done", step_count=0)
        return {"summary": "Không có sự cố open phù hợp.", "stepCount": 0}

    steps = [
        {
            "id": issue.get("id", f"step-{i + 1}"),
            "title": f"{issue.get('trainId')} / {issue.get('carriageId')} — {issue.get('systemCategory')}",
            "details": (issue.get("title") or issue.get("description", ""))[:80],
            "priority": issue.get("priority", "medium"),
            "done": False,
        }
        for i, issue in enumerate(candidates)
    ]

    await copilotkit_emit_state(config, {"maintenancePlan": steps})

    for idx in range(len(steps)):
        await asyncio.sleep(0.2)
        steps[idx]["done"] = True
        await copilotkit_emit_state(config, {"maintenancePlan": steps})

    result = {"summary": f"Đã tạo {len(steps)} bước bảo trì.", "stepCount": len(steps)}
    _log_tool("generate_maintenance_plan_stream:done", step_count=result["stepCount"])
    return result


# ── Tool 6: Bulk status update with human approval ───────────────────────────

@tool
def request_bulk_issue_status_update(
    priority: str = "high",
    target_status: str = "in-progress",
    train_id: str = "",
) -> dict[str, Any]:
    """Request human approval before bulk-updating open issues to a new status.
    Use when user asks to update many issues at once.
    """
    normalized_train_id = _normalize_train_id(train_id)
    normalized_priority = _normalize_priority(priority)
    normalized_target_status = _normalize_status(target_status) or "in-progress"

    _log_tool(
        "request_bulk_issue_status_update:start",
        train_id=normalized_train_id or "all",
        priority=normalized_priority or "all",
        target_status=normalized_target_status,
    )

    targets = _filter_issues(
        train_id=normalized_train_id or None,
        priority=normalized_priority or None,
        status="open",
    )

    if not targets:
        _log_tool("request_bulk_issue_status_update:done", approved=False, count=0)
        return {"approved": False, "count": 0, "message": "Không có sự cố open phù hợp."}

    approval_result = interrupt({
        "type": "bulk_issue_update_approval",
        "priority": priority,
        "targetStatus": normalized_target_status,
        "trainId": normalized_train_id or "all",
        "count": len(targets),
    })

    approved = bool(isinstance(approval_result, dict) and approval_result.get("approved"))
    result = {
        "approved": approved,
        "count": len(targets),
        "targetStatus": normalized_target_status,
        "message": (
            f"Đã duyệt bulk update {len(targets)} sự cố sang '{normalized_target_status}'."
            if approved
            else "Người dùng từ chối bulk update."
        ),
    }
    _log_tool("request_bulk_issue_status_update:done", approved=approved, count=result["count"])
    return result


rail_tools = [
    get_fleet_overview,
    count_issues,
    get_train_summary,
    list_issues,
    generate_maintenance_plan_stream,
    request_bulk_issue_status_update,
]
