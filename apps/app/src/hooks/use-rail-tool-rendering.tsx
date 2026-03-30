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
import { useRailDashboardAI } from "@/features/rail-dashboard/context/rail-dashboard-ai-context";

// ── Shared primitives ─────────────────────────────────────────────────────────

const severityStyles: Record<string, string> = {
  info:     "border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-950/30",
  warning:  "border-amber-200 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-950/30",
  critical: "border-red-200 bg-red-50 dark:border-red-700/40 dark:bg-red-950/30",
};

function Spinner() {
  return (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
  );
}

function Done({ done }: { done: boolean }) {
  return done
    ? <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">✓ Xong</span>
    : <Spinner />;
}

// ── Individual card components ────────────────────────────────────────────────

function WidgetToolCard({ params, status }: { params: Record<string, string> | undefined; status: string }) {
  const sev = (params?.severity && severityStyles[params.severity]) ? params.severity : "info";
  return (
    <div className={`my-2 rounded-xl border p-3 text-sm ${severityStyles[sev]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {params?.title ?? "AI Widget"}
        </span>
        <Done done={status === "complete"} />
      </div>
      {params?.value && (
        <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{params.value}</p>
      )}
      {params?.summary && (
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{params.summary}</p>
      )}
      {params?.trainId && params.trainId !== "all" && (
        <span className="mt-2 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {params.trainId}
        </span>
      )}
    </div>
  );
}

function FilterActionCard({
  params,
  status,
  label,
}: {
  params: Record<string, string>;
  status: string;
  label: string;
}) {
  const parts = Object.entries(params).filter(([, v]) => v && v !== "all");
  return (
    <div className="my-2 flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm dark:border-indigo-800/40 dark:bg-indigo-950/30">
      <span className="text-indigo-500">⚙</span>
      <span className="font-medium text-indigo-700 dark:text-indigo-300">{label}</span>
      {parts.length > 0 && (
        <span className="text-xs text-indigo-500 dark:text-indigo-400">
          {parts.map(([k, v]) => `${k}: ${v}`).join(" · ")}
        </span>
      )}
      {status !== "complete" && <Spinner />}
    </div>
  );
}

function MaintenancePlanCard({ status }: { status: string }) {
  const { maintenancePlan } = useRailDashboardAI() as {
    maintenancePlan: Array<{
      id?: string; done?: boolean; title?: string; label?: string;
      details?: string; estimatedHours?: number; assigneeName?: string;
    }>;
    setMaintenancePlan: (plan: unknown[]) => void;
  };
  const totalHours = maintenancePlan.reduce((s, step) => s + (step.estimatedHours ?? 0), 0);
  return (
    <div className="my-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Kế hoạch bảo trì
        </span>
        {totalHours > 0 && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">
            {totalHours.toFixed(1)}h
          </span>
        )}
        {status !== "complete" && <Spinner />}
      </div>
      {maintenancePlan.length === 0 ? (
        <p className="text-xs text-slate-400">Đang tải các bước...</p>
      ) : (
        <div className="space-y-1.5">
          {maintenancePlan.map((step, i: number) => (
            <div key={step.id ?? i} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 shrink-0">{step.done ? "✅" : "⏳"}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-slate-700 dark:text-slate-200">
                  {step.title ?? step.label ?? `Bước ${i + 1}`}
                </p>
                {step.details && (
                  <p className="text-slate-400 dark:text-slate-500">{step.details}</p>
                )}
                {step.assigneeName && step.assigneeName !== "Unassigned" && (
                  <p className="text-blue-500 dark:text-sky-400">
                    👤 {step.assigneeName}{step.estimatedHours ? ` · ${step.estimatedHours}h` : ""}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Generic card for all read-query tools */
function AnalysisQueryCard({
  toolName,
  params,
  status,
}: {
  toolName: string;
  params: Record<string, unknown> | undefined;
  status: string;
}) {
  const LABELS: Record<string, string> = {
    get_fleet_overview:       "📊 Tổng quan đội tàu",
    get_train_summary:        "🚂 Tóm tắt tàu",
    count_issues:             "🔢 Đếm sự cố",
    list_issues:              "📋 Danh sách sự cố",
    get_carriage_detail:      "🚃 Chi tiết toa",
    get_issue_detail:         "🔍 Chi tiết sự cố",
  };
  const label = LABELS[toolName] ?? toolName;
  const keyParam = Object.entries(params ?? {}).find(
    ([, v]) => v && v !== "all" && v !== "" && v !== 10,
  );
  return (
    <div className="my-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <span className="font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      {keyParam && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {String(keyParam[1])}
        </span>
      )}
      <span className="ml-auto"><Done done={status === "complete"} /></span>
    </div>
  );
}

/** update_issue — shows what is being changed */
function IssueUpdateCard({
  params,
  status,
}: {
  params: Record<string, unknown> | undefined;
  status: string;
}) {
  const changes: string[] = [];
  if (params?.status)      changes.push(`status → ${params.status}`);
  if (params?.priority)    changes.push(`priority → ${params.priority}`);
  if (params?.assignee_id) changes.push(`assignee → ${params.assignee_id}`);
  return (
    <div className="my-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm dark:border-violet-800/40 dark:bg-violet-950/30">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-violet-800 dark:text-violet-200">
          🔧 Cập nhật {String(params?.issue_id ?? "sự cố")}
        </span>
        <Done done={status === "complete"} />
      </div>
      {changes.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {changes.map((c, i) => (
            <span
              key={i}
              className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-violet-700 dark:bg-slate-800 dark:text-violet-300"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** rank_trains_by_risk */
function RiskRankCard({
  params,
  status,
}: {
  params: Record<string, unknown> | undefined;
  status: string;
}) {
  return (
    <div className="my-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm dark:border-red-800/40 dark:bg-red-950/30">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-red-800 dark:text-red-200">
          🏆 Xếp hạng rủi ro đội tàu
        </span>
        <Done done={status === "complete"} />
      </div>
      <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
        Top {String(params?.top_n ?? 5)} tàu · điểm rủi ro = toa hỏng × 3 + lỗi cao × 2 + quá hạn × 1.5
      </p>
    </div>
  );
}

/** get_system_analytics */
function SystemAnalyticsCard({
  params,
  status,
}: {
  params: Record<string, unknown> | undefined;
  status: string;
}) {
  const target = params?.system ? String(params.system) : null;
  return (
    <div className="my-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm dark:border-sky-800/40 dark:bg-sky-950/30">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sky-800 dark:text-sky-200">
          ⚙️ Phân tích hệ thống{target ? ` — ${target}` : " (toàn bộ)"}
        </span>
        <Done done={status === "complete"} />
      </div>
      <p className="mt-0.5 text-xs text-sky-600 dark:text-sky-400">
        HVAC · Brakes · Doors · Power · Network
      </p>
    </div>
  );
}

/** get_technician_workload / find_available_technician */
function WorkloadCard({
  toolName,
  params,
  status,
}: {
  toolName: string;
  params: Record<string, unknown> | undefined;
  status: string;
}) {
  const isFindMode = toolName === "find_available_technician";
  return (
    <div className="my-2 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm dark:border-teal-800/40 dark:bg-teal-950/30">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-teal-800 dark:text-teal-200">
          {isFindMode ? "🔎 Tìm kỹ thuật viên rảnh" : "👷 Khối lượng công việc"}
        </span>
        <Done done={status === "complete"} />
      </div>
      {isFindMode && !!params?.specialty && (
        <p className="mt-0.5 text-xs text-teal-600 dark:text-teal-400">
          Chuyên môn: {String(params.specialty)}
        </p>
      )}
    </div>
  );
}

/** find_overdue_issues */
function OverdueCard({
  params,
  status,
}: {
  params: Record<string, unknown> | undefined;
  status: string;
}) {
  return (
    <div className="my-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm dark:border-orange-800/40 dark:bg-orange-950/30">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-orange-800 dark:text-orange-200">
          ⏰ Sự cố trễ hạn
        </span>
        <Done done={status === "complete"} />
      </div>
      {!!(params?.train_id || params?.priority) && (
        <p className="mt-0.5 text-xs text-orange-600 dark:text-orange-400">
          {[params?.train_id, params?.priority].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useRailToolRendering = () => {
  const { theme, setTheme } = useTheme();
  const { agent } = useAgent();
  const { setMaintenancePlan } = useRailDashboardAI() as {
    setMaintenancePlan: (plan: unknown[]) => void;
  };

  const ignoredTools = useMemo(() => ["log_a2ui_event"], []);

  useEffect(() => {
    const { unsubscribe } = agent.subscribe({
      onCustomEvent: ({ event }) => {
        if (event.name !== "copilotkit_manually_emit_intermediate_state") return;
        if (Array.isArray(event.value?.maintenancePlan)) {
          setMaintenancePlan(event.value.maintenancePlan);
        }
      },
    });
    return unsubscribe;
  }, [agent, setMaintenancePlan]);

  useDefaultRenderTool({
    render: ({ name, status, parameters }) => {
      if (ignoredTools.includes(name)) return <></>;
      const p = (parameters ?? {}) as Record<string, unknown>;

      // ── Widget / filter frontend tools
      if (name === "createDashboardWidget")
        return <WidgetToolCard params={p as Record<string, string>} status={status} />;
      if (name === "applyDashboardFilters")
        return <FilterActionCard params={p as Record<string, string>} status={status} label="Đã áp dụng bộ lọc" />;
      if (name === "clearDashboardFilters")
        return <FilterActionCard params={{}} status={status} label="Đã xoá bộ lọc" />;
      if (name === "clearDashboardWidgets")
        return <FilterActionCard params={{}} status={status} label="Đã xoá widgets" />;

      // ── Streaming plan tools (both share the same card)
      if (name === "generate_maintenance_plan_stream" || name === "schedule_inspection")
        return <MaintenancePlanCard status={status} />;

      // ── Write tool
      if (name === "update_issue")
        return <IssueUpdateCard params={p} status={status} />;

      // ── Analytics tools
      if (name === "rank_trains_by_risk")
        return <RiskRankCard params={p} status={status} />;
      if (name === "get_system_analytics")
        return <SystemAnalyticsCard params={p} status={status} />;
      if (name === "get_technician_workload" || name === "find_available_technician")
        return <WorkloadCard toolName={name} params={p} status={status} />;
      if (name === "find_overdue_issues")
        return <OverdueCard params={p} status={status} />;

      // ── Generic read-query tools
      const queryTools = new Set([
        "get_fleet_overview", "get_train_summary", "count_issues",
        "list_issues", "get_carriage_detail", "get_issue_detail",
      ]);
      if (queryTools.has(name))
        return <AnalysisQueryCard toolName={name} params={p} status={status} />;

      // ── Fallback for anything else
      return <ToolReasoning name={name} status={status} args={parameters} />;
    },
  });

  useFrontendTool(
    {
      name: "setTheme",
      description:
        "Đặt chế độ giao diện chính xác theo yêu cầu người dùng: light, dark hoặc system.",
      parameters: z.object({
        mode: z.enum(["light", "dark", "system"]),
      }),
      handler: async ({ mode }) => {
        if (mode === theme) {
          return `Theme already set to ${mode}.`;
        }
        setTheme(mode);
        return `Theme updated to ${mode}.`;
      },
    },
    [theme, setTheme],
  );
};

