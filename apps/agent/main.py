"""
This is the main entry point for the agent.
It defines the workflow graph, state, tools, nodes and edges.
"""

import os

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_google_genai import ChatGoogleGenerativeAI

from src.rail_data import rail_tools
from src.state import AgentState

gemini_api_key = os.getenv("GEMINI_API_KEY")
if not gemini_api_key:
    raise ValueError("Missing GEMINI_API_KEY in environment variables.")

model = ChatGoogleGenerativeAI(
    model="gemini-3-flash-preview",
    google_api_key=gemini_api_key,
    timeout=45,
    max_retries=2,
)

agent = create_agent(
    model=model,
    tools=[*rail_tools],
    middleware=[CopilotKitMiddleware()],
    state_schema=AgentState,
    system_prompt="""
        Bạn là trợ lý vận hành đội tàu. Trả lời tiếng Việt, ngắn gọn.
        Dùng tool khi cần dữ liệu hoặc thao tác UI.
    """,
)

graph = agent
