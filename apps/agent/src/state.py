from typing import Literal, Optional, TypedDict

from langchain.agents import AgentState as BaseAgentState


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


class AgentState(BaseAgentState):
    trains: Optional[list[RailTrain]]
    issues: Optional[list[RailIssue]]