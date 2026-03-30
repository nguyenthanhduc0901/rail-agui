import { useCallback, useMemo } from "react";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { ToolCard } from "@/components/ui/tool-card";
import {
  useRailDashboardAI,
  type MaintenanceStep,
} from "../../context/rail-dashboard-ai-context";

interface MaintenancePlanCardProps {
  status: string;
}

const NEXT_STATUS: Record<MaintenanceStep["status"], MaintenanceStep["status"]> = {
  pending: "doing",
  doing: "done",
  done: "pending",
};

export function MaintenancePlanCard({ status }: MaintenancePlanCardProps) {
  const { maintenancePlan, setMaintenancePlan } = useRailDashboardAI();

  const toggleStep = useCallback(
    (index: number) => {
      setMaintenancePlan(
        maintenancePlan.map((step, stepIndex) =>
          stepIndex !== index
            ? step
            : { ...step, status: NEXT_STATUS[step.status] ?? "pending" },
        ),
      );
    },
    [maintenancePlan, setMaintenancePlan],
  );

  const summary = useMemo(() => {
    const totalHours = maintenancePlan.reduce(
      (sum, step) => sum + (step.estimatedHours ?? 0),
      0,
    );
    const doneCount = maintenancePlan.filter((step) => step.status === "done").length;

    return { totalHours, doneCount };
  }, [maintenancePlan]);

  return (
    <ToolCard className="shadow-none">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Ke hoach bao tri
        </span>
        {summary.totalHours > 0 && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">
            {summary.totalHours.toFixed(1)}h
          </span>
        )}
        {maintenancePlan.length > 0 && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            {summary.doneCount}/{maintenancePlan.length}
          </span>
        )}
        <span className="ml-auto shrink-0">
          <StatusIndicator status={status} size="sm" />
        </span>
      </div>

      {maintenancePlan.length === 0 ? (
        <p className="text-xs text-slate-400">Dang tai cac buoc...</p>
      ) : (
        <div className="space-y-1">
          {maintenancePlan.map((step, index) => {
            const isDone = step.status === "done";
            const isDoing = step.status === "doing";

            return (
              <button
                key={step.id ?? index}
                type="button"
                onClick={() => toggleStep(index)}
                title={
                  isDone
                    ? "Nhan de danh dau chua xong"
                    : isDoing
                      ? "Nhan de danh dau xong"
                      : "Nhan de bat dau"
                }
                className={[
                  "flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-all",
                  isDone
                    ? "opacity-60"
                    : isDoing
                      ? "bg-blue-50/70 dark:bg-sky-900/20"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/40",
                ].join(" ")}
              >
                <span
                  className={[
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    isDone
                      ? "bg-emerald-200 text-emerald-700 dark:bg-emerald-800/40 dark:text-emerald-400"
                      : isDoing
                        ? "bg-blue-200 text-blue-700 dark:bg-sky-700 dark:text-sky-200"
                        : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
                  ].join(" ")}
                >
                  {isDone ? "✓" : step.order ?? index + 1}
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
                    {step.title}
                  </p>
                  {step.details && !isDone && (
                    <p className="text-slate-400 dark:text-slate-500">{step.details}</p>
                  )}
                  {step.technicianName &&
                    step.technicianName !== "Unassigned" &&
                    !isDone && (
                      <p className="text-blue-500 dark:text-sky-400">
                        {step.technicianName}
                        {step.estimatedHours ? ` · ${step.estimatedHours}h` : ""}
                      </p>
                    )}
                </div>

                {isDoing && (
                  <span className="mt-0.5 shrink-0 text-[9px] font-bold uppercase text-blue-500 dark:text-sky-400">
                    WIP
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </ToolCard>
  );
}