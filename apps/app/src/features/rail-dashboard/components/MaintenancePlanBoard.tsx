"use client";

import { useCallback } from "react";
import {
  useRailDashboardAI,
  type MaintenanceStep,
} from "../context/rail-dashboard-ai-context";

// ── Style maps ─────────────────────────────────────────────────────────────────

const PRIORITY_CLS: Record<string, string> = {
  high:   "bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  low:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const STATUS_CFG: Record<
  string,
  { label: string; cardCls: string; badgeCls: string }
> = {
  pending: {
    label:    "Chờ xử lý",
    cardCls:  "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
    badgeCls: "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700",
  },
  "in-progress": {
    label:    "Đang thực hiện",
    cardCls:  "border-sky-200 bg-sky-50/60 dark:border-sky-700/50 dark:bg-sky-900/10",
    badgeCls: "bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-800/60 dark:text-sky-300 dark:hover:bg-sky-700/60",
  },
  done: {
    label:    "Hoàn thành",
    cardCls:  "border-emerald-200 bg-white dark:border-emerald-800/40 dark:bg-slate-900",
    badgeCls: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-800/40",
  },
};

const NEXT: Record<string, MaintenanceStep["status"]> = {
  pending:       "in-progress",
  "in-progress": "done",
  done:          "pending",
};

// ── Component ──────────────────────────────────────────────────────────────────

export function MaintenancePlanBoard() {
  const { maintenancePlan, setMaintenancePlan } = useRailDashboardAI();

  const cycleStatus = useCallback(
    (idx: number) => {
      setMaintenancePlan(
        maintenancePlan.map((s, i) =>
          i !== idx ? s : { ...s, status: NEXT[s.status] ?? "pending" }
        )
      );
    },
    [maintenancePlan, setMaintenancePlan]
  );

  if (maintenancePlan.length === 0) return null;

  const doneCount  = maintenancePlan.filter((s) => s.status === "done").length;
  const totalHours = maintenancePlan.reduce((acc, s) => acc + (s.estimatedHours ?? 0), 0);
  const allDone    = doneCount === maintenancePlan.length;

  return (
    <section className="space-y-4">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Kế hoạch bảo trì
          </h2>

          <span
            className={[
              "rounded-full px-2.5 py-0.5 text-sm font-semibold",
              allDone
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
            ].join(" ")}
          >
            {doneCount}/{maintenancePlan.length} xong
          </span>

          {totalHours > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {totalHours.toFixed(1)} h
            </span>
          )}
        </div>

        <button
          onClick={() => setMaintenancePlan([])}
          className="text-xs text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
        >
          Xoá plan
        </button>
      </div>

      {/* ── Progress bar ──────────────────────────────────────────────────── */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${(doneCount / maintenancePlan.length) * 100}%` }}
        />
      </div>

      {/* ── Cards grid ────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {maintenancePlan.map((step, i) => {
          const cfg  = STATUS_CFG[step.status] ?? STATUS_CFG.pending;
          const pcls = PRIORITY_CLS[step.priority] ?? PRIORITY_CLS.medium;
          const isDone = step.status === "done";

          return (
            <div
              key={step.id ?? i}
              className={[
                "flex flex-col gap-3 rounded-xl border p-4 shadow-sm",
                "transition-all duration-150",
                cfg.cardCls,
              ].join(" ")}
            >
              {/* Row 1 — order badge · title · status button */}
              <div className="flex items-start gap-2">
                {/* Order / done indicator */}
                <span
                  className={[
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center",
                    "rounded-full text-[11px] font-bold",
                    isDone
                      ? "bg-emerald-200 text-emerald-700 dark:bg-emerald-800/50 dark:text-emerald-300"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
                  ].join(" ")}
                >
                  {isDone ? "✓" : step.order}
                </span>

                {/* Title */}
                <p
                  className={[
                    "flex-1 text-sm font-semibold leading-snug",
                    isDone
                      ? "text-slate-400 line-through dark:text-slate-500"
                      : "text-slate-800 dark:text-slate-100",
                  ].join(" ")}
                >
                  {step.title}
                </p>

                {/* Clickable status badge */}
                <button
                  onClick={() => cycleStatus(i)}
                  title="Nhấn để chuyển trạng thái"
                  className={[
                    "shrink-0 rounded-full px-2.5 py-0.5",
                    "text-[10px] font-semibold uppercase tracking-wide",
                    "transition-colors",
                    cfg.badgeCls,
                  ].join(" ")}
                >
                  {cfg.label}
                </button>
              </div>

              {/* Row 2 — details / description */}
              {step.details && (
                <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                  {step.details}
                </p>
              )}

              {/* Row 3 — priority · assignee · hours */}
              <div className="mt-auto flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${pcls}`}>
                  {step.priority}
                </span>

                {step.assigneeName && step.assigneeName !== "Unassigned" && (
                  <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="text-slate-400">👤</span>
                    {step.assigneeName}
                  </span>
                )}

                {step.estimatedHours ? (
                  <span className="ml-auto text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                    {step.estimatedHours}h
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
