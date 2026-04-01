"use client";

import { useMemo } from "react";
import { useConfigureSuggestions } from "@copilotkit/react-core/v2";
import { useRailDashboardAI } from "@/features/rail-dashboard/context/rail-dashboard-ai-context";

export const useRailChatSuggestions = () => {
  const { filters } = useRailDashboardAI();

  const suggestions = useMemo(() => {
    const trainScoped =
      filters.trainId && filters.trainId !== "all"
        ? `Quick summary for train ${filters.trainId}`
        : "Which train has the highest risk level?";

    const systemScoped =
      filters.system && filters.system !== "all"
        ? `List open issues for the ${filters.system} system`
        : "Which system is generating the most errors?";

    return [
      { title: trainScoped, message: trainScoped },
      { title: systemScoped, message: systemScoped },
      { title: "Create a maintenance plan for high priority issues", message: "Create a maintenance plan for high priority issues" },
      { title: "Create a widget summarising the top 3 trains needing attention", message: "Create a widget summarising the top 3 trains needing attention" },
    ];
  }, [filters.trainId, filters.system]);

  useConfigureSuggestions({
    suggestions,
    available: "always",
  }, [suggestions]);
};