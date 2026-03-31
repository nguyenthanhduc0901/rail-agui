"""
This is the main entry point for the agent.
It defines the workflow graph, state, tools, nodes and edges.
"""

from typing import Optional
import os
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import SystemMessage
from langgraph.graph import StateGraph, END, START
from langgraph.types import Command
from langgraph.checkpoint.memory import MemorySaver
from langchain_google_genai import ChatGoogleGenerativeAI
from src.rail_data import rail_tools
from src.state import AgentState


gemini_api_key = os.getenv("GEMINI_API_KEY")
if not gemini_api_key:
    raise ValueError("Missing GEMINI_API_KEY in environment variables.")

# MODEL_NAME = "gemini-2.5-flash-lite"
MODEL_NAME = "gemini-3-flash-preview"


async def start_node(state: AgentState, config: RunnableConfig) -> Command:
    return Command(goto="chat_node")


async def chat_node(state: AgentState, config: Optional[RunnableConfig] = None) -> Command:
    # Extract copilotkit context from frontend
    frontend_context = ""
    ck_context = state.get("copilotkit", {}).get("context", [])
    if ck_context:
        frontend_context = "\nFRONTEND CONTEXT (useCopilotReadable):\n"
        for item in ck_context:
            desc = item.get("description", "Context")
            val = item.get("value", "")
            frontend_context += f"- {desc}:\n{val}\n\n"

    system_prompt = (
        "You are a helpful AI assistant for a Rail Inspection Dashboard. "
        "You have a direct view of the current document and the list of diagnostic issues (tickets) reported for the carriage.\n\n"
        
        "COMMUNICATION RULES:\n"
        "1. ALWAYS respond and comment in ENGLISH.\n"
        "2. If the user asks to fix grammar without specifying an ID, and there is a 'CURRENTLY FOCUSED ISSUE', YOU MUST use the 'write_document' tool to replace its content. Do NOT ask for an issue ID in this case.\n"
        "3. If the user explicitly asks to fix a specific ticket ID (e.g., ISS-1001) that is NOT focused, use the 'proposeIssueDescriptionFix' tool.\n"
        "4. Be proactive. Do not ask the user for the old or new description if they are already visible in the context.\n\n"
        
        "DOCUMENT EDITING:\n"
        "1. To write or fix the focused report, you MUST use the 'write_document' tool.\n"
        "2. You MUST write the full document, even when changing only a few words.\n"
        "3. DO NOT repeat the document content as a plain text message.\n"
        "4. Briefly summarize the changes you made in 2 sentences max.\n\n"
        
        f"{frontend_context}"
        f"CURRENT DOCUMENT (FOCUSED ISSUE):\n----\n{state.get('document')}\n----\n"
        "Note: Check the tool definitions and available context for the list of issues and their IDs."
    )


    model = ChatGoogleGenerativeAI(
        model=MODEL_NAME,
        google_api_key=gemini_api_key,
        timeout=45,
        max_retries=2,
    )


    model_with_tools = model.bind_tools(rail_tools)


    try:
        response = await model_with_tools.ainvoke(
            [SystemMessage(content=system_prompt), *state["messages"]],
            config,
        )
    except Exception as e:
        print(f"DEBUG: Error in chat_node ainvoke: {str(e)}")
        # Log critical info for debugging
        if "Duplicate function declaration" in str(e):
            print(f"DEBUG: Current tool names: {[t.name if hasattr(t, 'name') else t.get('function', {}).get('name') for t in state.get('tools', [])]}")
        raise e

    messages = state["messages"] + [response]

    # If the model has tool calls, return that response and end for frontend processing (HITL)
    tool_calls = getattr(response, "tool_calls", [])
    if tool_calls:
        tool_call = tool_calls[0]
        # Compatible with both dict and object
        tc_args = tool_call["args"] if isinstance(tool_call, dict) else tool_call.args
        
        return Command(
            goto=END,
            update={
                "messages": messages, 
                "document": tc_args.get("document") if isinstance(tc_args, dict) else getattr(tc_args, "document", state.get("document"))
            },
        )

    return Command(goto=END, update={"messages": messages})


workflow = StateGraph(AgentState)
workflow.add_node("start_node", start_node)
workflow.add_node("chat_node", chat_node)
workflow.set_entry_point("start_node")
workflow.add_edge(START, "start_node")
workflow.add_edge("start_node", "chat_node")
workflow.add_edge("chat_node", END)

_is_fast_api = os.environ.get("LANGGRAPH_FAST_API", "false").lower() == "true"
graph = workflow.compile(checkpointer=MemorySaver() if _is_fast_api else None)
