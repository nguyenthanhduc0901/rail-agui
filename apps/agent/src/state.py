from typing import Literal, Optional, TypedDict

from copilotkit import CopilotKitState


class MaintenanceStep(TypedDict):
    id: str
    order: int
    title: str
    status: Literal["pending", "doing", "done"]
    estimatedHours: float
    technicianId: str
    technicianName: str


class AgentProgressStep(TypedDict):
    id: str
    description: str
    status: Literal["pending", "doing", "done"]


# ── State I/O Schema (LangGraph Input/Output pattern) ────────────────────────
# Separates what the frontend is ALLOWED to write vs what the agent returns.
# This prevents accidental state leakage and documents state ownership.


class InputState(CopilotKitState):
    """State the frontend can WRITE to the agent.

    CopilotKitState provides:
      - messages: list[BaseMessage]   ← conversation history
      - copilotkit: dict              ← context entries, frontend tool actions, etc.
    No extra input-only fields needed right now.
    """


class OutputState(CopilotKitState):
    """State the agent sends BACK to the frontend after each turn.

    Inherits messages + copilotkit from CopilotKitState.
    Frontend-visible domain fields are added here explicitly.
    """
    maintenancePlan: Optional[list[MaintenanceStep]]
    issueReport: Optional[str]
    agentProgress: Optional[list[AgentProgressStep]]


class AgentState(OutputState):
    """Full internal graph state — superset of Input + Output.

    Add any internal-only (non-frontend) fields here as needed.
    Currently mirrors OutputState; separation allows easy future extension.
    """