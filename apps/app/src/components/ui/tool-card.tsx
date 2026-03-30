import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StatusIndicator } from "./status-indicator";

interface ToolCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "info" | "warning" | "critical" | "action" | "query";
  status?: string;
  showStatus?: boolean;
}

const variantStyles = {
  default: "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
  info: "border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-950/30",
  warning: "border-amber-200 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-950/30",
  critical: "border-red-200 bg-red-50 dark:border-red-700/40 dark:bg-red-950/30",
  action: "border-indigo-200 bg-indigo-50 dark:border-indigo-800/40 dark:bg-indigo-950/30",
  query: "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
};

export function ToolCard({
  children,
  className,
  variant = "default",
  status,
  showStatus = true,
}: ToolCardProps) {
  return (
    <div
      className={cn(
        "my-2 rounded-xl border p-3 text-sm shadow-sm transition-all",
        variantStyles[variant],
        className
      )}
    >
      {children}
      {showStatus && status && (
        <div className="mt-2 flex justify-end">
          <StatusIndicator status={status} size="sm" />
        </div>
      )}
    </div>
  );
}

interface ToolCardHeaderProps {
  title: string;
  icon?: ReactNode;
  status?: string;
  badge?: ReactNode;
  className?: string;
}

export function ToolCardHeader({ title, icon, status, badge, className }: ToolCardHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="truncate font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </span>
        {badge}
      </div>
      {status && <StatusIndicator status={status} size="sm" />}
    </div>
  );
}

interface ToolCardContentProps {
  children: ReactNode;
  className?: string;
}

export function ToolCardContent({ children, className }: ToolCardContentProps) {
  return <div className={cn("mt-1.5", className)}>{children}</div>;
}
