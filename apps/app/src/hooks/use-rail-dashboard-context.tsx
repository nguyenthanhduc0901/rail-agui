"use client";

import { useAgentContext } from "@copilotkit/react-core/v2";

import {
  issues,
  trains,
} from "@/features/rail-dashboard/data/railDataSource";

export const useRailDashboardContext = () => {
  useAgentContext({
    description:
      "FLEET_TRAINS: Danh sách tàu và chỉ số tổng quan (status, openIssues, efficiency).",
    value: trains.map((train) => ({
      id: train.id,
      name: train.name,
      status: train.status,
      openIssues: train.openIssues,
      efficiency: train.efficiency,
      healthyCarriages: train.healthyCarriages,
    })),
  });

  // Chỉ gửi tóm tắt sự cố theo từng tàu (không gửi toàn bộ 550 issues)
  useAgentContext({
    description:
      "ISSUE_SUMMARY: Tóm tắt số sự cố theo tàu và priority. Dùng để trả lời nhanh câu hỏi tổng quan. Gọi tool search_issues hoặc get_train_details khi cần danh sách chi tiết.",
    value: trains.map((train) => {
      const trainIssues = issues.filter((i) => i.trainId === train.id);
      return {
        trainId: train.id,
        trainName: train.name,
        total: trainIssues.length,
        open: trainIssues.filter((i) => i.status === "open").length,
        inProgress: trainIssues.filter((i) => i.status === "in-progress").length,
        high: trainIssues.filter((i) => i.priority === "high").length,
        medium: trainIssues.filter((i) => i.priority === "medium").length,
        low: trainIssues.filter((i) => i.priority === "low").length,
      };
    }),
  });
};