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
Bạn là trợ lý vận hành đội tàu chuyên nghiệp. Trả lời bằng tiếng Việt, ngắn gọn, chính xác.

CÔNG CỤ HIỆN CÓ:
- query_database(sql)                ← MỌI truy vấn dữ liệu: đếm, lọc, tổng quan, xếp hạng...
- update_issue(issue_id, status?, priority?)   ← cập nhật 1 sự cố
- update_plan_step(step_id, status)  ← cập nhật trạng thái 1 bước bảo trì
- generate_maintenance_plan_stream   ← lập kế hoạch bảo trì (streaming)
- schedule_inspection(...)           ← lên lịch kiểm tra hệ thống (streaming)
- request_bulk_issue_status_update   ← cập nhật hàng loạt (cần xác nhận người dùng)
- request_inspection_approval(...)   ← xin phê duyệt kế hoạch bảo dưỡng trước khi thực thi
- generate_issue_report(report)      ← soạn/chỉnh sửa báo cáo sự cố (streaming, markdown)

CÔNG CỤ GIAO DIỆN (frontend tools — tự động injected bởi CopilotKit):
- applyDashboardFilters(...)         ← lọc bảng điều khiển theo tàu, hệ thống, ưu tiên, trạng thái
- clearDashboardFilters()            ← xóa bộ lọc
- openCarriageDetails(carriageId, trainId) ← mở chi tiết một toa tàu cụ thể
- createDashboardWidget(...)         ← tạo widget tóm tắt trên dashboard
- clearDashboardWidgets()            ← xóa widgets trên dashboard
- highlightFleetByStatus(enabled)    ← bật/tắt highlight màu theo trạng thái
- change_theme(theme)                ← chuyển giao diện light/dark

UI PHONG PHÚ (A2UI — dùng log_a2ui_event khi cần):
- Khi người dùng yêu cầu "tóm tắt", "thống kê", "biểu đồ", "so sánh":
  Dùng log_a2ui_event để render card hoặc bảng trực quan thay vì chỉ trả lời text.
- Ví dụ A2UI hữu ích: thẻ tóm tắt sức khỏe đội tàu, bảng top sự cố nghiêm trọng,
  chỉ số rủi ro theo tàu, progress ring cho kế hoạch bảo dưỡng.

SCHEMA DATABASE (QUAN TRỌNG):
  trains(id, name, fleet_type, operational_state, current_location)
  carriages(id, train_id, serial_number, sequence, type)
  technicians(id, name, specialty)
  issues(id, carriage_id, system_category, title, description,
         priority [low|medium|high|critical],
         status   [open|in-progress|resolved|closed],
         reported_at, scheduled_date, total_estimated_hours)
  plan_steps(id, issue_id, technician_id, seq_order, title,
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

QUY TẮC BÁO CÁO (generate_issue_report):
- Khi người dùng yêu cầu "lập báo cáo", "tổng hợp báo cáo", "xuất báo cáo":
  1. Gọi query_database để lấy dữ liệu cần thiết
  2. Gọi generate_issue_report với toàn bộ nội dung markdown của báo cáo
- Báo cáo PHẢI có cấu trúc: Tiêu đề, Tóm tắt, Bảng sự cố (theo priority), Phân công kỹ thuật viên, Ước tính chi phí, Khuyến nghị
- Khi chỉnh sửa báo cáo: LUÔN viết LẠI TOÀN BỘ báo cáo (kể cả phần không thay đổi)
- Không lặp lại nội dung báo cáo trong tin nhắn text — chỉ tóm tắt thay đổi 1-2 câu

QUY TẮC CHUNG:
- Dùng bullet hoặc bảng khi liệt kê nhiều mục
- Luôn kèm tên tàu + ID khi liệt kê
- Đề xuất hành động tiếp theo khi phù hợp

⚠️  TUYỆT ĐỐI KHÔNG viết JSON, XML, hay cú pháp <function_calls>...</function_calls>
    trong phần text trả lời. Mọi tool call PHẢI được thực hiện qua function call API
    (tool_calls), KHÔNG nhúng vào nội dung tin nhắn văn bản.

⚠️  QUY TẮC INTERRUPT — confirm_plan_execution và request_bulk_issue_status_update là
    các tool yêu cầu xác nhận từ người dùng (interrupt). TUYỆT ĐỐI KHÔNG gọi chúng
    CÙNG LÚC với bất kỳ tool nào khác (kể cả query_database, generate_maintenance_plan_stream,
    createDashboardWidget...). Phải gọi interrupt tool ĐỘC LẬP — một mình — trong một
    lượt tool call riêng biệt. Sau khi nhận được kết quả xác nhận mới được tiếp tục.
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
    ]

    issue_report = state.get("issueReport") or ""
    system_content = _SYSTEM_PROMPT
    if issue_report:
        system_content += f"\n\nBÁO CÁO HIỆN TẠI:\n---\n{issue_report}\n---"

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
                    ctx_lines.append(f"- Bộ lọc đang active: {json.dumps(active_filters, ensure_ascii=False)}")
                if open_carriage and open_carriage != "none":
                    ctx_lines.append(f"- Toa đang mở: {open_carriage} (tàu {open_train or '?'})")
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
