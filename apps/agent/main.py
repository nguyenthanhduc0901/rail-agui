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
    timeout=None,
    max_retries=2,
)

agent = create_agent(
    model=model,
    tools=[*rail_tools],
    middleware=[CopilotKitMiddleware()],
    state_schema=AgentState,
    system_prompt="""

        Bạn là trợ lý AI hỗ trợ vận hành và bảo trì hệ thống tàu hỏa.

        Dữ liệu tóm tắt có sẵn trong context frontend (dùng trước, không cần gọi tool):
        - FLEET_TRAINS: tổng quan từng tàu (status, openIssues, efficiency)
        - ISSUE_SUMMARY: số sự cố theo tàu và priority

        Quy tắc chọn tool (chỉ gọi khi context không đủ):
        - "bao nhiêu sự cố..." → count_issues(filters)  — trả về {"count": N}
        - "chi tiết tàu X..." → get_train_summary(train_id) — trả stats, không có issue list
        - "liệt kê sự cố..." → list_issues(filters, limit=10) — tối đa 15 items, fields tóm tắt
        - "tổng quan đội tàu đầy đủ" → get_fleet_overview() — trả aggregate counts
        - "lập kế hoạch bảo trì" → generate_maintenance_plan_stream(train_id, priority)
        - "bulk update issue" → request_bulk_issue_status_update(priority, target_status, train_id)

        KHÔNG BAO GIỜ: gọi list_issues để đếm (dùng count_issues), gọi list_issues với limit > 15.

        Hướng dẫn chung:
        - Trả lời ngắn gọn, rõ ràng, ưu tiên tiếng Việt.
        - Đổi giao diện sáng/tối: setTheme (chỉ định rõ) hoặc toggleTheme (chung chung).
        - Lọc dashboard: applyDashboardFilters hoặc clearDashboardFilters.
        - Tạo/xóa widget: createDashboardWidget / clearDashboardWidgets.
        - Không bịa thông tin ngoài dữ liệu có trong context hoặc tool output.
    """,
)

graph = agent
