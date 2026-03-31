"use client";

import { useRailDashboardAI } from "@/features/rail-dashboard/context/rail-dashboard-ai-context";

export function AgentProgressView() {
  const { agentProgress } = useRailDashboardAI();

  if (!agentProgress || agentProgress.length === 0) return null;

  const doneCount = agentProgress.filter((s) => s.status === "done").length;
  const totalCount = agentProgress.length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
      {/* Progress bar */}
      <div className="h-1 w-full bg-slate-100 dark:bg-slate-700">
        <div
          className="h-full bg-sky-500 transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="px-4 py-3">
        {/* Header */}
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Đang xử lý...
          </span>
          <span className="text-xs font-semibold tabular-nums text-sky-600 dark:text-sky-400">
            {doneCount}/{totalCount}
          </span>
        </div>

        {/* Steps */}
        <div className="space-y-1.5">
          {agentProgress.map((step) => (
            <div key={step.id} className="flex items-start gap-2.5">
              {/* Status icon */}
              <div className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center">
                {step.status === "done" && (
                  <svg
                    className="h-3.5 w-3.5 text-emerald-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                {step.status === "doing" && (
                  <svg
                    className="h-3.5 w-3.5 animate-spin text-sky-500"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                )}
                {step.status === "pending" && (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                )}
              </div>

              {/* Description */}
              <span
                className={`text-xs leading-snug transition-colors ${
                  step.status === "done"
                    ? "text-slate-400 line-through dark:text-slate-500"
                    : step.status === "doing"
                      ? "font-medium text-slate-700 dark:text-slate-200"
                      : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {step.description}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
