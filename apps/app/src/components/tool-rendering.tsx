"use client";

import { useEffect, useRef } from "react";
import { StatusIndicator } from "@/components/ui/status-indicator";

interface ToolReasoningProps {
  name: string;
  args?: object | unknown;
  status: string;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === "object" && value !== null)
    return `{${Object.keys(value).length} keys}`;
  if (typeof value === "string") return `"${value}"`;
  return String(value);
}

export function ToolReasoning({ name, args, status }: ToolReasoningProps) {
  const entries = args ? Object.entries(args) : [];
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!detailsRef.current) return;
    detailsRef.current.open = status === "executing";
  }, [status]);

  return (
    <div className="my-2 text-sm">
      {entries.length > 0 ? (
        <details ref={detailsRef} open>
          <summary className="flex items-center gap-2 text-gray-600 dark:text-gray-400 cursor-pointer list-none">
            <StatusIndicator status={status} size="sm" />
            <span className="font-medium">{name}</span>
            <span className="text-[10px]">▼</span>
          </summary>
          <div className="pl-5 mt-1 space-y-1 text-xs text-gray-500 dark:text-zinc-400">
            {entries.map(([key, value]) => (
              <div key={key} className="flex gap-2 min-w-0">
                <span className="font-medium shrink-0">{key}:</span>
                <span className="text-gray-600 dark:text-gray-400 truncate">
                  {formatValue(value)}
                </span>
              </div>
            ))}
          </div>
        </details>
      ) : (
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <StatusIndicator status={status} size="sm" />
          <span className="font-medium">{name}</span>
        </div>
      )}
    </div>
  );
}
