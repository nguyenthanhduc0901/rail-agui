import { ToolCard, ToolCardContent, ToolCardHeader } from "@/components/ui/tool-card";

interface IssueUpdateCardProps {
  params?: Record<string, unknown>;
  status: string;
}

export function IssueUpdateCard({ params, status }: IssueUpdateCardProps) {
  const changes: string[] = [];

  if (params?.status) changes.push(`status -> ${params.status}`);
  if (params?.priority) changes.push(`priority -> ${params.priority}`);
  if (params?.assignee_id) changes.push(`assignee -> ${params.assignee_id}`);

  return (
    <ToolCard className="border-violet-200 bg-violet-50 dark:border-violet-800/40 dark:bg-violet-950/30 shadow-none">
      <ToolCardHeader
        title={`Cập nhật ${String(params?.issue_id ?? "sự cố")}`}
        status={status}
        className="text-violet-800 dark:text-violet-200"
      />
      {changes.length > 0 && (
        <ToolCardContent className="flex flex-wrap gap-1.5">
          {changes.map((change) => (
            <span
              key={change}
              className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-violet-700 dark:bg-slate-800 dark:text-violet-300"
            >
              {change}
            </span>
          ))}
        </ToolCardContent>
      )}
    </ToolCard>
  );
}