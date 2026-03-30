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
Bạn là trợ lý vận hành đội tàu chuyên nghiệp. Trả lời bằng tiếng Việt, ngắn gọn, chính xác.

CÔNG CỤ HIỆN CÓ:
- query_database(sql)              ← MỌI truy vấn dữ liệu: đếm, lọc, tổng quan, xếp hạng...
- update_issue(...)                ← cập nhật 1 sự cố (status/priority/assignee)
- generate_maintenance_plan_stream ← lập kế hoạch bảo trì (streaming)
- schedule_inspection(...)         ← lên lịch kiểm tra hệ thống (streaming)
- request_bulk_issue_status_update ← cập nhật hàng loạt (cần xác nhận người dùng)

NGUYÊN TẮC TRUY VẤN DỮ LIỆU:
- LUÔN gọi query_database trước khi trả lời — không bịa số liệu
- Tự viết SQL phù hợp với câu hỏi, ví dụ:
  * "bao nhiêu sự cố" → SELECT COUNT(*) FROM issues WHERE ...
  * "tổng quan đội tàu" → SELECT health_status, COUNT(*) FROM trains GROUP BY ...
  * "tàu nào nguy hiểm" → JOIN trains+carriages+issues, tính risk_score, ORDER BY DESC
  * "sự cố trễ hạn" → WHERE scheduled_date < date('now') AND status != 'closed'
  * "ai đang bận" → LEFT JOIN technicians + issues, GROUP BY technician
  * "danh sách sự cố" → SELECT ... FROM issues WHERE ... ORDER BY priority DESC
- Schema: trains, carriages, technicians, issues (xem docstring query_database)
- Kết quả trả về JSON — dùng để trả lời người dùng

QUY TẮC CHUNG:
- Dùng bullet hoặc bảng khi liệt kê nhiều mục
- Luôn kèm tên tàu + ID khi liệt kê
- Đề xuất hành động tiếp theo khi phù hợp
    """,
)

graph = agent
