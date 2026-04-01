import { useCallback, useMemo, useState } from "react";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { ToolCard } from "@/components/ui/tool-card";
import { useAgent } from "@copilotkit/react-core/v2";
import {
  useRailDashboardAI,
  type MaintenanceStep,
} from "../../context/rail-dashboard-ai-context";

interface MaintenancePlanCardProps {
  status: string;
}

export function MaintenancePlanCard({ status }: MaintenancePlanCardProps) {
  const { maintenancePlan, setMaintenancePlan } = useRailDashboardAI();
  const { agent } = useAgent();
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(true);
    try {
      // Get selected step IDs
      const selectedIds = Array.from(selectedIndices).map(
        (idx) => maintenancePlan[idx]?.id
      );

      // Update local state to "done"
      const updated = maintenancePlan.map((step, idx) =>
        selectedIndices.has(idx) ? { ...step, status: "done" as const } : step,
      );
      setMaintenancePlan(updated);

      // Call backend tool to persist changes to DB
      agent.addMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: `Lưu kế hoạch bảo trì: ${selectedIds.join(", ")}`,
      });

      // Clear selection
      setSelectedIndices(new Set());
    } catch (error) {
      console.error("Failed to accept plan steps:", error);
    } finally {
      // Reset immediately since addMessage is not async
      setIsSubmitting(false);
    }
  }, [maintenancePlan, selectedIndices, setMaintenancePlan, agent]);

  const summary = useMemo(() => {
    const totalHours = maintenancePlan.reduce(
      (sum, step) => sum + (step.estimatedHours ?? 0),
      0,
    );
    const selectedHours = Array.from(selectedIndices).reduce(
      (sum, idx) => sum + (maintenancePlan[idx]?.estimatedHours ?? 0),
      0,
    );

    return { totalHours, selectedHours, selectedCount: selectedIndices.size };
  }, [maintenancePlan, selectedIndices]);


  return (
    <ToolCard className="shadow-none mt-3 border-t pt-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Kế hoạch bảo trì
        </span>
        {summary.totalHours > 0 && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">
            {summary.totalHours.toFixed(1)}h
          </span>
        )}
        {selectedIndices.size > 0 && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            {summary.selectedCount} chọn • {summary.selectedHours.toFixed(1)}h
          </span>
        )}
        {!isSubmitting && (
          <span className="ml-auto shrink-0">
            <StatusIndicator status={status} size="sm" />
          </span>
        )}
      </div>

      {maintenancePlan.length === 0 ? (
        <p className="text-xs text-slate-400">Đang tải các bước...</p>
      ) : (
        <>
          <div className="space-y-2 mb-3">
            {maintenancePlan.map((step, index) => {
              const isSelected = selectedIndices.has(index);
              // Format: T01>C01>ISS-1002 nếu có issueId, nếu không dùng title
              const displayFormat = step.issueId 
                ? `${step.trainId}>${step.carriageId}>${step.issueId}`
                : step.title;

              return (
                <label
                  key={step.id ?? index}
                  className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(index)}
                    className="mt-1 h-4 w-4 rounded cursor-pointer"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-100 font-mono">
                      {displayFormat}
                    </p>
                    <p className="truncate text-xs text-slate-600 dark:text-slate-400">
                      {step.title}
                    </p>
                    {step.technicianName && step.technicianName !== "Unassigned" && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        👤 {step.technicianName} {step.estimatedHours ? `• ${step.estimatedHours}h` : ""}
                      </p>
                    )}
                  </div>

                  <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {step.order ?? index + 1}
                  </span>
                </label>
              );
            })}
          </div>

          <button
            onClick={handleAccept}
            disabled={selectedIndices.size === 0 || isSubmitting}
            className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-emerald-700 dark:hover:bg-emerald-800"
          >
            {isSubmitting ? "Đang lưu..." : `Xác nhận (${selectedIndices.size})`}
          </button>
        </>
      )}
    </ToolCard>
  );
}