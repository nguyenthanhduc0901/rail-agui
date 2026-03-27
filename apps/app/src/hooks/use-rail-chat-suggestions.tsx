"use client";

import { useConfigureSuggestions } from "@copilotkit/react-core/v2";
import { useRailDashboardAI } from "@/features/rail-dashboard/context/rail-dashboard-ai-context";

export const useRailChatSuggestions = () => {
  const { filters } = useRailDashboardAI();

  const focusDescription = [
    `Focused train filter: ${filters.trainId}`,
    `System filter: ${filters.system}`,
    `Priority filter: ${filters.priority}`,
    `Status filter: ${filters.status}`,
  ].join("; ");

  useConfigureSuggestions({
    instructions: `
      You are generating proactive suggestion chips for a rail operations copilot.
      Current dashboard context: ${focusDescription}.

      Rules:
      - Suggest concise, actionable prompts in Vietnamese.
      - Keep suggestions focused on the current filter state.
      - If train filter is not 'all', include at least one suggestion about that train.
      - Include one suggestion about maintenance plan generation.
      - Include one suggestion about creating AI dashboard widgets.
      - Do not output generic help prompts.
    `,
    minSuggestions: 3,
    maxSuggestions: 4,
    available: "always",
  }, [filters.trainId, filters.system, filters.priority, filters.status]);
};