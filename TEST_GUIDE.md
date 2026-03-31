# 🚂 Rail AI Dashboard — Hướng dẫn kiểm thử toàn diện

> **Môi trường cần chạy trước:**
> - `pnpm dev:app` — Next.js frontend tại `http://localhost:3000`
> - `pnpm dev:agent` — LangGraph agent tại `http://localhost:8123`

---

## Mục lục

1. [Truy vấn dữ liệu (query_database)](#1-truy-vấn-dữ-liệu)
2. [Cập nhật sự cố đơn (update_issue)](#2-cập-nhật-sự-cố-đơn)
3. [Cập nhật bước bảo trì (update_plan_step)](#3-cập-nhật-bước-bảo-trì)
4. [Lập kế hoạch bảo trì streaming (generate_maintenance_plan_stream)](#4-lập-kế-hoạch-bảo-trì-streaming)
5. [Lên lịch kiểm tra hệ thống (schedule_inspection)](#5-lên-lịch-kiểm-tra-hệ-thống)
6. [Cập nhật hàng loạt — tự động duyệt ≤2 (request_bulk_issue_status_update)](#6-cập-nhật-hàng-loạt--tự-động-duyệt-2)
7. [Cập nhật hàng loạt — hiện dialog ≥3](#7-cập-nhật-hàng-loạt--hiện-dialog-3)
8. [Xác nhận kế hoạch thực thi (confirm_plan_execution)](#8-xác-nhận-kế-hoạch-thực-thi)
9. [Báo cáo sự cố (generate_issue_report)](#9-báo-cáo-sự-cố)
10. [Đề xuất kế hoạch hành động (proposeIssuePlan)](#10-đề-xuất-kế-hoạch-hành-động)
11. [Bộ lọc dashboard — áp dụng (applyDashboardFilters)](#11-bộ-lọc-dashboard--áp-dụng)
12. [Bộ lọc dashboard — xóa (clearDashboardFilters)](#12-bộ-lọc-dashboard--xóa)
13. [Tạo widget AI (createDashboardWidget)](#13-tạo-widget-ai)
14. [Xóa widgets (clearDashboardWidgets)](#14-xóa-widgets)
15. [Tô màu đội tàu theo trạng thái (highlightFleetByStatus)](#15-tô-màu-đội-tàu-theo-trạng-thái)
16. [Mở chi tiết toa — agent điều hướng (openCarriageDetails)](#16-mở-chi-tiết-toa--agent-điều-hướng)
17. [Highlight hệ thống nguy hiểm trong toa (highlightDangerousCarriageSystems)](#17-highlight-hệ-thống-nguy-hiểm-trong-toa)
18. [Ngữ cảnh toa đang xem (getActiveCarriageContext)](#18-ngữ-cảnh-toa-đang-xem)
19. [Đổi theme giao diện (change_theme)](#19-đổi-theme-giao-diện)
20. [Nút "Phân tích đội tàu" — runAgent programmatic](#20-nút-phân-tích-đội-tàu--runagent-programmatic)
21. [Nút "Dừng" — stopAgent](#21-nút-dừng--stopagent)
22. [Tự động refresh sau khi agent hoàn tất](#22-tự-động-refresh-sau-khi-agent-hoàn-tất)
23. [A2UI — Rich card tự sinh từ agent](#23-a2ui--rich-card-tự-sinh-từ-agent)
24. [Chat history guard — tự xóa lịch sử cũ](#24-chat-history-guard--tự-xóa-lịch-sử-cũ)

---

## 1. Truy vấn dữ liệu

**Công cụ:** `query_database(sql)`  
**Mô tả:** Agent chạy SQL SELECT để đọc dữ liệu từ SQLite fleet DB.

### TC-1.1 — Tổng quan trạng thái đội tàu

```
Cho tôi biết tổng số sự cố đang mở theo từng hệ thống là bao nhiêu?
```

**Đầu ra mong đợi:**
- Tool card `SQLQueryCard` hiển thị trong chat (query đang chạy → hoàn tất)
- Agent trả lời dạng bảng: HVAC / Brakes / Doors / Power / Network kèm số lượng sự cố mở
- Dữ liệu khớp với những gì hiển thị trên FleetDashboard

---

### TC-1.2 — Xếp hạng toa nguy hiểm nhất

```
Liệt kê 5 toa xe có nhiều sự cố critical nhất hiện tại.
```

**Đầu ra mong đợi:**
- `SQLQueryCard` hiển thị query đang chạy
- Danh sách 5 toa (carriage ID, train ID, số sự cố critical)
- Agent gợi ý xem chi tiết toa đầu tiên trong danh sách

---

### TC-1.3 — Truy vấn kỹ thuật viên

```
Ai là kỹ thuật viên chuyên về hệ thống Brakes? Hiện họ đang phụ trách bao nhiêu bước bảo trì chưa hoàn thành?
```

**Đầu ra mong đợi:**
- 1–2 lần gọi `query_database`
- Agent trả lời tên KTV, chuyên môn, số bước đang phụ trách với status `pending`/`doing`

---

### TC-1.4 — Tàu đang bảo trì

```
Tàu nào hiện đang ở trạng thái maintenance? Chúng đang ở đâu?
```

**Đầu ra mong đợi:**
- Query `SELECT * FROM trains WHERE operational_state = 'maintenance'`
- Danh sách tàu với `operational_state = maintenance` và `current_location`

---

## 2. Cập nhật sự cố đơn

**Công cụ:** `update_issue(issue_id, status?, priority?)`  
**Mô tả:** Cập nhật trạng thái hoặc độ ưu tiên của một sự cố duy nhất.

### TC-2.1 — Đóng sự cố

```
Cập nhật sự cố ISS-001 thành trạng thái resolved.
```

**Đầu ra mong đợi:**
- `IssueUpdateCard` hiện trong chat với issue ID + trạng thái mới
- Agent xác nhận cập nhật thành công
- Sau khi agent hoàn tất → dữ liệu trên FleetDashboard tự refresh (Feature 2)

---

### TC-2.2 — Nâng độ ưu tiên

```
Sự cố ISS-010 cần được nâng lên mức critical vì ảnh hưởng đến an toàn hành khách.
```

**Đầu ra mong đợi:**
- `IssueUpdateCard` với `priority: critical`
- Agent giải thích lý do và xác nhận hoàn tất

---

### TC-2.3 — Cập nhật kết hợp

```
Đánh dấu ISS-005 là in-progress và hạ priority xuống medium.
```

**Đầu ra mong đợi:**
- `IssueUpdateCard` hiển thị cả 2 thay đổi: status + priority
- Agent xác nhận

---

## 3. Cập nhật bước bảo trì

**Công cụ:** `update_plan_step(step_id, status)`  
**Mô tả:** Cập nhật trạng thái một bước trong kế hoạch bảo trì (`pending` → `doing` → `done`).

### TC-3.1 — Đánh dấu bước đang làm

```
Bước bảo trì STEP-001 đang được thực hiện, hãy cập nhật nó thành doing.
```

**Đầu ra mong đợi:**
- `PlanStepUpdateCard` hiện trong chat
- Bảng Maintenance Plan Board cập nhật trực quan (bước chuyển cột)

---

### TC-3.2 — Hoàn thành bước

```
Bước STEP-003 đã xong, đánh dấu done cho tôi.
```

**Đầu ra mong đợi:**
- `PlanStepUpdateCard` với status `done`
- Bảng Plan Board: bước từ cột "doing" sang "done"

---

## 4. Lập kế hoạch bảo trì streaming

**Công cụ:** `generate_maintenance_plan_stream`  
**Mô tả:** Agent tạo một kế hoạch bảo trì đầy đủ, streaming từng bước một ra UI.

### TC-4.1 — Tạo kế hoạch cho sự cố cụ thể

```
Tạo kế hoạch bảo trì chi tiết cho sự cố ISS-007 hệ thống HVAC.
```

**Đầu ra mong đợi:**
- `MaintenancePlanCard` hiện trong chat, trạng thái `inProgress` rồi `complete`
- Bảng Maintenance Plan Board xuất hiện hoặc cập nhật với các bước mới
- Mỗi bước có: tiêu đề, giờ ước tính, KTV phụ trách
- Sau khi xong: Plan board cố định, không ghi đè khi làm mới

---

### TC-4.2 — Kế hoạch toàn diện cho một tàu

```
Lập kế hoạch bảo trì tổng thể cho tàu T03 Harbor Intercity đang trong maintenance depot.
```

**Đầu ra mong đợi:**
- Nhiều bước bảo trì cho nhiều hệ thống (HVAC, Brakes, Power...)
- Plan Board hiển thị đầy đủ, tối đa 12 bước
- Agent tóm tắt tổng thời gian ước tính

---

## 5. Lên lịch kiểm tra hệ thống

**Công cụ:** `schedule_inspection`  
**Mô tả:** Tạo kế hoạch kiểm tra định kỳ cho một hoặc nhiều hệ thống của tàu.

### TC-5.1 — Kiểm tra hệ thống hãm

```
Lên lịch kiểm tra hệ thống phanh (Brakes) cho tàu T01 trong tuần tới.
```

**Đầu ra mong đợi:**
- `MaintenancePlanCard` với các bước kiểm tra Brakes
- Có KTV chuyên về "Brake Systems" được phân công
- Thời gian ước tính cho từng bước

---

### TC-5.2 — Kiểm tra đa hệ thống

```
Tàu T04 Metro Link cần kiểm tra cả hệ thống điện (Power) và mạng (Network). Lên lịch cho tôi.
```

**Đầu ra mong đợi:**
- Streaming kế hoạch có 2 nhóm bước: Power + Network
- KTV phù hợp với chuyên môn được gán cho từng nhóm

---

## 6. Cập nhật hàng loạt — tự động duyệt ≤2

**Công cụ:** `request_bulk_issue_status_update`  
**Tính năng:** Feature 6 — auto-resolve khi count ≤ 2 (không hiện dialog)

### TC-6.1 — Bulk update 1 sự cố (tự động)

```
Đóng tất cả sự cố resolved của tàu T02.
```

*(Giả sử chỉ có 1–2 sự cố resolved)*

**Đầu ra mong đợi:**
- `FilterActionCard` "Cập nhật hàng loạt" xuất hiện trong chat
- **Không hiện dialog xác nhận** — tự động approve ngay vì count ≤ 2
- Agent thông báo đã cập nhật thành công

---

### TC-6.2 — Bulk update 2 sự cố (tự động)

```
Đánh dấu tất cả sự cố open ưu tiên low của hệ thống Network thành closed.
```

*(Điều chỉnh để có đúng 2 sự cố phù hợp)*

**Đầu ra mong đợi:**
- Tự động approve, không hiện dialog
- Agent xác nhận 2 sự cố đã được cập nhật

---

## 7. Cập nhật hàng loạt — hiện dialog ≥3

**Công cụ:** `request_bulk_issue_status_update`  
**Tính năng:** Feature 6 — hiện UI xác nhận khi count ≥ 3

### TC-7.1 — Bulk update nhiều sự cố

```
Đổi tất cả sự cố in-progress của hệ thống Doors sang trạng thái resolved.
```

*(Cần có ≥ 3 sự cố in-progress của Doors)*

**Đầu ra mong đợi:**
- Agent tạm dừng, hiện **dialog xác nhận** trong chat
- Dialog liệt kê danh sách sự cố sẽ bị ảnh hưởng
- Nhấn **"Xác nhận"** → agent tiếp tục cập nhật, xác nhận hoàn tất
- Nhấn **"Hủy"** → agent dừng, không thay đổi gì

---

### TC-7.2 — Bulk update toàn bộ đội tàu

```
Đánh dấu tất cả sự cố resolved đã quá 7 ngày thành closed.
```

**Đầu ra mong đợi:**
- Dialog hiện với số lượng lớn sự cố
- Sau xác nhận: agent cập nhật batch, thông báo tổng số đã thay đổi

---

## 8. Xác nhận kế hoạch thực thi

**Công cụ:** `confirm_plan_execution`  
**Tính năng:** Feature 5 — typed interrupt `plan_execution_approval` với UI riêng (màu xanh)

### TC-8.1 — Yêu cầu thực thi kế hoạch

```
Hãy triển khai ngay kế hoạch bảo trì cho tàu T03, bao gồm tất cả các hệ thống HVAC và Brakes.
```

**Đầu ra mong đợi:**
- Công cụ `confirm_plan_execution` xuất hiện trong tool card
- Agent tạm dừng, hiện **dialog xác nhận màu xanh** với:
  - Tóm tắt kế hoạch (`planSummary`)
  - Tổng giờ ước tính (`estimatedTotalHours`)
  - Danh sách sự cố bị ảnh hưởng (`affectedIssues`)
- Nhấn **"Phê duyệt"** → agent tiếp tục, xác nhận kế hoạch được thực thi
- Nhấn **"Từ chối"** → agent dừng, thông báo kế hoạch bị hủy

---

### TC-8.2 — Từ chối execution

```
Lập kế hoạch và thực thi bảo trì khẩn cấp cho sự cố critical ISS-002.
```

- Khi dialog hiện: nhấn **"Từ chối"**

**Đầu ra mong đợi:**
- Agent nhận được `approved: false`
- Agent thông báo kế hoạch không được thực thi, đề xuất liên hệ quản lý

---

## 9. Báo cáo sự cố

**Công cụ:** `generate_issue_report`  
**Mô tả:** Agent tạo báo cáo chi tiết dạng văn bản, streaming từng từ.

### TC-9.1 — Báo cáo cho một sự cố

```
Tạo báo cáo chi tiết cho sự cố ISS-004 để gửi cho trưởng ga.
```

**Đầu ra mong đợi:**
- `IssueReportCard` trong chat hiển thị word count tăng dần (streaming)
- Sau khi hoàn tất → panel báo cáo mở ra ở phía bên (IssueReportPanel)
- Báo cáo gồm: mô tả sự cố, tác động, khuyến nghị hành động

---

### TC-9.2 — Báo cáo tổng hợp theo hệ thống

```
Tạo báo cáo tổng hợp tất cả sự cố critical của hệ thống Power trên toàn đội tàu.
```

**Đầu ra mong đợi:**
- Báo cáo nhiều sự cố, cấu trúc rõ ràng theo từng tàu/toa
- IssueReportPanel mở với nội dung đầy đủ

---

## 10. Đề xuất kế hoạch hành động

**Công cụ:** `proposeIssuePlan` (frontend tool)  
**Mô tả:** Agent đề xuất kế hoạch bước-by-bước cho một sự cố, hiện card với nút Approve/Reject.

### TC-10.1 — Đề xuất plan mới

```
Đề xuất kế hoạch hành động cụ thể để sửa sự cố ISS-006 hệ thống Doors.
```

**Đầu ra mong đợi:**
- `IssuePlanProposalCard` hiện trong chat với danh sách các bước
- Mỗi bước có: thứ tự, tiêu đề, giờ ước tính, KTV gợi ý
- Nhấn **"Approve"** → kế hoạch được lưu vào plan board
- Nhấn **"Reject"** → card bị dismiss

---

### TC-10.2 — Append thêm bước vào plan hiện có

```
Kế hoạch cho ISS-006 thiếu bước kiểm tra cảm biến. Hãy thêm 2 bước vào kế hoạch hiện tại.
```

**Đầu ra mong đợi:**
- `IssuePlanProposalCard` với `mode: append`, hiển thị rõ "thêm vào kế hoạch hiện có"
- Sau approve: plan board có thêm 2 bước mới phía dưới

---

## 11. Bộ lọc dashboard — áp dụng

**Công cụ:** `applyDashboardFilters` (frontend tool)  
**Mô tả:** Agent lọc FleetDashboard theo trainId, system, priority, status.

### TC-11.1 — Lọc theo tàu

```
Chỉ hiển thị sự cố của tàu T01 trên dashboard.
```

**Đầu ra mong đợi:**
- `FilterActionCard` "Đã áp dụng bộ lọc" trong chat
- FleetDashboard cập nhật ngay: chỉ còn sự cố của T01

---

### TC-11.2 — Lọc theo hệ thống + độ ưu tiên

```
Lọc dashboard để chỉ xem sự cố critical của hệ thống HVAC.
```

**Đầu ra mong đợi:**
- FilterActionCard với params `system: HVAC, priority: critical`
- Dashboard thu hẹp hiển thị

---

### TC-11.3 — Lọc theo trạng thái

```
Cho tôi xem tất cả sự cố đang in-progress trên toàn đội tàu.
```

**Đầu ra mong đợi:**
- FilterActionCard với `status: in-progress`
- Dashboard lọc theo status

---

## 12. Bộ lọc dashboard — xóa

**Công cụ:** `clearDashboardFilters` (frontend tool)

### TC-12.1 — Xóa tất cả bộ lọc

```
Xóa hết bộ lọc, cho tôi xem toàn bộ đội tàu.
```

**Đầu ra mong đợi:**
- `FilterActionCard` "Đã xoá bộ lọc"
- Dashboard hiển thị lại toàn bộ fleet không có filter

---

### TC-12.2 — Xóa khi đã rỗng

```
Reset dashboard về trạng thái ban đầu.
```

*(Khi không có filter nào đang active)*

**Đầu ra mong đợi:**
- Agent trả lời "Bộ lọc đã ở trạng thái reset rồi" (không gọi tool thừa)

---

## 13. Tạo widget AI

**Công cụ:** `createDashboardWidget` (frontend tool)  
**Mô tả:** Agent thêm widget thông tin vào dashboard (summary, risk, queue, trend).

### TC-13.1 — Widget tóm tắt rủi ro

```
Tạo widget hiển thị TOP 3 tàu có rủi ro cao nhất.
```

**Đầu ra mong đợi:**
- `WidgetToolCard` trong chat
- Widget xuất hiện trên dashboard với title, summary, severity `warning`/`critical`

---

### TC-13.2 — Widget hàng đợi bảo trì

```
Thêm widget hàng đợi bảo trì cho tàu T03.
```

**Đầu ra mong đợi:**
- Widget `kind: queue` xuất hiện với trainId = T03

---

### TC-13.3 — Phát hiện trùng lặp

```
Tạo widget rủi ro cho đội tàu.
```

*(Gọi lần 2 với cùng nội dung)*

**Đầu ra mong đợi:**
- Agent trả lời "Widget này đã tồn tại gần đây" — không thêm bản sao

---

## 14. Xóa widgets

**Công cụ:** `clearDashboardWidgets` (frontend tool)

### TC-14.1 — Xóa tất cả widgets

```
Xóa tất cả widget trên dashboard đi.
```

**Đầu ra mong đợi:**
- `FilterActionCard` "Đã xoá widgets"
- Khu vực widget trên dashboard trở về trống

---

## 15. Tô màu đội tàu theo trạng thái

**Công cụ:** `highlightFleetByStatus` (frontend tool)  
**Mô tả:** Bật/tắt màu sắc health status cho các toa trên FleetDashboard.

### TC-15.1 — Bật highlight

```
Tô màu các toa theo tình trạng sức khỏe: xanh là bình thường, đỏ là nguy hiểm.
```

**Đầu ra mong đợi:**
- `FilterActionCard` xác nhận bật
- Toa xe trên dashboard đổi màu: xanh / vàng / đỏ tùy health status

---

### TC-15.2 — Tắt highlight

```
Tắt màu trạng thái, trở về màu xám mặc định.
```

**Đầu ra mong đợi:**
- Tất cả toa xe về màu neutral gray

---

## 16. Mở chi tiết toa — agent điều hướng

**Công cụ:** `openCarriageDetails` (frontend tool)  
**Tính năng:** Feature 1 — agent chủ động mở modal toa mà không cần user click

### TC-16.1 — Mở toa bằng ID trực tiếp

```
Mở chi tiết toa C02-T03 cho tôi.
```

**Đầu ra mong đợi:**
- `FilterActionCard` "Mở chi tiết toa" trong chat
- **Modal chi tiết toa C02-T03 tự động mở** (không cần click vào toa)
- Sidebar hiển thị thông tin đúng toa

---

### TC-16.2 — Mở toa nguy hiểm nhất

```
Tìm toa có sự cố nghiêm trọng nhất và mở chi tiết cho tôi xem ngay.
```

**Đầu ra mong đợi:**
- Agent truy vấn DB tìm toa → gọi `openCarriageDetails`
- Modal mở đúng toa agent tìm được
- Agent giải thích lý do toa đó được chọn

---

### TC-16.3 — Mở từ ngữ cảnh tự nhiên

```
Kiểm tra xem toa đầu máy của tàu T01 có gì bất thường không?
```

**Đầu ra mong đợi:**
- Agent query DB tìm toa đầu máy (Head carriage) của T01
- Gọi `openCarriageDetails` với carriageId tương ứng
- Trả lời về tình trạng sự cố của toa đó

---

## 17. Highlight hệ thống nguy hiểm trong toa

**Công cụ:** `highlightDangerousCarriageSystems` (frontend tool)  
**Điều kiện:** Phải đang mở modal chi tiết của một toa

### TC-17.1 — Bật hiệu ứng highlight

*(Mở sẵn chi tiết một toa trước, ví dụ click vào toa C01-T02)*

```
Highlight các hệ thống có sự cố nguy hiểm trong toa này cho tôi.
```

**Đầu ra mong đợi:**
- Trong modal toa: các hệ thống có sự cố (Brakes, HVAC...) hiện hiệu ứng pulse/glow đỏ
- Agent xác nhận highlight đã bật

---

### TC-17.2 — Tắt highlight

```
Tắt hiệu ứng highlight trong toa này đi.
```

**Đầu ra mong đợi:**
- Hiệu ứng tắt, hệ thống về trạng thái bình thường

---

### TC-17.3 — Khi chưa mở toa nào

```
Highlight hệ thống nguy hiểm.
```

*(Không mở modal toa trước)*

**Đầu ra mong đợi:**
- Agent trả lời "Chưa có toa nào đang mở. Vui lòng click vào toa trước."

---

## 18. Ngữ cảnh toa đang xem

**Công cụ:** `getActiveCarriageContext` (frontend tool)  
**Mô tả:** Agent đọc thông tin toa đang mở trước khi thực hiện hành động

### TC-18.1 — Hành động trên toa đang xem

*(Đang mở modal chi tiết toa C03-T02)*

```
Toa này có sự cố gì không? Nếu có thì cập nhật tất cả thành in-progress.
```

**Đầu ra mong đợi:**
- Agent gọi `getActiveCarriageContext` → nhận `carriageId: C03-T02, trainId: T02`
- Query DB tìm sự cố của toa đó
- Cập nhật từng sự cố hoặc bulk update

---

### TC-18.2 — Hỏi về "toa này"

*(Đang mở modal toa bất kỳ)*

```
Toa này đang hoạt động bình thường không?
```

**Đầu ra mong đợi:**
- Agent dùng `getActiveCarriageContext` để biết ID toa
- Truy vấn và báo cáo tình trạng toa cụ thể đó

---

## 19. Đổi theme giao diện

**Công cụ:** `change_theme` (frontend tool)

### TC-19.1 — Chuyển sang dark mode

```
Đổi sang chế độ tối (dark mode) cho dễ nhìn ban đêm.
```

**Đầu ra mong đợi:**
- Giao diện chuyển sang dark theme ngay lập tức
- Agent xác nhận "Theme đã chuyển sang dark."

---

### TC-19.2 — Chuyển về light mode

```
Đổi lại màu sáng đi.
```

**Đầu ra mong đợi:**
- Giao diện về light theme
- Agent xác nhận

---

### TC-19.3 — Không thay đổi nếu đã đúng

```
Bật dark mode.
```

*(Khi đang ở dark mode rồi)*

**Đầu ra mong đợi:**
- Agent trả lời "Theme đang là dark rồi." — không gọi tool thừa

---

## 20. Nút "Phân tích đội tàu" — runAgent programmatic

**Tính năng:** Feature 3 — `copilotkit.runAgent()` kích hoạt agent từ nút bấm UI

### TC-20.1 — Kích hoạt phân tích

**Thao tác:** Nhấn nút **"Phân tích đội tàu"** ở toolbar trên chatbox (không gõ gì cả)

**Đầu ra mong đợi:**
- Một tin nhắn user tự động xuất hiện trong chat: "Phân tích tổng quan đội tàu..."
- Agent chạy ngay (nút bị disable khi agent đang chạy)
- Agent trả lời: tóm tắt trạng thái fleet, TOP 3 sự cố nghiêm trọng, đề xuất hành động ưu tiên
- Sau khi xong: dashboard tự refresh (Feature 2)

---

### TC-20.2 — Nút disable khi agent đang chạy

**Thao tác:** Nhấn "Phân tích đội tàu" trong khi agent đang xử lý câu hỏi khác

**Đầu ra mong đợi:**
- Nút bị grayed out (`disabled`), không phản hồi click
- Sau khi agent xong → nút active trở lại

---

## 21. Nút "Dừng" — stopAgent

**Tính năng:** Feature 3 — `copilotkit.stopAgent()` hủy luồng đang chạy

### TC-21.1 — Dừng agent giữa chừng

**Thao tác:**
1. Gõ một câu hỏi phức tạp: "Phân tích toàn bộ đội tàu và tạo báo cáo chi tiết cho từng toa"
2. Trong khi agent đang chạy → nhấn nút **"Dừng"**

**Đầu ra mong đợi:**
- Nút "Dừng" chỉ xuất hiện khi `agent.isRunning === true`
- Sau khi nhấn: agent ngừng streaming, tool cards dừng lại
- Nút "Dừng" biến mất, nút "Phân tích đội tàu" active lại

---

## 22. Tự động refresh sau khi agent hoàn tất

**Tính năng:** Feature 2 — `agent.subscribe({ onRunFinalized })`  
**Mô tả:** Sau mỗi lần agent hoàn thành, dữ liệu fleet tự refresh và progress bar xóa.

### TC-22.1 — Verify auto-refresh

**Thao tác:**
1. Cập nhật sự cố ISS-001 thành `resolved` qua chat
2. Quan sát FleetDashboard sau khi agent kết thúc

**Đầu ra mong đợi:**
- **Không cần F5** — sau ~1s agent hoàn tất, sự cố ISS-001 đã reflect `resolved` trên dashboard
- Progress bar/indicator của agent biến mất hoàn toàn

---

### TC-22.2 — Clear agent progress

**Thao tác:**
1. Gọi `schedule_inspection` để thấy AgentProgressView hiện
2. Chờ agent hoàn tất

**Đầu ra mong đợi:**
- AgentProgressView tự biến mất sau khi run finalized

---

## 23. A2UI — Rich card tự sinh từ agent

**Tính năng:** Feature 7 — `a2ui={{}}` trên CopilotKit provider + `copilotkit_actions` merge  
**Mô tả:** Agent có thể gọi `log_a2ui_event` để sinh ra rich UI card trong chat.

### TC-23.1 — Yêu cầu biểu đồ/card tóm tắt

```
Tóm tắt sức khỏe đội tàu bằng một card trực quan.
```

**Đầu ra mong đợi:**
- Agent gọi `log_a2ui_event` (bị ẩn khỏi tool card vì trong `ignoredTools`)
- Một rich card/component xuất hiện trong conversation với dữ liệu trực quan
- Chat vẫn sạch (không có tool card rác)

---

### TC-23.2 — Frontend tool từ A2UI

```
Dùng A2UI để gợi ý tôi lọc dashboard.
```

**Đầu ra mong đợi:**
- Agent có thể gọi các frontend tools (`applyDashboardFilters`) thông qua luồng A2UI
- Đầu ra tích hợp mượt mà không có lỗi routing

---

## 24. Chat history guard — tự xóa lịch sử cũ

**Tính năng:** `useChatHistoryGuard` — tự động xóa message cũ khi vượt ngưỡng

### TC-24.1 — Lịch sử dài

**Thao tác:** Chat liên tục nhiều lượt (>20 messages)

**Đầu ra mong đợi:**
- Không có lỗi context length từ Gemini API
- Message cũ nhất bị trim, cuộc hội thoại vẫn hoạt động bình thường
- Không có hiện tượng "agent quên ngữ cảnh quan trọng" của lượt ngay trước

---

## Checklist kiểm thử nhanh

| # | Tính năng | Tool/Hook | Ưu tiên |
|---|-----------|-----------|---------|
| 1 | Query dữ liệu cơ bản | `query_database` | 🔴 P0 |
| 2 | Cập nhật sự cố | `update_issue` | 🔴 P0 |
| 3 | Lập kế hoạch streaming | `generate_maintenance_plan_stream` | 🔴 P0 |
| 4 | Lọc dashboard | `applyDashboardFilters` | 🔴 P0 |
| 5 | Auto-refresh sau run | `agent.subscribe` | 🔴 P0 |
| 6 | Mở toa bằng AI | `openCarriageDetails` | 🟠 P1 |
| 7 | Bulk ≤2 auto-approve | `request_bulk_issue_status_update` | 🟠 P1 |
| 8 | Bulk ≥3 dialog | `request_bulk_issue_status_update` | 🟠 P1 |
| 9 | Plan approval interrupt | `confirm_plan_execution` | 🟠 P1 |
| 10 | Toolbar Phân tích / Dừng | `runAgent/stopAgent` | 🟠 P1 |
| 11 | Báo cáo sự cố | `generate_issue_report` | 🟡 P2 |
| 12 | Đề xuất plan | `proposeIssuePlan` | 🟡 P2 |
| 13 | Widget AI | `createDashboardWidget` | 🟡 P2 |
| 14 | Tô màu fleet | `highlightFleetByStatus` | 🟡 P2 |
| 15 | Highlight toa chi tiết | `highlightDangerousCarriageSystems` | 🟡 P2 |
| 16 | Đổi theme | `change_theme` | 🟢 P3 |
| 17 | A2UI rich card | `log_a2ui_event` | 🟢 P3 |
| 18 | Chat history guard | `useChatHistoryGuard` | 🟢 P3 |

---

*Tạo bởi GitHub Copilot — Rail AI Dashboard v1.0*
