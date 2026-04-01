"use client";

import { useCallback, useState } from "react";
import {
  useRailDashboardAI,
  type MaintenanceStep,
} from "../context/rail-dashboard-ai-context";

// ── Component ──────────────────────────────────────────────────────────────────

export function MaintenancePlanBoard() {
  const { maintenancePlan, setMaintenancePlan } = useRailDashboardAI();
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  const toggleSelection = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleAccept = useCallback(() => {
    // Update selected steps to "done"
    const updated = maintenancePlan.map((step, idx) =>
      selectedIndices.has(idx) ? { ...step, status: "done" as const } : step,
    );
    setMaintenancePlan(updated);
    setSelectedIndices(new Set());
  }, [maintenancePlan, selectedIndices, setMaintenancePlan]);

  if (maintenancePlan.length === 0) return null;

  const doneCount  = maintenancePlan.filter((s) => s.status === "done").length;
  const totalHours = maintenancePlan.reduce((acc, s) => acc + (s.estimatedHours ?? 0), 0);
  const selectedHours = Array.from(selectedIndices).reduce(
    (acc, idx) => acc + (maintenancePlan[idx]?.estimatedHours ?? 0),
    0,
  );
  const allDone    = doneCount === maintenancePlan.length;

  return (
    <section className="space-y-4">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Maintenance Plan
          </h2>

          <span
            className={[
              "rounded-full px-2.5 py-0.5 text-sm font-semibold",
              allDone
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
            ].join(" ")}
          >
            {doneCount}/{maintenancePlan.length} done
          </span>

          {totalHours > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {totalHours.toFixed(1)} h
            </span>
          )}

          {selectedIndices.size > 0 && (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {selectedIndices.size} selected • {selectedHours.toFixed(1)}h
            </span>
          )}
        </div>

        <button
          onClick={() => setMaintenancePlan([])}
          className="text-xs text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
        >
          Clear plan
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
          const isSelected = selectedIndices.has(i);
          // Format: T01>C01>ISS-1002 nếu có issueId, nếu không dùng title
          const displayFormat = step.issueId 
            ? `${step.trainId}>${step.carriageId}>${step.issueId}`
            : step.title;

          return (
            <label
              key={step.id ?? i}
              className={[
                "flex flex-col gap-3 rounded-xl border p-4 shadow-sm",
                "transition-all duration-150 cursor-pointer",
                isSelected
                  ? "border-blue-300 bg-blue-50 dark:border-blue-700/50 dark:bg-blue-900/20"
                  : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50",
              ].join(" ")}
            >
              {/* Row 1 — checkbox · order badge · title */}
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelection(i)}
                  className="mt-1 h-4 w-4 rounded cursor-pointer"
                />

                <span
                  className={[
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center",
                    "rounded-full text-[11px] font-bold",
                    step.status === "done"
                      ? "bg-emerald-200 text-emerald-700 dark:bg-emerald-800/50 dark:text-emerald-300"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
                  ].join(" ")}
                >
                  {step.status === "done" ? "✓" : step.order}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold font-mono text-slate-700 dark:text-slate-200">
                    {displayFormat}
                  </p>
                  <p
                    className={[
                      "truncate text-xs",
                      step.status === "done"
                        ? "text-slate-400 line-through dark:text-slate-500"
                        : "text-slate-600 dark:text-slate-300",
                    ].join(" ")}
                  >
                    {step.title}
                  </p>
                </div>
              </div>

              {/* Row 2 — details / description */}
              {step.details && (
                <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                  {step.details}
                </p>
              )}

              {/* Row 3 — assignee · hours */}
              <div className="mt-auto flex flex-wrap items-center gap-1.5">
                {step.technicianName && step.technicianName !== "Unassigned" && (
                  <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="text-slate-400">👤</span>
                    {step.technicianName}
                  </span>
                )}

                {step.estimatedHours ? (
                  <span className="ml-auto text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                    {step.estimatedHours}h
                  </span>
                ) : null}
              </div>
            </label>
          );
        })}
      </div>

      {/* ── Accept Button ────────────────────────────────────────────────– */}
      {selectedIndices.size > 0 && (
        <button
          onClick={handleAccept}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white transition-all hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800"
        >
          Confirm ({selectedIndices.size})
        </button>
      )}
    </section>
  );
}
