"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface IssueReportPanelProps {
  report: string | null;
  isOpen: boolean;
  isStreaming: boolean;
  onClose: () => void;
}

export function IssueReportPanel({
  report,
  isOpen,
  isStreaming,
  onClose,
}: IssueReportPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom while streaming
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [report, isStreaming]);

  const handleCopy = () => {
    if (report) {
      navigator.clipboard.writeText(report).catch(() => {});
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] dark:bg-black/40"
          onClick={onClose}
        />
      )}

      {/* Sliding panel */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:bg-slate-900 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/40">
              <svg
                className="h-4 w-4 text-sky-600 dark:text-sky-400"
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
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Issue Report
              </h2>
              {isStreaming && (
                <span className="flex items-center gap-1.5 text-xs text-sky-500">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
                  Writing...
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {report && (
              <button
                onClick={handleCopy}
                title="Copy to clipboard"
                className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-6 py-5"
        >
          {!report && isStreaming && (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${
                    i === 2 ? "w-3/4" : i === 4 ? "w-5/6" : "w-full"
                  }`}
                />
              ))}
            </div>
          )}

          {report && (
            <div className="prose prose-sm prose-slate max-w-none dark:prose-invert prose-headings:font-semibold prose-table:text-xs prose-th:bg-slate-100 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-1.5 dark:prose-th:bg-slate-800">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
            </div>
          )}

          {!report && !isStreaming && (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Chưa có báo cáo. Hãy yêu cầu AI lập báo cáo.
            </p>
          )}
        </div>

        {/* Footer hint */}
        {report && !isStreaming && (
          <div className="flex-shrink-0 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              You can ask the AI to edit this report directly via chat.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
