"use client";

import { useCopilotReadable } from "@copilotkit/react-core";

import {
  carriagesByTrain,
  issues,
  trains,
} from "@/features/rail-dashboard/data/railDataAdapter";

export const useRailDashboardContext = () => {
  useCopilotReadable({
    description:
      "FLEET_TRAINS: Danh sach tau va chi so tong quan (status, openIssues, efficiency).",
    value: trains.map((train) => ({
      id: train.id,
      name: train.name,
      status: train.status,
      openIssues: train.openIssues,
      efficiency: train.efficiency,
      healthyCarriages: train.healthyCarriages,
    })),
  });

  useCopilotReadable({
    description:
      "ACTIVE_ISSUES: Danh sach su co bao tri. priority: high|medium|low, status: open|in-progress|closed.",
    value: issues.map((issue) => ({
      id: issue.id,
      trainId: issue.trainId,
      carriageId: issue.carriageId,
      system: issue.system,
      title: issue.title,
      priority: issue.priority,
      status: issue.status,
      date: issue.date,
    })),
  });

  useCopilotReadable({
    description:
      "CARRIAGES: Danh sach toa theo tung tau, gom type, status va so issue.",
    value: Object.entries(carriagesByTrain).flatMap(([trainId, carriages]) =>
      carriages.map((carriage) => ({
        trainId,
        id: carriage.id,
        type: carriage.type,
        status: carriage.status,
        issues: carriage.issues,
      })),
    ),
  });
};