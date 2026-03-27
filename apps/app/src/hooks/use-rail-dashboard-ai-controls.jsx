"use client";

import { z } from "zod";
import { useFrontendTool, useInterrupt } from "@copilotkit/react-core/v2";

import { useRailDashboardAI } from "@/features/rail-dashboard/context/rail-dashboard-ai-context";

const filterSchema = z.object({
  trainId: z.string().optional(),
  system: z.string().optional(),
  priority: z.enum(["high", "medium", "low", "all"]).optional(),
  status: z.enum(["open", "in-progress", "closed", "all"]).optional(),
});

export const useRailDashboardAIControls = () => {
  const {
    updateFilters,
    clearFilters,
    addWidget,
    clearWidgets,
  } = useRailDashboardAI();

  useFrontendTool(
    {
      name: "applyDashboardFilters",
      description:
        "Apply rail dashboard filters for train, system, priority, and status. Use this when users ask to filter the main dashboard.",
      parameters: filterSchema,
      handler: async (args) => {
        updateFilters({
          trainId: args.trainId,
          system: args.system,
          priority: args.priority,
          status: args.status,
        });

        return "Dashboard filters applied.";
      },
    },
    [updateFilters],
  );

  useFrontendTool(
    {
      name: "clearDashboardFilters",
      description:
        "Reset all rail dashboard filters to show the full fleet view.",
      parameters: z.object({}),
      handler: async () => {
        clearFilters();
        return "Dashboard filters were reset.";
      },
    },
    [clearFilters],
  );

  useFrontendTool(
    {
      name: "createDashboardWidget",
      description:
        "Create an AI-generated widget block on the rail dashboard, such as top risk trains or maintenance queue.",
      parameters: z.object({
        kind: z.enum(["summary", "risk", "queue", "trend"]).default("summary"),
        title: z.string(),
        summary: z.string().optional(),
        value: z.string().optional(),
        severity: z.enum(["info", "warning", "critical"]).default("info"),
        trainId: z.string().optional(),
      }),
      handler: async (args) => {
        addWidget(args);
        return `Widget '${args.title}' created on dashboard.`;
      },
    },
    [addWidget],
  );

  useFrontendTool(
    {
      name: "clearDashboardWidgets",
      description: "Clear all AI-generated dashboard widgets.",
      parameters: z.object({}),
      handler: async () => {
        clearWidgets();
        return "All dashboard widgets cleared.";
      },
    },
    [clearWidgets],
  );

  useInterrupt({
    enabled: (event) => event?.value?.type === "bulk_issue_update_approval",
    render: ({ event, resolve }) => {
      const payload = event.value || {};

      return (
        <div className="my-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-700/40 dark:bg-amber-950/30">
          <p className="font-semibold text-amber-700 dark:text-amber-300">
            Approval Required: Bulk Issue Update
          </p>
          <p className="mt-1 text-slate-700 dark:text-slate-200">
            {payload.count || 0} issues with priority {payload.priority || "high"} will be moved to{" "}
            {payload.targetStatus || "in-progress"}
            {payload.trainId && payload.trainId !== "all" ? ` on ${payload.trainId}` : " across fleet"}.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => resolve({ approved: true })}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700"
            >
              Approve
            </button>
            <button
              onClick={() => resolve({ approved: false })}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Reject
            </button>
          </div>
        </div>
      );
    },
  });
};
