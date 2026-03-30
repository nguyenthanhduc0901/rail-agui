from typing import Literal, Optional, TypedDict

from langchain.agents import AgentState as BaseAgentState


class MaintenanceStep(TypedDict):
    id: str
    order: int
    title: str
    status: Literal["pending", "doing", "done"]
    estimatedHours: float
    technicianId: str
    technicianName: str


class AgentState(BaseAgentState):
    maintenancePlan: Optional[list[MaintenanceStep]]