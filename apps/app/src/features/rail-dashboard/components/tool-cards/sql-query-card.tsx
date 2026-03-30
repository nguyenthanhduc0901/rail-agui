import { ToolCard } from "@/components/ui/tool-card";
import { StatusIndicator } from "@/components/ui/status-indicator";

interface SQLQueryCardProps {
  params?: Record<string, unknown>;
  status: string;
}

export function SQLQueryCard({ params, status }: SQLQueryCardProps) {
  const sql = params?.sql ? String(params.sql) : null;
  const preview = sql
    ? `${sql.replace(/\s+/g, " ").trim().slice(0, 90)}${sql.length > 90 ? "..." : ""}`
    : null;

  return (
    <ToolCard variant="query" className="px-3 py-2.5" showStatus={false}>
      <div className="flex items-center gap-2">
        <svg
          className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h10M4 17h7" />
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
          <StatusIndicator status={status} size="sm" />
        </span>
      </div>
    </ToolCard>
  );
}