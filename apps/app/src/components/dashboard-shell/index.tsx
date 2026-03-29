"use client";

import { ReactNode } from "react";

interface DashboardShellProps {
  chatContent: ReactNode;
  appContent: ReactNode;
}

export function DashboardShell({ chatContent, appContent }: DashboardShellProps) {
  return (
    <div className="h-screen flex flex-row overflow-hidden">
      {/* Left panel: relative + overflow-hidden so the modal portal is scoped here */}
      <div
        id="app-modal-portal"
        className="h-full flex-1 relative overflow-hidden border-r border-zinc-200 dark:border-zinc-700"
      >
        <div className="h-full overflow-y-auto rail-scrollbar">
          <div className="w-full min-h-full">{appContent}</div>
        </div>
      </div>

      <div className="h-full overflow-y-auto chatbot-scrollbar w-[430px] shrink-0 px-4 xl:px-6 max-lg:hidden">
        {chatContent}
      </div>
    </div>
  );
}