import { ToolCard } from "@/components/ui/tool-card";
import { StatusIndicator } from "@/components/ui/status-indicator";

interface PlanStepUpdateCardProps {
  params?: Record<string, unknown>;
  status: string;
}

export function PlanStepUpdateCard({ params, status }: PlanStepUpdateCardProps) {
  const stepId = params?.step_id ? String(params.step_id) : "";
  const stepStatus = params?.status ? String(params.status) : "";

  return (
    <ToolCard className="px-3 py-2.5" showStatus={false}>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {stepId || "Buoc bao tri"}
        </span>
        {stepStatus && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {stepStatus}
          </span>
        )}
        <span className="ml-auto shrink-0">
          <StatusIndicator status={status} size="sm" />
        </span>
      </div>
    </ToolCard>
  );
}