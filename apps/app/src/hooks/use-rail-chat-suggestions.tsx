"use client";

import { useMemo } from "react";
import { useConfigureSuggestions } from "@copilotkit/react-core/v2";
import { useRailDashboardAI } from "@/features/rail-dashboard/context/rail-dashboard-ai-context";

export const useRailChatSuggestions = () => {
  const { filters } = useRailDashboardAI();

  const suggestions = useMemo(() => {
    const trainScoped =
      filters.trainId && filters.trainId !== "all"
        ? `Tổng hợp nhanh tình trạng tàu ${filters.trainId}`
        : "Tàu nào đang có mức rủi ro cao nhất?";

    const systemScoped =
      filters.system && filters.system !== "all"
        ? `Liệt kê sự cố open của hệ ${filters.system}`
        : "Phân tích hệ thống nào đang phát sinh nhiều lỗi nhất";

    return [
      { title: trainScoped, message: trainScoped },
      { title: systemScoped, message: systemScoped },
      { title: "Lập kế hoạch bảo trì cho các sự cố priority high", message: "Lập kế hoạch bảo trì cho các sự cố priority high" },
      { title: "Tạo widget tổng hợp 3 tàu cần ưu tiên xử lý", message: "Tạo widget tổng hợp 3 tàu cần ưu tiên xử lý" },
    ];
  }, [filters.trainId, filters.system]);

  useConfigureSuggestions({
    suggestions,
    available: "always",
  }, [suggestions]);
};