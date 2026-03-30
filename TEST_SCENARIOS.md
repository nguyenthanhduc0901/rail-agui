# 🧪 Test Scenarios cho Rail Dashboard Chatbot

Danh sách các tình huống test toàn diện cho AI Assistant quản lý đội tàu.

---

## 📊 1. Query Tools — Test Dữ Liệu & Hiển Thị

### 1.1 `get_fleet_overview` — Tổng Quan Đội Tàu
- **Input**: Không có tham số
- **Tests**:
  - [ ] Hiển thị đúng số tàu hoạt động / đang bảo trì / hỏng
  - [ ] Tính estimatedHours chính xác (tổng của tất cả sự cố outstanding)
  - [ ] Tính operationalState breakdown (pending/completed/total)
  - [ ] Card render đúng emoji + số liệu

### 1.2 `get_train_summary` — Tóm Tắt Tàu
- **Input**: `train_id` (e.g., "TR001", "TR010", "TR020")
- **Tests**:
  - [ ] Train hợp lệ: hiển thị `fleetType`, `status`, `estimatedRepairHours`, số sự cố cao/trung/thấp
  - [ ] Train không tồn tại: lỗi graceful
  - [ ] Train không hỏng (status="operational"): estimatedRepairHours = 0
  - [ ] Card render train ID + badge màu sắc theo status

### 1.3 `count_issues` — Đếm Sự Cố
- **Input**: `train_id` (optional), `priority` (optional), `status` (optional)
- **Tests**:
  - [ ] Không tham số: tổng tất cả sự cố
  - [ ] Lọc theo train: đếm đúng sự cố của tàu
  - [ ] Lọc theo priority: đếm "high" / "medium" / "low" riêng
  - [ ] Lọc theo status: "pending" vs "completed"
  - [ ] Kết hợp nhiều bộ lọc: giao hay hợp (giao là đúng)?

### 1.4 `list_issues` — Danh Sách Sự Cố
- **Input**: `train_id`, `priority`, `status` (tất cả optional)
- **Tests**:
  - [ ] Không tham số: danh sách tất cả sự cố (max 10)
  - [ ] Trả về đúng field: `id`, `title`, `priority`, `status`, `description`, `assigneeId`, `assigneeName`, `assigneeSpecialty`, `scheduledDate`, `estimatedHours`, `daysUntilDue`
  - [ ] `daysUntilDue` âm (quá hạn) hiển thị đúng
  - [ ] Sắp xếp đúng (high priority trước?)
  - [ ] Lọc hoạt động (train, priority, status)

### 1.5 `get_carriage_detail` — Chi Tiết Toa
- **Input**: `train_id`, `carriage_id`
- **Tests**:
  - [ ] Toa hợp lệ: hiển thị carriage_number, axle_count, door_count, systems (HVAC, Brakes, Doors, Power, Network)
  - [ ] Liệt kê sự cố trong toa đó
  - [ ] Toa không tồn tại: lỗi graceful

### 1.6 `get_issue_detail` — Chi Tiết Sự Cố
- **Input**: `issue_id`
- **Tests**:
  - [ ] Sự cố hợp lệ: hiển thị đầy đủ `id`, `title`, `description`, `priority`, `status`, `system`, `assignee_name`, `estimated_hours`, `days_until_due`
  - [ ] Sự cố không tồn tại: lỗi graceful

### 1.7 `get_system_analytics` — Phân Tích Hệ Thống
- **Input**: `system` (HVAC, Brakes, Doors, Power, Network) — optional
- **Tests**:
  - [ ] Không tham số: thống kê toàn bộ 5 hệ thống
  - [ ] Lọc một hệ thống: count sự cố, priority distribution, status breakdown
  - [ ] Hệ thống không có sự cố: chỉ ra 0% fail

### 1.8 `find_overdue_issues` — Sự Cố Trễ Hạn
- **Input**: `train_id` (optional), `priority` (optional)
- **Tests**:
  - [ ] Phát hiện quá hạn: `daysUntilDue < 0`
  - [ ] Không lọc: tất cả sự cố trễ hạn
  - [ ] Lọc train: sự cố trễ hạn của tàu
  - [ ] Lọc priority: sự cố trễ hạn cao/trung
  - [ ] Không có trễ hạn: danh sách rỗng

### 1.9 `rank_trains_by_risk` — Xếp Hạng Rủi Ro
- **Input**: `top_n` (default 5)
- **Tests**:
  - [ ] Công thức điểm: `failed_carriages * 3 + high_priority_issues * 2 + overdue_issues * 1.5`
  - [ ] Sắp xếp từ cao → thấp
  - [ ] Top 5 vs top 3 vs top 10
  - [ ] Card render công thức + danh sách rank

### 1.10 `get_technician_workload` — Khối Lượng Công Việc
- **Input**: Không có tham số
- **Tests**:
  - [ ] Tất cả kỹ thuật viên: tên, specialty, assigned_hours, current_issues (count)
  - [ ] Sắp xếp từ bận → rảnh: `assigned_hours` giảm dần
  - [ ] "Unassigned" issues trong workload?

### 1.11 `find_available_technician` — Tìm Kỹ Thuật Viên Rảnh
- **Input**: `specialty` (HVAC, Electrical, Brakes, Mechanical, Hydraulics)
- **Tests**:
  - [ ] Specialty hợp lệ: trả về kỹ thuật viên giờ ít nhất
  - [ ] Specialty không hợp lệ: lỗi graceful
  - [ ] Tất cả bận: vẫn trả về người ít bận nhất

---

## ✏️ 2. Action Tools — Test Mutations & Confirmations

### 2.1 `update_issue` — Cập Nhật Sự Cố (Sync Write)
- **Input**: `issue_id`, `status` (optional), `priority` (optional), `assignee_id` (optional)
- **Tests**:
  - [ ] Thay đổi status: pending → completed
  - [ ] Thay đổi priority: high → medium
  - [ ] Thay đổi assignee: tech_1 → tech_5
  - [ ] Kết hợp nhiều field: status + priority + assignee
  - [ ] Issue không tồn tại: lỗi graceful
  - [ ] State updates in-memory: gọi `list_issues` sau cập nhật, verify thay đổi

### 2.2 `schedule_inspection` — Lên Lịch Kiểm TRA (Stream Action)
- **Input**: `train_id`, `system` (HVAC/Brakes/Doors/Power/Network), `priority`
- **Tests**:
  - [ ] Tạo maintenance plan stream: hiển thị từng bước (⏳ → ✅)
  - [ ] Mỗi bước có: `title`, `details`, `estimatedHours`, `assigneeName`
  - [ ] Smartly assign technicians: chọn dựa trên specialty + workload
  - [ ] Total hours badge cộng đúng
  - [ ] MaintenancePlanCard render đầy đủ

### 2.3 `generate_maintenance_plan_stream` — Tạo Kế Hoạch Bảo Trì (Stream Action)
- **Input**: `train_id`, `priority`, `system` (optional)
- **Tests**:
  - [ ] Stream intermediate states: setMaintenancePlan được gọi nhiều lần
  - [ ] Mỗi bước: ID, title, status (done/pending), hours, assignee
  - [ ] Kế hoạch matching train issues
  - [ ] System filter hoạt động: nếu system=HVAC, chỉ HVAC steps
  - [ ] Card update real-time khi stream

### 2.4 `request_bulk_issue_status_update` — Cập Nhật Bulk (Approval Flow)
- **Input**: `issue_ids` (list), `new_status`, `reason`
- **Tests**:
  - [ ] Hiển thị confirmation metadata: danh sách issue, trạng thái mới, reason
  - [ ] User approve: mutations áp dụng in-memory
  - [ ] User reject: không thay đổi gì
  - [ ] After approve, verify state: gọi `list_issues` check status

---

## 🎨 3. Frontend — UI Rendering & State Sync

### 3.1 Tool Card Rendering
- [ ] **AnalysisQueryCard**: render đúng emoji + label + param badge
- [ ] **IssueUpdateCard**: hiển thị changes (status/priority/assignee)
- [ ] **RiskRankCard**: công thức rủi ro đúng
- [ ] **SystemAnalyticsCard**: hiển thị system hoặc "(toàn bộ)"
- [ ] **WorkloadCard**: find_available vs get_technician mode khác nhau
- [ ] **OverdueCard**: train_id + priority lọc đúng
- [ ] **MaintenancePlanCard**: total hours + per-step assignee/hours

### 3.2 State Sync & Reactivity
- [ ] User thay đổi todo (check, edit, delete) → agent state cập nhật
- [ ] Agent tool call → state update → UI re-render
- [ ] Agent + user cùng thay đổi → không conflict?
- [ ] Multiple tools gọi tuần tự: state maintain đúng

### 3.3 Vietnamese Text & Unicode
- [ ] Tất cả emoji render đúng: 🏆, 🔧, 👤, ⏰, etc.
- [ ] Vietnamese diacritics đúng: á, à, ả, ã, ạ, ă, ắ, ằ, ẳ, ẵ, ặ, â, ấ, ầ, ẩ, ẫ, ậ
- [ ] Spacing: " · " (bullet) render đúng
- [ ] Không có mojibake

---

## 💬 4. Agent Routing & System Prompt

### 4.1 Tool Invocation by Intent
User nói:
- [ ] "Bao nhiêu sự cố?" → `count_issues`
- [ ] "Tổng quan đội tàu" → `get_fleet_overview`
- [ ] "Tao tàu TR005" → `get_train_summary` with train_id="TR005"
- [ ] "Sự cố nào quá hạn?" → `find_overdue_issues`
- [ ] "Xếp hạng rủi ro" → `rank_trains_by_risk`
- [ ] "Khối lượng công việc kỹ thuật viên" → `get_technician_workload`
- [ ] "Tìm tech rảnh chuyên Brakes" → `find_available_technician` with specialty="Brakes"

### 4.2 Response Format (Vietnamese)
- [ ] Trả lời ngắn gọn (1-3 câu tóm tắt)
- [ ] Kèm tool name khi gọi: "Đang lấy dữ liệu..."
- [ ] Dùng bullet points hoặc table khi list
- [ ] Đề xuất hành động: "Bạn có muốn...?"
- [ ] Không bịa số liệu: luôn gọi tool trước

### 4.3 Error Handling
- [ ] Agent hỏi lại nếu input ambiguous: "Train nào? (VD: TR001, TR002)"
- [ ] Graceful lỗi: "Không tìm thấy train TR999"
- [ ] Timeout graceful: "Đang xử lý, vui lòng đợi..."

---

## 🔧 5. Technical Validation

### 5.1 TypeScript / Python
- [ ] `npx tsc --noEmit` pass (app)
- [ ] Python linting: no syntax errors
- [ ] No console.warn/error on tool exec

### 5.2 Data Integrity
- [ ] In-memory mutations don't corrupt state
- [ ] trainId consistency across tools
- [ ] carriageId validation
- [ ] Issue ID uniqueness

### 5.3 Performance
- [ ] Large `list_issues` (100+ items) not slow
- [ ] Stream tools show progress (not freeze UI)
- [ ] Workload snapshot computed once per call

---

## 🎯 6. End-to-End Scenarios

### Scenario 1️⃣: "Tàu nào rủi ro nhất?"
1. User: "Tàu nào rủi ro nhất?"
2. Agent → `rank_trains_by_risk`
3. Card render top 5 tàu + điểm
4. Verify: công thức đúng, sắp xếp đúng

### Scenario 2️⃣: "Cập nhật sự cố ISS-001 thành completed"
1. User: "Cập nhật ISS-001 thành completed"
2. Agent → `update_issue(issue_id="ISS-001", status="completed")`
3. IssueUpdateCard render change
4. State updates in-memory
5. Verify: `list_issues` không còn ISS-001 pending

### Scenario 3️⃣: "Lên lịch kiểm tra hệ thống HVAC tàu TR003"
1. User: "Lên lịch kiểm tra HVAC tàu TR003"
2. Agent → `schedule_inspection(train_id="TR003", system="HVAC", priority="high")`
3. MaintenancePlanCard stream steps (5-10 bước)
4. Mỗi bước: assignee + estimatedHours
5. Total hours badge = sum
6. Verify: technician assignments smart (workload-aware)

### Scenario 4️⃣: "Sao TR001 quá rủi ro? Sự cố nào?"
1. User: "Sao TR001 quá rủi ro?"
2. Agent → `get_train_summary(train_id="TR001")`
3. Card render: fleetType, status, estimatedRepairHours, priority breakdown
4. Agent → `list_issues(train_id="TR001")` (auto or user follow?)
5. Verify: high/medium/low issue count match

### Scenario 5️⃣: "Hệ thống nào bị hỏng nhiều?"
1. User: "Hệ thống nào bị hỏng?"
2. Agent → `get_system_analytics()`
3. Card render: HVAC x5, Brakes x3, Doors x2, Power x1, Network x1
4. Verify: tính phần trăm đúng

### Scenario 6️⃣: Multi-turn Conversation
1. User: "Tổng quan đội tàu"
   - Agent: `get_fleet_overview` → 15 tàu, 5 bảo trì, 2 hỏng
2. User: "Tàu nào hỏng?"
   - Agent: `list_issues` with status="pending" or similar logic
3. User: "Fix tàu TR009"
   - Agent: phải hỏi "cần làm gì?" (generate_plan? update status?)
4. User: "Lên kế hoạch sửa TR009"
   - Agent: `generate_maintenance_plan_stream`

---

## 📋 7. Regression Test Checklist

Run before each commit:
- [ ] TS compile clean
- [ ] All 15 tools listed in registry
- [ ] No hardcoded test data in tool outputs
- [ ] In-memory state mutations don't break next tool call
- [ ] Stream tools emit intermediate state events
- [ ] Vietnamese text + emoji no mojibake
- [ ] MaintenancePlanCard shows assigneeName + estimatedHours
- [ ] AnalysisQueryCard shows correct LABELS for all 6 query tools
- [ ] IssueUpdateCard shows status/priority/assignee changes
- [ ] RiskRankCard shows top_n formula hint
- [ ] WorkloadCard routers to both tools correctly
- [ ] OverdueCard filters train_id + priority

---

## 🚀 How to Run

```bash
# 1. Dev server
cd c:\Project\rail-agui
pnpm dev

# 2. TypeScript check
cd apps/app
npx tsc --noEmit

# 3. Manual testing
# Open http://localhost:3000 → Rail Dashboard
# Chat with: "Tổng quan đội tàu", "Sự cố nào quá hạn?", etc.

# 4. Inspect state
# Browser DevTools → Network → copilotkit requests
# Check agent.state.todos or state changes
```

---

**Cập nhật lần cuối**: 2026-03-30  
**Version**: v1.5 (15 tools, smart tech assignment)
