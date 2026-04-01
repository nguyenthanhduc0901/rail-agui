import { cn } from "@/lib/utils";

type ToolStatus = "executing" | "inProgress" | "complete" | string;

interface StatusIndicatorProps {
  status: ToolStatus;
  className?: string;
  size?: "sm" | "md";
}

export function StatusIndicator({ status, className, size = "md" }: StatusIndicatorProps) {
  const sizeClasses = size === "sm" ? "h-3 w-3 border-2" : "h-4 w-4 border-2";

  if (status === "complete") {
    return (
      <span className={cn("text-xs font-medium text-emerald-600 dark:text-emerald-400", className)}>
        ✓ Done
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-block animate-spin rounded-full border-slate-400 border-t-transparent",
        sizeClasses,
        className
      )}
    />
  );
}
