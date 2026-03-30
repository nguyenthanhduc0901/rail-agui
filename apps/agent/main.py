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

NGUYÊN TẮC QUAN TRỌNG:
- Luôn gọi tool trước khi trả lời — không bịa số liệu
- Chọn tool phù hợp nhất với câu hỏi:
  * "bao nhiêu" → count_issues
  * "tổng quan / overview" → get_fleet_overview
  * "chi tiết tàu" → get_train_summary
  * "chi tiết toa" → get_carriage_detail
  * "chi tiết sự cố ISS-" → get_issue_detail
  * "danh sách sự cố" → list_issues
  * "hệ thống nào tệ / phân tích" → get_system_analytics
  * "trễ hạn / quá hạn" → find_overdue_issues
  * "tàu nào nguy hiểm / xếp hạng" → rank_trains_by_risk
  * "ai bận / workload kỹ thuật viên" → get_technician_workload
  * "ai rảnh / tìm người" → find_available_technician
  * "cập nhật 1 sự cố" → update_issue
  * "kế hoạch bảo trì" → generate_maintenance_plan_stream
  * "lịch kiểm tra hệ thống" → schedule_inspection
  * "cập nhật hàng loạt" → request_bulk_issue_status_update

ĐỊNH DẠNG TRẢ LỜI:
- Dùng bullet hoặc bảng cho dữ liệu nhiều mục
- Luôn kèm tên tàu + ID khi liệt kê
- Làm nổi bật số liệu quan trọng
- Đề xuất hành động tiếp theo khi phù hợp
    """,
)

graph = agent
