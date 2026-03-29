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

// ── Rich in-chat tool card components ────────────────────────────────────────

const severityStyles: Record<string, string> = {
  info: "border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-950/30",
  warning: "border-amber-200 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-950/30",
  critical: "border-red-200 bg-red-50 dark:border-red-700/40 dark:bg-red-950/30",
};

function Spinner() {
  return (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
  );
}

function WidgetToolCard({ params, status }: { params: Record<string, string> | undefined; status: string }) {
  const sev = (params?.severity && severityStyles[params.severity]) ? params.severity : "info";
  return (
    <div className={`my-2 rounded-xl border p-3 text-sm ${severityStyles[sev]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {params?.title ?? "AI Widget"}
        </span>
        {status !== "complete" ? (
          <Spinner />
        ) : (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">✓ Đã tạo</span>
        )}
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
  const { maintenancePlan } = useRailDashboardAI();
  return (
    <div className="my-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Kế hoạch bảo trì
        </span>
        {status !== "complete" && <Spinner />}
      </div>
      {maintenancePlan.length === 0 ? (
        <p className="text-xs text-slate-400">Đang tải các bước...</p>
      ) : (
        <div className="space-y-1.5">
          {maintenancePlan.map((step: { id?: string; done?: boolean; title?: string; label?: string; details?: string }, i: number) => (
            <div key={step.id ?? i} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 shrink-0">{step.done ? "✅" : "⏳"}</span>
              <div>
                <p className="text-slate-700 dark:text-slate-200">
                  {step.title ?? step.label ?? `Bước ${i + 1}`}
                </p>
                {step.details && (
                  <p className="text-slate-400 dark:text-slate-500">{step.details}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useRailToolRendering = () => {
  const { theme, setTheme } = useTheme();
  const { agent } = useAgent();
  const { setMaintenancePlan } = useRailDashboardAI();

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

      if (name === "createDashboardWidget") {
        return <WidgetToolCard params={parameters as Record<string, string>} status={status} />;
      }
      if (name === "applyDashboardFilters") {
        return <FilterActionCard params={(parameters ?? {}) as Record<string, string>} status={status} label="Đã áp dụng bộ lọc" />;
      }
      if (name === "clearDashboardFilters") {
        return <FilterActionCard params={{}} status={status} label="Đã xoá bộ lọc" />;
      }
      if (name === "clearDashboardWidgets") {
        return <FilterActionCard params={{}} status={status} label="Đã xoá widgets" />;
      }
      if (name === "generate_maintenance_plan_stream") {
        return <MaintenancePlanCard status={status} />;
      }

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
