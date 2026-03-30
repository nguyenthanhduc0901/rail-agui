"use client";

import { z } from "zod";
import { useCallback, useEffect, useMemo } from "react";
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

// ── Card components ───────────────────────────────────────────────────────────

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

/** Single card for ALL query_database calls — shows the SQL being executed */
function SQLQueryCard({
  params,
  status,
}: {
  params: Record<string, unknown> | undefined;
  status: string;
}) {
  const sql = params?.sql ? String(params.sql) : null;
  const preview = sql
    ? sql.replace(/\s+/g, " ").trim().slice(0, 90) + (sql.length > 90 ? "…" : "")
    : null;
  return (
    <div className="my-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <svg
          className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 7h16M4 12h10M4 17h7" />
        </svg>
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          SQL
        </span>
        {preview && (
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {preview}
          </span>
        )}
        <span className="ml-auto shrink-0">
          <Done done={status === "complete"} />
        </span>
      </div>
    </div>
  );
}

/** update_issue — shows what fields are changing */
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

/** generate_maintenance_plan_stream / schedule_inspection
 *  Shows an ordered, clickable plan where each step cycles:
 *    pending → in-progress → done → pending
 */
function MaintenancePlanCard({ status }: { status: string }) {
  const { maintenancePlan, setMaintenancePlan } = useRailDashboardAI() as {
    maintenancePlan: Array<{
      id?: string;
      order?: number;
      status?: string;
      /** legacy compat */
      done?: boolean;
      title?: string;
      label?: string;
      details?: string;
      estimatedHours?: number;
      assigneeName?: string;
    }>;
    setMaintenancePlan: (plan: unknown[]) => void;
  };

  const toggleStep = useCallback(
    (idx: number) => {
      const updated = maintenancePlan.map((s, i) => {
        if (i !== idx) return s;
        const cur = s.status ?? (s.done ? "done" : "pending");
        const next =
          cur === "pending"     ? "in-progress" :
          cur === "in-progress" ? "done"        : "pending";
        return { ...s, status: next, done: next === "done" };
      });
      setMaintenancePlan(updated);
    },
    [maintenancePlan, setMaintenancePlan],
  );

  const totalHours = maintenancePlan.reduce((s, step) => s + (step.estimatedHours ?? 0), 0);
  const doneCount  = maintenancePlan.filter(
    (s) => s.status === "done" || s.done,
  ).length;

  return (
    <div className="my-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Kế hoạch bảo trì
        </span>
        {totalHours > 0 && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">
            {totalHours.toFixed(1)}h
          </span>
        )}
        {maintenancePlan.length > 0 && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            {doneCount}/{maintenancePlan.length}
          </span>
        )}
        {status !== "complete" && <Spinner />}
      </div>

      {/* Steps */}
      {maintenancePlan.length === 0 ? (
        <p className="text-xs text-slate-400">Đang tải các bước...</p>
      ) : (
        <div className="space-y-1">
          {maintenancePlan.map((step, i) => {
            const stepStatus = step.status ?? (step.done ? "done" : "pending");
            const isDone       = stepStatus === "done";
            const isInProgress = stepStatus === "in-progress";

            return (
              <div
                key={step.id ?? i}
                onClick={() => toggleStep(i)}
                title={
                  isDone       ? "Nhấn để đánh dấu chưa xong" :
                  isInProgress ? "Nhấn để đánh dấu xong"      :
                                 "Nhấn để bắt đầu"
                }
                className={[
                  "flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition-all select-none",
                  isDone
                    ? "opacity-60"
                    : isInProgress
                    ? "bg-blue-50/70 dark:bg-sky-900/20"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/40",
                ].join(" ")}
              >
                {/* Order / status badge */}
                <span
                  className={[
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    isDone
                      ? "bg-emerald-200 text-emerald-700 dark:bg-emerald-800/40 dark:text-emerald-400"
                      : isInProgress
                      ? "bg-blue-200 text-blue-700 dark:bg-sky-700 dark:text-sky-200"
                      : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
                  ].join(" ")}
                >
                  {isDone ? "✓" : (step.order ?? i + 1)}
                </span>

                <div className="min-w-0 flex-1">
                  <p
                    className={[
                      "truncate",
                      isDone
                        ? "text-slate-400 line-through dark:text-slate-500"
                        : "text-slate-700 dark:text-slate-200",
                    ].join(" ")}
                  >
                    {step.title ?? step.label ?? `Bước ${i + 1}`}
                  </p>
                  {step.details && !isDone && (
                    <p className="text-slate-400 dark:text-slate-500">{step.details}</p>
                  )}
                  {step.assigneeName &&
                    step.assigneeName !== "Unassigned" &&
                    !isDone && (
                      <p className="text-blue-500 dark:text-sky-400">
                        👤 {step.assigneeName}
                        {step.estimatedHours ? ` · ${step.estimatedHours}h` : ""}
                      </p>
                    )}
                </div>

                {isInProgress && (
                  <span className="mt-0.5 shrink-0 text-[9px] font-bold uppercase text-blue-500 dark:text-sky-400">
                    WIP
                  </span>
                )}
              </div>
            );
          })}
        </div>
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

      // ── Frontend action tools
      if (name === "createDashboardWidget")
        return <WidgetToolCard params={p as Record<string, string>} status={status} />;
      if (name === "applyDashboardFilters")
        return <FilterActionCard params={p as Record<string, string>} status={status} label="Đã áp dụng bộ lọc" />;
      if (name === "clearDashboardFilters")
        return <FilterActionCard params={{}} status={status} label="Đã xoá bộ lọc" />;
      if (name === "clearDashboardWidgets")
        return <FilterActionCard params={{}} status={status} label="Đã xoá widgets" />;

      // ── Single SQL query tool
      if (name === "query_database")
        return <SQLQueryCard params={p} status={status} />;

      // ── Write tool
      if (name === "update_issue")
        return <IssueUpdateCard params={p} status={status} />;

      // ── Streaming plan tools
      if (name === "generate_maintenance_plan_stream" || name === "schedule_inspection")
        return <MaintenancePlanCard status={status} />;

      // ── Fallback
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
