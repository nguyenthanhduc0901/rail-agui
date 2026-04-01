"""
This is the main entry point for the agent.
It defines the workflow graph, state, tools, nodes and edges.
"""

import json
import os

from langchain_core.messages import SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode
from langgraph.types import Command

from src.rail_data import rail_tools
from src.state import AgentState, InputState, OutputState

gemini_api_key = os.getenv("GEMINI_API_KEY")
if not gemini_api_key:
    raise ValueError("Missing GEMINI_API_KEY in environment variables.")

model = ChatGoogleGenerativeAI(
    model="gemini-3-flash-preview",
    google_api_key=gemini_api_key,
    timeout=45,
    max_retries=2,
)

_SYSTEM_PROMPT = """
You are a professional rail fleet operations assistant. Reply in English, concisely and accurately.

AVAILABLE TOOLS:
- query_database(sql)                ← ALL data queries: counts, filters, overviews, rankings...
- update_issue(issue_id, status?, priority?)   ← update a single issue
- update_plan_step(step_id, status)  ← update a maintenance step status
- generate_maintenance_plan_stream   ← generate a maintenance plan (streaming)
- schedule_inspection(...)           ← schedule a system inspection (streaming)
- request_bulk_issue_status_update   ← bulk update (requires user confirmation/interrupt)
- request_inspection_approval(...)   ← request approval for a maintenance plan before execution
- generate_issue_report(report)      ← compose/edit an issue report (streaming, markdown)
- write_document(document)           ← write/edit the issue description open in the editor (plain text)

FRONTEND TOOLS (auto-injected by CopilotKit):
- applyDashboardFilters(...)         ← filter dashboard by train, system, priority, status
- clearDashboardFilters()            ← clear all active filters
- openCarriageDetails(carriageId, trainId) ← open a specific carriage detail panel
- createDashboardWidget(...)         ← create a summary widget on the dashboard
- clearDashboardWidgets()            ← remove all dashboard widgets
- highlightFleetByStatus(enabled)    ← toggle colour highlighting by status
- change_theme(theme)                ← switch light/dark theme

DATABASE SCHEMA (IMPORTANT):
  trains(id, name, fleet_type, operational_state, current_location)
  carriages(id, train_id, serial_number, sequence, type)
  technicians(id, name, specialty)
  issues(id, carriage_id, system_category, title, description,
         priority [low|medium|high|critical],
         status   [open|in-progress|resolved|closed],
         reported_at, scheduled_date, total_estimated_hours)
  plan_steps(id, issue_id, technician_id, seq_order, title,
             estimated_hours, status [pending|doing|done])

⚠️  issues has NO train_id column — must JOIN via carriages:
    FROM issues i JOIN carriages c ON c.id = i.carriage_id WHERE c.train_id = 'T01'

QUERY RULES:
- ALWAYS call query_database before answering — never fabricate data
- EXCEPTION: If the user asks to "generate a plan", you MAY:
  - Call query_database to verify issues exist (optional)
  - OR skip the query and call generate_maintenance_plan_stream directly (tool queries internally)
  - NEVER stop after the query without calling generate_maintenance_plan_stream!
- Write appropriate SQL yourself, e.g.:
  * "how many issues"   → SELECT status, COUNT(*) FROM issues GROUP BY status
  * "most at-risk train" → JOIN issues+carriages, SUM risk, GROUP BY c.train_id
  * "overdue issues"    → WHERE scheduled_date < date('now') AND status NOT IN ('resolved','closed')
  * "who is busy"       → LEFT JOIN technicians + plan_steps WHERE status != 'done'

MAINTENANCE PLAN RULES (generate_maintenance_plan_stream):
- WHEN TO CALL: User requests "generate a maintenance plan", "create a plan", "schedule repairs":

  ⚠️  MANDATORY 2-STEP FLOW:
  Step 1: (Optional) Call query_database to verify issues exist
  Step 2: (MANDATORY) Call generate_maintenance_plan_stream — NEVER stop at step 1!

  Example: User says "Generate a maintenance plan for high priority issues"
  → Query: SELECT ... FROM issues WHERE status='open' AND priority='high' ...
  → IMMEDIATELY: Call generate_maintenance_plan_stream(priority="high")
  → NEVER just reply "There are 5 high priority issues" and stop!

- AUTO-TRIGGER: If user mentions ["generate", "create", "build"] + ["plan", "maintenance", "schedule"]
  → ALWAYS call generate_maintenance_plan_stream with:
     priority: from user request if specified (high/critical/medium), default="high"
     train_id: if user specifies a train
     system: if user specifies a system
     max_steps: 8-12 steps (depending on request)

ISSUE REPORT RULES (generate_issue_report):
- When user asks to "generate a report", "compile a report", "export a report":
  1. Call query_database to retrieve the necessary data
  2. Call generate_issue_report with the full markdown report content
- Report MUST include: Title, Summary, Issue Table (by priority), Technician assignments, Estimated cost, Recommendations
- When editing a report: ALWAYS rewrite the ENTIRE report (even unchanged sections)
- Do not repeat report content in text messages — summarise changes in 1-2 sentences only

DESCRIPTION EDITING RULES (write_document):
- When "ISSUE DESCRIPTION BEING EDITED" is in context AND the user asks to:
  "fix grammar", "expand the description", "rewrite", "translate", "improve"...
  → IMMEDIATELY call write_document with the full new content (plain text, no markdown)
- Do NOT ask for clarification, do NOT explain first — call the tool immediately, then summarise briefly
- Content must be plain text (no #, **, _markdown_)

GENERAL RULES:
- Use bullets or tables when listing multiple items
- Always include train name + ID when listing
- Suggest follow-up actions where appropriate

⚠️  NEVER write JSON, XML, or <function_calls>...</function_calls> syntax in text replies.
    All tool calls MUST be made via the function call API (tool_calls), NOT embedded in message text.

⚠️  INTERRUPT RULE — request_bulk_issue_status_update requires user confirmation (interrupt).
    NEVER call it simultaneously with any other tool (including query_database,
    generate_maintenance_plan_stream, createDashboardWidget...).
    It MUST be called ALONE — in its own isolated tool call turn.
    Only continue after receiving the confirmation result.
"""


async def chat_node(state: AgentState, config: RunnableConfig):
    """Main reasoning node — invokes model with all tools."""
    # Enable predict_state streaming for generate_issue_report tool
    if config is None:
        config = RunnableConfig(recursion_limit=25)
    if not config.get("metadata"):
        config["metadata"] = {}
    config["metadata"]["predict_state"] = [
        {
            "state_key": "issueReport",
            "tool": "generate_issue_report",
            "tool_argument": "report",
        },
        {
            "state_key": "document",
            "tool": "write_document",
            "tool_argument": "document",
        },
    ]

    issue_report = state.get("issueReport") or ""
    current_document = state.get("document") or ""
    system_content = _SYSTEM_PROMPT
    if issue_report:
        system_content += f"\n\nCURRENT REPORT:\n---\n{issue_report}\n---"
    if current_document:
        system_content += f"\n\nISSUE DESCRIPTION BEING EDITED:\n---\n{current_document}\n---\nWhen the user asks to edit the description, call write_document with the full new content."

    # Inject dashboard context if available (injected by frontend via useAgentContext)
    # CopilotKit stores context as a list of {description, value} objects.
    # The frontend sends a single entry with value = JSON string of {activeFilters, openCarriageId, openTrainId}
    copilotkit_ctx = (state.get("copilotkit") or {})
    context_entries = copilotkit_ctx.get("context") or []
    if isinstance(context_entries, list) and context_entries:
        ctx_lines = []
        for entry in context_entries:
            raw_value = entry.get("value", "") if isinstance(entry, dict) else ""
            try:
                ctx_data = json.loads(raw_value) if isinstance(raw_value, str) else raw_value
            except (json.JSONDecodeError, TypeError):
                ctx_data = {}
            if isinstance(ctx_data, dict):
                active_filters = ctx_data.get("activeFilters")
                open_carriage  = ctx_data.get("openCarriageId")
                open_train     = ctx_data.get("openTrainId")
                if active_filters:
                    ctx_lines.append(f"- Active filters: {json.dumps(active_filters, ensure_ascii=False)}")
                if open_carriage and open_carriage != "none":
                    ctx_lines.append(f"- Open carriage: {open_carriage} (train {open_train or '?'})")
        if ctx_lines:
            system_content += "\n\nDASHBOARD CONTEXT (frontend):\n" + "\n".join(ctx_lines)

    # Merge rail tools with frontend tool schemas provided by CopilotKit runtime.
    # Frontend tools (useFrontendTool) and A2UI tools (log_a2ui_event) are injected
    # into state["copilotkit"]["actions"] by the TypeScript CopilotKit runtime.
    # Including them in bind_tools lets the model call them; execution is handled
    # client-side by CopilotKit — they never go through the Python ToolNode.
    copilotkit_actions = copilotkit_ctx.get("actions") or []
    all_tools = [*rail_tools, *copilotkit_actions]
    model_with_tools = model.bind_tools(all_tools)

    response = await model_with_tools.ainvoke(
        [SystemMessage(content=system_content), *state["messages"]],
        config,
    )

    tool_calls = getattr(response, "tool_calls", []) or []
    rail_tool_names = {t.name for t in rail_tools}
    # Route to ToolNode only when the model calls a backend (Python) rail tool.
    # Frontend/A2UI tool calls are intercepted by the CopilotKit runtime client-side.
    has_rail_tool_call = any(tc["name"] in rail_tool_names for tc in tool_calls)
    return Command(
        goto="tool_node" if has_rail_tool_call else END,
        update={"messages": state["messages"] + [response]},
    )


tool_node = ToolNode(rail_tools)

# Use explicit Input/Output schemas so only the declared contract is exposed.
# InputState  → what the frontend can write (messages + copilotkit context).
# OutputState → what the frontend receives (+ maintenancePlan, issueReport, agentProgress).
# AgentState  → full internal working state (currently = OutputState).
workflow = StateGraph(AgentState, input=InputState, output=OutputState)
workflow.add_node("chat_node", chat_node)
workflow.add_node("tool_node", tool_node)
workflow.add_edge(START, "chat_node")
workflow.add_edge("tool_node", "chat_node")

graph = workflow.compile()
