import { ToolCard, ToolCardContent, ToolCardHeader } from "@/components/ui/tool-card";

interface WidgetToolCardProps {
  params?: Record<string, string>;
  status: string;
}

const severityVariant = {
  info: "info",
  warning: "warning",
  critical: "critical",
} as const;

export function WidgetToolCard({ params, status }: WidgetToolCardProps) {
  const variant = params?.severity && params.severity in severityVariant
    ? severityVariant[params.severity as keyof typeof severityVariant]
    : "info";

  return (
    <ToolCard variant={variant} className="shadow-none">
      <ToolCardHeader title={params?.title ?? "AI Widget"} status={status} />
      <ToolCardContent>
        {params?.value && (
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {params.value}
          </p>
        )}
        {params?.summary && (
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {params.summary}
          </p>
        )}
        {params?.trainId && params.trainId !== "all" && (
          <span className="mt-2 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {params.trainId}
          </span>
        )}
      </ToolCardContent>
    </ToolCard>
  );
}