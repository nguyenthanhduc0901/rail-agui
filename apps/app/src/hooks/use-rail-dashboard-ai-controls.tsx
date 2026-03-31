"use client";

import { z } from "zod";
import { useFrontendTool, useInterrupt, useAgentContext } from "@copilotkit/react-core/v2";

import { useRailDashboardAI } from "@/features/rail-dashboard/context/rail-dashboard-ai-context";
import { useFleetData } from "@/features/rail-dashboard/context/fleet-data-context";

const filterSchema = z.object({
  trainId: z.string().optional(),
  system: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low", "all"]).optional(),
  status: z.enum(["open", "in-progress", "resolved", "closed", "all"]).optional(),
});

export const useRailDashboardAIControls = (): void => {
  const {
    filters,
    widgets,
    updateFilters,
    clearFilters,
    addWidget,
    clearWidgets,
    highlightByStatus,
    setHighlightByStatus,
    highlightedCarriageIds,
    toggleCarriageHighlight,
    activeCarriageId,
    activeTrainId,
    triggerOpenCarriageModal,
  } = useRailDashboardAI();
  const { issues } = useFleetData();

  // Inject live dashboard context into agent system prompt
  useAgentContext({
    description: "Current dashboard state: active filters, open train and carriage",
    value: JSON.stringify({
      activeFilters: filters,
      openCarriageId: activeCarriageId ?? "none",
      openTrainId: activeTrainId ?? "none",
    }),
  });

  useFrontendTool(
    {
      name: "applyDashboardFilters",
      description:
        "Apply rail dashboard filters for train, system, priority, and status. Use this when users ask to filter the main dashboard.",
      parameters: filterSchema,
      handler: async (args) => {
        const nextFilters = {
          trainId: args.trainId,
          system: args.system,
          priority: args.priority,
          status: args.status,
        };

        const hasChanges = Object.entries(nextFilters).some(([key, value]) => {
          if (value === undefined) return false;
          return filters[key as keyof typeof filters] !== value;
        });

        if (!hasChanges) {
          return "Dashboard filters already in the requested state.";
        }

        updateFilters(nextFilters);

        return "Dashboard filters applied.";
      },
    },
    [filters, updateFilters],
  );

  useFrontendTool(
    {
      name: "clearDashboardFilters",
      description:
        "Reset all rail dashboard filters to show the full fleet view.",
      parameters: z.object({}),
      handler: async () => {
        if (
          filters.trainId === "all" &&
          filters.system === "all" &&
          filters.priority === "all" &&
          filters.status === "all"
        ) {
          return "Dashboard filters are already reset.";
        }

        clearFilters();
        return "Dashboard filters were reset.";
      },
    },
    [filters, clearFilters],
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
        const duplicateExists = widgets.slice(0, 5).some((w) => {
          return (
            w.kind === args.kind &&
            w.title === args.title &&
            (w.summary || "") === (args.summary || "") &&
            (w.value || "") === (args.value || "") &&
            w.severity === args.severity &&
            (w.trainId || "all") === (args.trainId || "all")
          );
        });

        if (duplicateExists) {
          return `Widget '${args.title}' already exists recently.`;
        }

        addWidget(args);
        return `Widget '${args.title}' created on dashboard.`;
      },
    },
    [widgets, addWidget],
  );

  useFrontendTool(
    {
      name: "clearDashboardWidgets",
      description: "Clear all AI-generated dashboard widgets.",
      parameters: z.object({}),
      handler: async () => {
        if (widgets.length === 0) {
          return "Dashboard widgets are already empty.";
        }

        clearWidgets();
        return "All dashboard widgets cleared.";
      },
    },
    [widgets.length, clearWidgets],
  );

  useFrontendTool(
    {
      name: "highlightFleetByStatus",
      description:
        "Toggle color highlighting of train carriages by health status on the main dashboard. When enabled, healthy=green, warning=yellow, critical=red. When disabled, all carriages show as neutral gray. Use this when users ask to highlight, colorize, or show the status of the fleet.",
      parameters: z.object({
        enabled: z.boolean().describe("true to highlight carriages by status, false to reset to default gray"),
      }),
      handler: async ({ enabled }) => {
        if (highlightByStatus === enabled) {
          return enabled ? "Fleet is already highlighted by status." : "Fleet is already showing default colors.";
        }
        setHighlightByStatus(enabled);
        return enabled
          ? "Fleet carriages are now highlighted by health status: green=healthy, yellow=warning, red=critical."
          : "Fleet carriages reset to default gray color.";
      },
    },
    [highlightByStatus, setHighlightByStatus],
  );

  useFrontendTool(
    {
      name: "getActiveCarriageContext",
      description:
        "Get info about the carriage currently open in the detail modal. Use this when the user says 'this carriage', 'current carriage', or refers to the carriage they are viewing, before performing any carriage-specific action.",
      parameters: z.object({}),
      handler: async () => {
        if (!activeCarriageId) {
          return "No carriage is currently open. The user has not clicked on any carriage card.";
        }
        const highlighted = highlightedCarriageIds.has(activeCarriageId);
        return JSON.stringify({
          carriageId: activeCarriageId,
          trainId: activeTrainId,
          systemHighlightEnabled: highlighted,
        });
      },
    },
    [activeCarriageId, activeTrainId, highlightedCarriageIds],
  );

  useFrontendTool(
    {
      name: "highlightDangerousCarriageSystems",
      description:
        "Toggle animated highlight effects on dangerous/issue systems in the currently open carriage blueprint. Only affects the carriage currently being viewed — does not affect other carriages. Call getActiveCarriageContext first if you need to know which carriage is open.",
      parameters: z.object({
        enabled: z.boolean().describe("true to show pulsing effects on dangerous systems, false to disable"),
      }),
      handler: async ({ enabled }) => {
        if (!activeCarriageId) {
          return "No carriage is currently open. Ask the user to click on a carriage first.";
        }
        const alreadySet = highlightedCarriageIds.has(activeCarriageId) === enabled;
        if (alreadySet) {
          return enabled
            ? `Carriage ${activeCarriageId} system highlights are already enabled.`
            : `Carriage ${activeCarriageId} system highlights are already disabled.`;
        }
        toggleCarriageHighlight(activeCarriageId, enabled);
        return enabled
          ? `Carriage ${activeCarriageId}: dangerous systems will now show animated highlight effects.`
          : `Carriage ${activeCarriageId}: system highlight effects disabled.`;
      },
    },
    [activeCarriageId, highlightedCarriageIds, toggleCarriageHighlight],
  );

  // ── Feature 1: Agent-driven navigation ────────────────────────────────────
  // Lets the agent open any carriage detail modal directly without the user
  // having to click — "Let me pull up carriage C02-T03 for you."
  useFrontendTool(
    {
      name: "openCarriageDetails",
      description:
        "Open the detail modal for a specific carriage by ID. Use when the user or agent wants to inspect a particular carriage without requiring a click. " +
        "Always prefer this over asking the user to click manually.",
      parameters: z.object({
        carriageId: z.string().describe("The carriage ID, e.g. C02-T03"),
        trainId: z.string().describe("The train ID that owns this carriage, e.g. T03"),
      }),
      handler: async ({ carriageId, trainId }) => {
        triggerOpenCarriageModal(carriageId, trainId);
        return `Opening carriage ${carriageId} on train ${trainId}.`;
      },
    },
    [triggerOpenCarriageModal],
  );

  useFrontendTool(
    {
      name: "proposeIssuePlan",
      description:
        "Propose an AI-generated action plan for a specific issue. The plan will appear as a card in the chat with Approve/Reject buttons. " +
        "Use mode='create' when the issue has no existing plan steps (existingCount=0). " +
        "Use mode='append' when the issue already has plan steps and you are adding new ones. " +
        "Always call getActiveCarriageContext first if the user refers to 'this carriage' or 'current issue'.",
      parameters: z.object({
        issueId: z.string().describe("The issue ID to create the plan for (e.g. ISS-001)"),
        mode: z.enum(["create", "append"]).describe("'create' for a fresh plan, 'append' to add steps to an existing plan"),
        existingCount: z.number().int().min(0).default(0).describe("Number of existing plan steps already on this issue"),
        rationale: z.string().optional().describe("Brief explanation of why this plan was designed this way"),
        steps: z.array(z.object({
          seqOrder: z.number().int().min(1),
          title: z.string().describe("Short action title for this step"),
          estimatedHours: z.number().min(0).default(2),
          technicianId: z.string().nullable().optional(),
          technicianName: z.string().nullable().optional(),
        })).min(1).describe("The proposed plan steps"),
      }),
      handler: async (args) => {
        // Look up issue title from live fleet data
        const issue = issues.find(i => i.id === args.issueId);
        if (!issue) {
          return `Issue ${args.issueId} not found. Please check the issue ID.`;
        }
        return `Plan proposed for ${args.issueId} (${args.steps.length} steps). Waiting for user approval in the chat.`;
      },
    },
    [issues],
  );

  // ── Feature 6: Auto-resolve + Feature 5 (typed) ──────────────────────────
  // Bulk status update approval — uses `handler` for auto-resolve of small operations.
  // If ≤ 2 issues are affected, silently approve to avoid interrupting the user
  // for trivial changes. Larger operations still show the confirmation dialog.
  useInterrupt({
    enabled: (event) => event?.value?.type === "bulk_issue_update_approval",
    handler: async ({ event, resolve }) => {
      const count = (event.value?.count as number) ?? 0;
      if (count <= 2) {
        // Auto-approve low-risk bulk updates (≤ 2 issues)
        resolve({ approved: true });
        return true; // consumed — do NOT show UI
      }
      return false; // hand off to render for user confirmation
    },
    render: ({ event, resolve }) => {
      const payload = event.value || {};

      return (
        <div className="my-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-700/40 dark:bg-amber-950/30">
          <p className="font-semibold text-amber-700 dark:text-amber-300">
            Xác nhận cập nhật hàng loạt
          </p>
          <p className="mt-1 text-slate-700 dark:text-slate-200">
            <span className="font-semibold">{(payload?.count as number) || 0} sự cố</span>{" "}
            có mức độ ưu tiên{" "}
            <span className="font-semibold">{(payload?.priority as string) || "high"}</span>{" "}
            sẽ chuyển sang trạng thái{" "}
            <span className="font-semibold">{(payload?.targetStatus as string) || "in-progress"}</span>
            {payload?.trainId && payload?.trainId !== "all"
              ? ` trên tàu ${payload?.trainId}`
              : " trên toàn đội tàu"}
            .
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => resolve({ approved: true })}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
            >
              Xác nhận
            </button>
            <button
              onClick={() => resolve({ approved: false })}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Huỷ
            </button>
          </div>
        </div>
      );
    },
  });

  // ── Feature 5: Plan execution approval interrupt ──────────────────────────
  // A second, distinctly-typed interrupt for approving maintenance plans.
  // Separated from the bulk-update interrupt so each has its own UI + logic.
  useInterrupt({
    enabled: (event) => event?.value?.type === "plan_execution_approval",
    render: ({ event, resolve }) => {
      const payload = event.value || {};
      const hours = (payload?.estimatedTotalHours as number) ?? 0;
      const issueCount = (payload?.affectedIssues as number) ?? 0;

      return (
        <div className="my-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-700/40 dark:bg-blue-950/30">
          <p className="font-semibold text-blue-700 dark:text-blue-300">
            Xác nhận thực thi kế hoạch bảo dưỡng
          </p>
          {payload?.planSummary && (
            <p className="mt-1.5 text-slate-700 dark:text-slate-200">
              {payload.planSummary as string}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
            {issueCount > 0 && (
              <span className="rounded-full bg-white/80 px-2 py-1 ring-1 ring-blue-200 dark:bg-slate-800 dark:ring-blue-800">
                {issueCount} sự cố
              </span>
            )}
            {hours > 0 && (
              <span className="rounded-full bg-white/80 px-2 py-1 ring-1 ring-blue-200 dark:bg-slate-800 dark:ring-blue-800">
                ~{hours}h ước tính
              </span>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => resolve({ approved: true })}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              Phê duyệt
            </button>
            <button
              onClick={() => resolve({ approved: false })}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Từ chối
            </button>
          </div>
        </div>
      );
    },
  });
};
