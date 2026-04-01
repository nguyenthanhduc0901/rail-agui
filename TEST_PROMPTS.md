# Test Prompts — Rail Dashboard Chatbot

Danh sách các prompt để test với chatbot CopilotKit, tập trung vào các tương tác UI.

---

## 🔍 Truy vấn dữ liệu (`query_database`)

```
Tàu nào đang có mức rủi ro cao nhất?
Bao nhiêu sự cố đang open?
Liệt kê tất cả sự cố priority critical
Ai là kỹ thuật viên đang bận nhất?
Sự cố nào đang trễ hạn?
Phân tích hệ thống nào đang phát sinh nhiều lỗi nhất
Tổng hợp nhanh tình trạng tàu T01
```

---

## 🎛️ Tương tác Dashboard UI (frontend tools)

### Lọc dữ liệu (`applyDashboardFilters` / `clearDashboardFilters`)
```
Lọc tàu T01
Chỉ hiển thị sự cố priority critical
Lọc hệ thống Brakes
Lọc tàu T03 hệ thống Power
Xóa bộ lọc
Hiển thị tất cả tàu
```

### Highlight đội tàu (`highlightFleetByStatus`)
```
Tô màu đội tàu theo trạng thái sức khỏe
Highlight theo trạng thái sức khỏe
Tắt highlight màu
```

### Chi tiết toa tàu (`openCarriageDetails` / `highlightDangerousCarriageSystems`)
```
Mở chi tiết toa C02 của tàu T03
Xem toa đầu tàu T01
Làm nổi bật hệ thống nguy hiểm trong toa này
```

### Đổi theme (`change_theme`)
```
Chuyển sang dark mode
Bật light theme
```

---

## 📊 Widget Dashboard (`createDashboardWidget` / `clearDashboardWidgets`)

```
Tạo widget tổng hợp 3 tàu cần ưu tiên xử lý
Thêm widget top rủi ro về phanh
Tạo widget xếp hạng sự cố theo mức độ nghiêm trọng
Tạo widget tóm tắt sức khỏe đội tàu
Xóa widgets
```

---

## 🔧 Kế hoạch bảo trì (`generate_maintenance_plan_stream`)

```
Lập kế hoạch bảo trì cho các sự cố priority high
Lên kế hoạch bảo trì priority critical
Tạo kế hoạch bảo dưỡng tàu T03
Lập kế hoạch cho hệ thống Brakes
```

### Lên lịch kiểm tra (`schedule_inspection`)

```
Lên lịch kiểm tra HVAC và Brakes cho T01
Lên lịch kiểm tra toàn bộ hệ thống tàu T02
```

---

## 📝 Báo cáo (`generate_issue_report`)

```
Lập báo cáo sự cố tàu T01
Tổng hợp báo cáo cho hệ thống Brakes
Xuất báo cáo toàn bộ sự cố priority high
Lập báo cáo đầy đủ tình trạng đội tàu
```

---

## ✏️ Cập nhật dữ liệu

### Cập nhật 1 sự cố (`update_issue`)
```
Chuyển ISS-1023 sang trạng thái in-progress
Đặt sự cố này thành resolved
Tăng priority của ISS-1010 lên critical
```

### Cập nhật hàng loạt (`request_bulk_issue_status_update`) — ⚠️ có popup xác nhận khi > 2 sự cố
```
Chuyển tất cả sự cố high thành in-progress
Đóng tất cả sự cố resolved trên T02
Cập nhật toàn bộ sự cố open của hệ thống HVAC sang in-progress
```

---

## 💡 Prompt kết hợp nhiều tools

```
Tàu T01 đang có vấn đề gì? Mở chi tiết toa đầu tiên cho tôi xem
Lọc sự cố Brakes priority high rồi lập kế hoạch bảo trì
Tạo báo cáo và widget tổng hợp tình trạng đội tàu
Highlight đội tàu rồi cho biết tàu nào cần xử lý gấp nhất
```

---

## ℹ️ Ghi chú

| Feature | Tool | Loại | Ghi chú |
|---|---|---|---|
| Truy vấn SQL | `query_database` | Backend | Trả về text/bảng trong chat |
| Lọc dashboard | `applyDashboardFilters` | Frontend | Cập nhật filter UI ngay lập tức |
| Tạo widget | `createDashboardWidget` | Frontend | Thêm card vào dashboard |
| Mở toa tàu | `openCarriageDetails` | Frontend | Mở modal chi tiết |
| Kế hoạch bảo trì | `generate_maintenance_plan_stream` | Backend | Streaming realtime, hiện bảng kế hoạch |
| Báo cáo | `generate_issue_report` | Backend | Streaming, lưu vào agent state |
| Cập nhật hàng loạt | `request_bulk_issue_status_update` | Backend | Interrupt — cần xác nhận nếu > 2 sự cố |
