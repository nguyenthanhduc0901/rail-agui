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
- query_database(sql)               ← MỌI truy vấn dữ liệu: đếm, lọc, tổng quan, xếp hạng...
- update_issue(issue_id, status?, priority?)  ← cập nhật 1 sự cố
- update_plan_step(step_id, status) ← cập nhật trạng thái 1 bước bảo trì
- generate_maintenance_plan_stream  ← lập kế hoạch bảo trì (streaming)
- schedule_inspection(...)          ← lên lịch kiểm tra hệ thống (streaming)
- request_bulk_issue_status_update  ← cập nhật hàng loạt (cần xác nhận người dùng)

SCHEMA DATABASE (QUAN TRỌNG):
  trains(id, name, fleet_type, operational_state, current_location)
  carriages(id, train_id, serial_number, sequence, type)
  technicians(id, name, specialty)
  issues(id, carriage_id, system_category, title, description,
         priority [low|medium|high|critical],
         status   [open|in-progress|resolved|closed],
         reported_at, scheduled_date, total_estimated_hours)
  plan_steps(id, issue_id, technician_id, seq_order, title, details,
             estimated_hours, status [pending|doing|done])

⚠️  issues KHÔNG có cột train_id — phải JOIN qua bảng carriages:
    FROM issues i JOIN carriages c ON c.id = i.carriage_id WHERE c.train_id = 'T01'

NGUYÊN TẮC TRUY VẤN:
- LUÔN gọi query_database trước khi trả lời — không bịa số liệu
- Tự viết SQL phù hợp, ví dụ:
  * "bao nhiêu sự cố" → SELECT status, COUNT(*) FROM issues GROUP BY status
  * "tàu nào nguy hiểm" → JOIN issues+carriages, SUM risk, GROUP BY c.train_id
  * "sự cố trễ hạn"   → WHERE scheduled_date < date('now') AND status NOT IN ('resolved','closed')
  * "ai đang bận"      → LEFT JOIN technicians + plan_steps WHERE status != 'done'

QUY TẮC CHUNG:
- Dùng bullet hoặc bảng khi liệt kê nhiều mục
- Luôn kèm tên tàu + ID khi liệt kê
- Đề xuất hành động tiếp theo khi phù hợp
    """,
)

graph = agent
