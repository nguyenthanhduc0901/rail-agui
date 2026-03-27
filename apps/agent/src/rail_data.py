import json
import asyncio
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

    def matches(issue: dict[str, Any]) -> bool:
        if train_id and issue.get("trainId") != train_id:
            return False
        if carriage_id and issue.get("carriageId") != carriage_id:
            return False
        if system and issue.get("system") != system:
            return False
        if priority and issue.get("priority") != priority:
            return False
        if status and issue.get("status") != status:
            return False
        return True

    filtered = [issue for issue in issues if matches(issue)]
    filtered.sort(key=lambda issue: issue.get("date", ""), reverse=True)
    return filtered


# ── Tool 1: Fleet overview — counts only, no per-train list ──────────────────

@tool
def get_fleet_overview() -> dict[str, Any]:
    """Get fleet-level counts and status breakdown.
    Returns only aggregate numbers — use get_train_summary for one train detail.
    """
    trains = _get_rail_data().get("trains", [])
    issues = _get_rail_data().get("issues", [])
    open_issues = [i for i in issues if i.get("status") == "open"]
    return {
        "totalTrains": len(trains),
        "byStatus": {
            "healthy": sum(1 for t in trains if t.get("status") == "healthy"),
            "warning": sum(1 for t in trains if t.get("status") == "warning"),
            "critical": sum(1 for t in trains if t.get("status") == "critical"),
        },
        "openIssues": {
            "total": len(open_issues),
            "high": sum(1 for i in open_issues if i.get("priority") == "high"),
            "medium": sum(1 for i in open_issues if i.get("priority") == "medium"),
            "low": sum(1 for i in open_issues if i.get("priority") == "low"),
        },
    }


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
    filtered = _filter_issues(
        train_id=train_id or None,
        system=system or None,
        priority=priority or None,
        status=status or None,
    )
    return {"count": len(filtered)}


# ── Tool 3: Train summary — stats only, no issue list ────────────────────────

@tool
def get_train_summary(train_id: str) -> dict[str, Any]:
    """Get summary stats for one train: status, efficiency, carriage breakdown,
    and issue counts by priority/status. Does NOT return individual issue objects.
    Use list_issues if you need the actual issue titles.
    """
    train = next(
        (t for t in _get_rail_data().get("trains", []) if t.get("id") == train_id),
        None,
    )
    if not train:
        return {"error": f"Train '{train_id}' not found."}

    carriages = _get_rail_data().get("carriagesByTrain", {}).get(train_id, [])
    all_issues = _filter_issues(train_id=train_id)

    carriage_summary = {
        "total": len(carriages),
        "healthy": sum(1 for c in carriages if c.get("status") == "healthy"),
        "warning": sum(1 for c in carriages if c.get("status") == "warning"),
        "critical": sum(1 for c in carriages if c.get("status") == "critical"),
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
            s = i.get("system", "Unknown")
            systems[s] = systems.get(s, 0) + 1
    issue_summary["bySystems"] = systems

    return {
        "id": train.get("id"),
        "name": train.get("name"),
        "status": train.get("status"),
        "efficiency": train.get("efficiency"),
        "carriages": carriage_summary,
        "issues": issue_summary,
    }


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
    filtered = _filter_issues(
        train_id=train_id or None,
        carriage_id=carriage_id or None,
        system=system or None,
        priority=priority or None,
        status=status or None,
    )
    capped = filtered[: max(1, min(limit, 15))]
    return [
        {
            "id": i.get("id"),
            "trainId": i.get("trainId"),
            "carriageId": i.get("carriageId"),
            "system": i.get("system"),
            "title": i.get("title") or i.get("description", "")[:80],
            "priority": i.get("priority"),
            "status": i.get("status"),
        }
        for i in capped
    ]


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
    candidates = _filter_issues(
        train_id=train_id or None,
        priority=priority or None,
        status="open",
    )[:max(1, min(max_steps, 8))]

    if not candidates:
        await copilotkit_emit_state(config, {"maintenancePlan": []})
        return {"summary": "Không có sự cố open phù hợp.", "stepCount": 0}

    steps = [
        {
            "id": issue.get("id", f"step-{i + 1}"),
            "title": f"{issue.get('trainId')} / {issue.get('carriageId')} — {issue.get('system')}",
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

    return {"summary": f"Đã tạo {len(steps)} bước bảo trì.", "stepCount": len(steps)}


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
    targets = _filter_issues(
        train_id=train_id or None,
        priority=priority or None,
        status="open",
    )

    if not targets:
        return {"approved": False, "count": 0, "message": "Không có sự cố open phù hợp."}

    approval_result = interrupt({
        "type": "bulk_issue_update_approval",
        "priority": priority,
        "targetStatus": target_status,
        "trainId": train_id or "all",
        "count": len(targets),
    })

    approved = bool(isinstance(approval_result, dict) and approval_result.get("approved"))
    return {
        "approved": approved,
        "count": len(targets),
        "targetStatus": target_status,
        "message": (
            f"Đã duyệt bulk update {len(targets)} sự cố sang '{target_status}'."
            if approved
            else "Người dùng từ chối bulk update."
        ),
    }


rail_tools = [
    get_fleet_overview,
    count_issues,
    get_train_summary,
    list_issues,
    generate_maintenance_plan_stream,
    request_bulk_issue_status_update,
]
