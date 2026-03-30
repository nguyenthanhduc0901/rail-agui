import { ToolCard } from "@/components/ui/tool-card";
import { StatusIndicator } from "@/components/ui/status-indicator";

interface FilterActionCardProps {
  params: Record<string, string>;
  status: string;
  label: string;
}

export function FilterActionCard({ params, status, label }: FilterActionCardProps) {
  const parts = Object.entries(params).filter(([, value]) => value && value !== "all");

  return (
    <ToolCard variant="action" className="px-3 py-2 shadow-none" showStatus={false}>
      <div className="flex items-center gap-2">
        <span className="text-indigo-500">⚙</span>
        <span className="font-medium text-indigo-700 dark:text-indigo-300">{label}</span>
        {parts.length > 0 && (
          <span className="text-xs text-indigo-500 dark:text-indigo-400">
            {parts.map(([key, value]) => `${key}: ${value}`).join(" · ")}
          </span>
        )}
        <span className="ml-auto shrink-0">
          <StatusIndicator status={status} size="sm" />
        </span>
      </div>
    </ToolCard>
  );
}