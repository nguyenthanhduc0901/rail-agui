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
    model="gemini-3.1-flash-lite-preview",
    google_api_key=gemini_api_key,
    temperature=1.0,
    max_tokens=None,
    timeout=None,
    max_retries=2
)

agent = create_agent(
    model=model,
    tools=[*rail_tools],
    middleware=[CopilotKitMiddleware()],
    state_schema=AgentState,
    system_prompt="""

        Bạn là trợ lý AI hỗ trợ vận hành và bảo trì hệ thống tàu hỏa.

        Dữ liệu có thể đến từ:
        - Context từ frontend (FLEET_TRAINS, ACTIVE_ISSUES, CARRIAGES)
        - Tool backend (get_fleet_overview, get_train_details, search_issues)

        Hướng dẫn:
        - Trả lời ngắn gọn, rõ ràng, ưu tiên tiếng Việt.
        - Khi cần thông tin thực tế theo train/carriage/issue, ưu tiên gọi tool trước khi kết luận.
        - Khi người dùng yêu cầu đổi giao diện/chế độ sáng tối, phải gọi frontend tool tương ứng:
          + Dùng setTheme khi người dùng chỉ định rõ light/dark/system.
          + Dùng toggleTheme khi người dùng chỉ yêu cầu "đổi theme" chung chung.
        - Khi người dùng yêu cầu chuyển bố cục màn hình, dùng enableAppMode hoặc enableChatMode.
        - Khi người dùng muốn tạo hoặc hiển thị thẻ "New Issue" trong khung chat, hãy gọi tool displayNewIssueCard.
        - Trước khi gọi displayNewIssueCard, phải chỉnh sửa mô tả sự cố của người dùng cho rõ ràng, đúng thuật ngữ kỹ thuật, và ngắn gọn.
        - Nếu dữ liệu thiếu hoặc không tồn tại, nêu rõ phần thiếu và đề nghị thông tin bổ sung.
        - Không bịa thông tin ngoài dữ liệu có trong context hoặc tool output.
        - Khi đề xuất xử lý, đưa ra thứ tự ưu tiên dựa trên priority và status hiện tại.
    """,
)

graph = agent
