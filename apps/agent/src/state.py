from typing import Literal, Optional, TypedDict

from langchain.agents import AgentState as BaseAgentState


class RailTrainMetrics(TypedDict):
    openIssues: int
    efficiency: int
    totalCarriages: int
    healthyCarriages: int


class RailTrain(TypedDict):
    id: str
    name: str
    fleetType: str
    operationalState: Literal["in-service", "maintenance", "out-of-service"]
    healthStatus: Literal["healthy", "warning", "critical"]
    currentLocation: str
    metrics: RailTrainMetrics


class RailIssue(TypedDict):
    id: str
    trainId: str
    carriageId: str
    systemCategory: str
    title: str
    priority: Literal["high", "medium", "low"]
    status: Literal["open", "in-progress", "closed"]


class MaintenanceStep(TypedDict):
    id: str
    title: str
    details: str
    priority: Literal["high", "medium", "low"]
    done: bool


class DashboardWidget(TypedDict):
    id: str
    kind: Literal["summary", "risk", "queue", "trend"]
    title: str
    summary: str
    value: str
    severity: Literal["info", "warning", "critical"]
    trainId: str


class AgentState(BaseAgentState):
    trains: Optional[list[RailTrain]]
    issues: Optional[list[RailIssue]]
    maintenancePlan: Optional[list[MaintenanceStep]]
    dashboardWidgets: Optional[list[DashboardWidget]]