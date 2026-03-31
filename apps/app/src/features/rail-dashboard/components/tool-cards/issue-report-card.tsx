"use client";

interface IssueReportCardProps {
  status: string;
  wordCount?: number;
}

export function IssueReportCard({ status, wordCount }: IssueReportCardProps) {
  const isStreaming = status === "inProgress";
  const isDone = status === "complete";

  return (
    <div className="my-2 flex items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm dark:border-sky-700/40 dark:bg-sky-950/30">
      {/* Icon */}
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-sky-100 dark:bg-sky-900/50">
        {isStreaming ? (
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
        ) : (
          <svg
            className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        )}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <span className="font-medium text-sky-700 dark:text-sky-300">
          {isStreaming ? "Đang soạn báo cáo..." : "Báo cáo đã được tạo"}
        </span>
        {isDone && wordCount !== undefined && wordCount > 0 && (
          <span className="ml-2 text-xs text-sky-500">
            (~{wordCount} từ)
          </span>
        )}
      </div>

      {/* Status badge */}
      {isDone && (
        <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          ✓ Hoàn thành
        </span>
      )}
    </div>
  );
}
