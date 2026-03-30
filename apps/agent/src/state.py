from typing import Literal, Optional, TypedDict

from langchain.agents import AgentState as BaseAgentState


class MaintenanceStep(TypedDict):
    id: str
    order: int
    title: str
    details: str
    status: Literal["pending", "doing", "done"]
    estimatedHours: float
    technicianId: str
    technicianName: str


class DashboardWidget(TypedDict):
    id: str
    kind: Literal["summary", "risk", "queue", "trend"]
    title: str
    summary: str
    value: str
    severity: Literal["info", "warning", "critical"]
    trainId: str


class AgentState(BaseAgentState):
    maintenancePlan: Optional[list[MaintenanceStep]]
    dashboardWidgets: Optional[list[DashboardWidget]]