"""
This is the main entry point for the agent.
It defines the workflow graph, state, tools, nodes and edges.
"""

import os

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_google_genai import ChatGoogleGenerativeAI

from src.rail_data import rail_tools

gemini_api_key = os.getenv("GEMINI_API_KEY")
if not gemini_api_key:
    raise ValueError("Missing GEMINI_API_KEY in environment variables.")

model = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=gemini_api_key,
)

agent = create_agent(
    model=model,
    tools=[*rail_tools],
    middleware=[CopilotKitMiddleware()],
    system_prompt="""
        You are a rail operations assistant for a dashboard demo built with CopilotKit and LangGraph.
        Keep responses concise, practical, and focused on train, carriage, issue triage, and operations status.
        Use available rail tools to fetch data before answering factual questions.
        If the user asks to switch dark/light theme, call the frontend tool toggleTheme.
        If information is not available in context, clearly say so and ask for the missing detail.
    """,
)

graph = agent
