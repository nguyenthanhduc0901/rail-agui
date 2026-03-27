"use client";

import { useConfigureSuggestions } from "@copilotkit/react-core/v2";

export const useRailChatSuggestions = () => {
  useConfigureSuggestions({
    suggestions: [
      {
        title: "Tổng quan đội tàu",
        message:
          "Cho tôi tổng quan toàn bộ đội tàu: số tàu critical/warning/healthy và 5 tàu cần ưu tiên xử lý ngay.",
      },
      {
        title: "Khoanh vùng sự cố theo tàu",
        message:
          "Phân tích tàu T01: toa nào có nhiều lỗi nhất, lỗi nào đang open và đề xuất thứ tự xử lý.",
      },
      {
        title: "Lọc sự cố theo hệ thống",
        message:
          "Lọc các sự cố hệ thống braking có mức độ high và status open, sau đó tóm tắt theo trainId.",
      },
      {
        title: "Kế hoạch bảo trì ngắn",
        message:
          "Lập kế hoạch xử lý trong 24h cho 10 sự cố nghiêm trọng nhất, gồm train, carriage, lý do ưu tiên và hành động đề xuất.",
      },
    ],
    available: "always",
  });
};