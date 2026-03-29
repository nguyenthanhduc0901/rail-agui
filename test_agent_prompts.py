#!/usr/bin/env python3
"""
Test script để kiểm tra agent prompt trên tất cả test cases
Dùng HTTP requests tới CopilotKit API (port 3000)
"""

import requests
import json
import time
import sys
from typing import Any

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8') if hasattr(sys.stdout, 'reconfigure') else None

# Test cases - mỗi tuple là (description, user_input, expected_tool_or_behavior)
TEST_CASES = [
    # ===== GREETING / NO TOOL CASES =====
    ("greeting_hi", "hi", None),
    ("greeting_hello", "hello", None),
    ("greeting_thanks", "cảm ơn bạn", None),
    
    # ===== BACKEND TOOL CASES =====
    ("backend_fleet_overview", "tổng quan đội tàu", "get_fleet_overview"),
    ("backend_count_issues", "có bao nhiêu sự cố", "count_issues"),
    ("backend_count_high_priority", "bao nhiêu sự cố priority cao", "count_issues"),
    ("backend_list_issues", "liệt kê các sự cố", "list_issues"),
    ("backend_train_summary", "chi tiết tàu T001", "get_train_summary"),
    ("backend_maintenance_plan", "lập kế hoạch bảo trì cho tàu T002", "generate_maintenance_plan_stream"),
    
    # ===== FRONTEND UI TOOL CASES =====
    ("frontend_set_dark_theme", "đổi theme tối", "setTheme"),
    ("frontend_set_light_theme", "đổi theme sáng", "setTheme"),
    ("frontend_apply_filter", "lọc sự cố priority cao", "applyDashboardFilters"),
    ("frontend_clear_filter", "xóa lọc", "clearDashboardFilters"),
    ("frontend_create_widget", "tạo widget hiển thị tàu có vấn đề", "createDashboardWidget"),
    ("frontend_clear_widgets", "xóa tất cả widget", "clearDashboardWidgets"),
    
    # ===== EDGE CASES =====
    ("edge_combined_request", "xem tàu T001 rồi đổi theme tối", None),  # should handle both
    ("edge_ambiguous", "dữ liệu", None),  # might ask or show overview
    ("edge_wrong_train_id", "chi tiết tàu INVALID999", "get_train_summary"),  # should still call tool
]

def test_agent_prompt(test_name: str, user_input: str, expected_tool: str | None) -> dict[str, Any]:
    """
    Test một prompt đơn lẻ bằng cách gửi tới CopilotKit API
    """
    print(f"\n{'='*70}")
    print(f"TEST: {test_name}")
    print(f"INPUT: {user_input}")
    if expected_tool:
        print(f"EXPECTED TOOL: {expected_tool}")
    else:
        print(f"EXPECTED: No tool call (greeting)")
    print('='*70)
    
    try:
        # Send tới CopilotKit API qua Next.js route
        # POST /api/copilotkit - nhận input, return output
        url = "http://localhost:3000/api/copilotkit"
        
        payload = {
            "messages": [
                {
                    "id": "test-msg-1",
                    "role": "user",
                    "content": user_input
                }
            ]
        }
        
        print("[>] Sending to " + url + "...")
        response = requests.post(url, json=payload, timeout=30, headers={"Content-Type": "application/json"})
        
        if response.status_code == 400:
            print("[!] Bad Request (400):")
            print("    Response: " + response.text[:200])
            return {
                "test_name": test_name,
                "user_input": user_input,
                "expected_tool": expected_tool,
                "status": "ERROR",
                "error": "400 Bad Request: " + response.text[:100],
            }
        
        response.raise_for_status()
        
        data = response.json()
        
        # Extract tool calls từ response
        tool_calls = []
        if "messages" in data:
            for msg in data["messages"]:
                if msg.get("type") == "ai" and msg.get("tool_calls"):
                    tool_calls.extend(msg["tool_calls"])
        
        # Determine pass/fail
        passed = True
        if expected_tool:
            # Should have called a tool
            if not tool_calls:
                passed = False
                print("[X] Expected tool '" + expected_tool + "' but got none")
            else:
                found_tool = any(tc.get("name") == expected_tool for tc in tool_calls)
                if not found_tool:
                    passed = False
                    tool_names = str([tc.get("name") for tc in tool_calls])
                    print("[X] Expected tool '" + expected_tool + "' but got: " + tool_names)
                else:
                    print("[+] Tool '" + expected_tool + "' called correctly")
        else:
            # Should NOT call a tool
            if tool_calls:
                passed = False
                tool_names = str([tc.get("name") for tc in tool_calls])
                print("[X] Expected no tools but got: " + tool_names)
            else:
                print("[+] Responded naturally without tools")
        
        result = {
            "test_name": test_name,
            "user_input": user_input,
            "expected_tool": expected_tool,
            "status": "PASS" if passed else "FAIL",
            "tool_calls": [tc.get("name") for tc in tool_calls],
            "tool_calls_count": len(tool_calls),
        }
        
        return result
        
    except requests.exceptions.ConnectionError:
        print("[X] Connection Error: Can't reach " + url)
        print("    Make sure: pnpm dev is running (port 3000 + 8123)")
        return {
            "test_name": test_name,
            "user_input": user_input,
            "expected_tool": expected_tool,
            "status": "ERROR",
            "error": "Connection failed - server not running",
        }
    except Exception as e:
        print("[X] Error: " + str(e))
        return {
            "test_name": test_name,
            "user_input": user_input,
            "expected_tool": expected_tool,
            "status": "ERROR",
            "error": str(e),
        }


def run_all_tests():
    """Run tất cả test cases"""
    print("\n" + "="*70)
    print("[START] AGENT PROMPT TEST SUITE")
    print("="*70)
    print("Testing on http://localhost:3000/api/copilotkit")
    print("Make sure 'pnpm dev' is running...\n")
    
    results = []
    passed = 0
    failed = 0
    errors = 0
    
    for test_name, user_input, expected_tool in TEST_CASES:
        result = test_agent_prompt(test_name, user_input, expected_tool)
        results.append(result)
        
        if result["status"] == "PASS":
            passed += 1
        elif result["status"] == "FAIL":
            failed += 1
        else:
            errors += 1
        
        time.sleep(0.5)  # Rate limit
    
    # Summary
    print("\n" + "="*70)
    print("[SUMMARY] TEST RESULTS")
    print("="*70)
    print("Total:   " + str(len(TEST_CASES)))
    print("[PASS]   " + str(passed))
    print("[FAIL]   " + str(failed))
    print("[ERROR]  " + str(errors))
    print("="*70)
    
    # Show failures
    if failed > 0 or errors > 0:
        print("\n[FAILURES/ERRORS]:")
        for r in results:
            if r["status"] != "PASS":
                error_msg = r.get("error", r["status"])
                print("  - " + r["test_name"] + ": " + str(error_msg))
    
    # Save results to file
    with open("test_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print("\n[OUTPUT] Results saved to test_results.json")
    
    return results


if __name__ == "__main__":
    run_all_tests()
