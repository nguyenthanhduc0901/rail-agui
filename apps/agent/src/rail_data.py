import json
from pathlib import Path
from typing import Any

from langchain.tools import tool

_DATA_PATH = (
    Path(__file__).resolve().parents[2]
    / "app"
    / "src"
    / "features"
    / "rail-dashboard"
    / "data"
    / "rail-data.json"
)

with open(_DATA_PATH, encoding="utf-8") as data_file:
    _rail_data = json.load(data_file)


def _filter_issues(
    train_id: str | None = None,
    carriage_id: str | None = None,
    system: str | None = None,
    priority: str | None = None,
    status: str | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    issues = _rail_data.get("issues", [])

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
    return filtered[: max(1, min(limit, 200))]


@tool
def get_fleet_overview() -> dict[str, Any]:
    """Get high-level fleet status for rail operations."""
    trains = _rail_data.get("trains", [])
    return {
        "totalTrains": len(trains),
        "statusCount": {
            "healthy": len([t for t in trains if t.get("status") == "healthy"]),
            "warning": len([t for t in trains if t.get("status") == "warning"]),
            "critical": len([t for t in trains if t.get("status") == "critical"]),
        },
        "trains": trains,
    }


@tool
def get_train_details(train_id: str) -> dict[str, Any]:
    """Get one train details including carriages and active issues."""
    train = next((t for t in _rail_data.get("trains", []) if t.get("id") == train_id), None)
    carriages = _rail_data.get("carriagesByTrain", {}).get(train_id, [])
    active_issues = _filter_issues(train_id=train_id, status="open", limit=100)
    in_progress_issues = _filter_issues(train_id=train_id, status="in-progress", limit=100)

    return {
        "train": train,
        "carriages": carriages,
        "issues": {
            "open": active_issues,
            "inProgress": in_progress_issues,
            "totalActive": len(active_issues) + len(in_progress_issues),
        },
    }


@tool
def search_issues(
    train_id: str = "",
    carriage_id: str = "",
    system: str = "",
    priority: str = "",
    status: str = "",
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Search rail issues by filters. Empty values mean no filter."""
    return _filter_issues(
        train_id=train_id or None,
        carriage_id=carriage_id or None,
        system=system or None,
        priority=priority or None,
        status=status or None,
        limit=limit,
    )


rail_tools = [get_fleet_overview, get_train_details, search_issues]
