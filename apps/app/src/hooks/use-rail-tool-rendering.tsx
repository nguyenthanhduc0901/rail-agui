"use client";

import { z } from "zod";
import { useEffect, useMemo } from "react";
import { useTheme } from "@/hooks/use-theme";
import {
  useAgent,
  useDefaultRenderTool,
  useFrontendTool,
} from "@copilotkit/react-core/v2";
import { ToolReasoning } from "@/components/tool-rendering";
import { useRailDashboardAI, type MaintenanceStep, type PendingPlanStep, type AgentProgressStep } from "@/features/rail-dashboard/context/rail-dashboard-ai-context";
import { FilterActionCard } from "@/features/rail-dashboard/components/tool-cards/filter-action-card";
import { IssueUpdateCard } from "@/features/rail-dashboard/components/tool-cards/issue-update-card";
import { MaintenancePlanCard } from "@/features/rail-dashboard/components/tool-cards/maintenance-plan-card";
import { PlanStepUpdateCard } from "@/features/rail-dashboard/components/tool-cards/plan-step-update-card";
import { SQLQueryCard } from "@/features/rail-dashboard/components/tool-cards/sql-query-card";
import { WidgetToolCard } from "@/features/rail-dashboard/components/tool-cards/widget-tool-card";
import { IssuePlanProposalCard } from "@/features/rail-dashboard/components/tool-cards/issue-plan-proposal-card";
import { IssueReportCard } from "@/features/rail-dashboard/components/tool-cards/issue-report-card";

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useRailToolRendering = () => {
  const { theme, setTheme } = useTheme();
  const { agent } = useAgent();
  const { setMaintenancePlan, setAgentProgress } = useRailDashboardAI();

  const ignoredTools = useMemo(() => ["log_a2ui_event"], []);

  useEffect(() => {
    const { unsubscribe } = agent.subscribe({
      onCustomEvent: ({ event }) => {
        if (event.name !== "copilotkit_manually_emit_intermediate_state") return;
        if (Array.isArray(event.value?.maintenancePlan)) {
          setMaintenancePlan(event.value.maintenancePlan as MaintenanceStep[]);
        }
        if (Array.isArray(event.value?.agentProgress)) {
          setAgentProgress(event.value.agentProgress as AgentProgressStep[]);
        }
      },
    });
    return unsubscribe;
  }, [agent, setMaintenancePlan, setAgentProgress]);

  useDefaultRenderTool({
    render: ({ name, status, parameters }) => {
      if (ignoredTools.includes(name)) return <></>;
      const p = (parameters ?? {}) as Record<string, unknown>;

      if (name === "proposeIssuePlan") {
        // Build plan directly from tool call parameters — independent per card instance
        const rawSteps = Array.isArray(p.steps) ? p.steps as Array<Record<string, unknown>> : [];
        const plan = {
          issueId: String(p.issueId ?? ""),
          issueTitle: String(p.issueTitle ?? p.issueId ?? ""),
          mode: (p.mode === "append" ? "append" : "create") as "create" | "append",
          existingCount: Number(p.existingCount ?? 0),
          rationale: p.rationale ? String(p.rationale) : undefined,
          steps: rawSteps.map((s, i): PendingPlanStep => ({
            seqOrder: Number(s.seqOrder ?? i + 1),
            title: String(s.title ?? ""),
            estimatedHours: Number(s.estimatedHours ?? 2),
            technicianId: s.technicianId ? String(s.technicianId) : null,
            technicianName: s.technicianName ? String(s.technicianName) : null,
          })),
        };
        return <IssuePlanProposalCard plan={plan} status={status} />;
      }

      // ── Issue report tool (streaming via predict_state)
      if (name === "generate_issue_report") {
        const reportText = p.report ? String(p.report) : undefined;
        const wordCount = reportText ? reportText.split(/\s+/).filter(Boolean).length : 0;
        return <IssueReportCard status={status} wordCount={wordCount} />;
      }

      // ── Frontend action tools
      if (name === "createDashboardWidget")
        return <WidgetToolCard params={p as Record<string, string>} status={status} />;
      if (name === "applyDashboardFilters")
        return <FilterActionCard params={p as Record<string, string>} status={status} label="Đã áp dụng bộ lọc" />;
      if (name === "clearDashboardFilters")
        return <FilterActionCard params={{}} status={status} label="Đã xoá bộ lọc" />;
      if (name === "clearDashboardWidgets")
        return <FilterActionCard params={{}} status={status} label="Đã xoá widgets" />;
      if (name === "openCarriageDetails")
        return <FilterActionCard params={p as Record<string, string>} status={status} label="Mở chi tiết toa" />;

      // ── Single SQL query tool
      if (name === "query_database")
        return <SQLQueryCard params={p} status={status} />;

      // ── Write tool
      if (name === "update_issue")
        return <IssueUpdateCard params={p} status={status} />;

      // ── Streaming plan tools
      if (name === "generate_maintenance_plan_stream" || name === "schedule_inspection")
        return <MaintenancePlanCard status={status} />;

      // ── Plan step update
      if (name === "update_plan_step") {
        return <PlanStepUpdateCard params={p} status={status} />;
      }

      // ── Bulk update (human approval handled via useInterrupt in ai-controls)
      if (name === "request_bulk_issue_status_update")
        return <FilterActionCard params={p as Record<string, string>} status={status} label="Cập nhật hàng loạt" />;

      // ── Plan execution approval (human-in-the-loop, handled via useInterrupt)
      if (name === "confirm_plan_execution")
        return <FilterActionCard params={{}} status={status} label="Xác nhận kế hoạch" />;

      // ── Fallback
      return <ToolReasoning name={name} status={status} args={p} />;
    },
  });

  useFrontendTool(
    {
      name: "change_theme",
      description: "Switch the application UI theme between light and dark mode.",
      parameters: z.object({
        theme: z.enum(["light", "dark"]).describe("The theme to apply."),
      }),
      handler: async ({ theme: newTheme }) => {
        if (theme === newTheme) return `Theme is already ${newTheme}.`;
        setTheme(newTheme);
        return `Theme changed to ${newTheme}.`;
      },
    },
    [theme, setTheme],
  );
};
