from typing import Literal, Optional, TypedDict
from copilotkit import CopilotKitState


class RailTrain(TypedDict):
    id: str
    name: str
    status: Literal["healthy", "warning", "critical"]
    openIssues: int
    efficiency: int


class RailIssue(TypedDict):
    id: str
    trainId: str
    carriageId: str
    system: str
    title: str
    priority: Literal["high", "medium", "low"]
    status: Literal["open", "in-progress", "closed"]


class AgentState(CopilotKitState):
    trains: Optional[list[RailTrain]]
    issues: Optional[list[RailIssue]]