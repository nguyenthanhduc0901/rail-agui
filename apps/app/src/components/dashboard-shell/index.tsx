"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  chatContent: ReactNode;
  appContent: ReactNode;
}

function DashboardPane({ children }: { children: ReactNode }) {
  return (
    <div
      id="app-modal-portal"
      className="relative h-full flex-1 overflow-hidden border-r border-zinc-200 dark:border-zinc-700"
    >
      <div className="rail-scrollbar h-full overflow-y-auto">
        <div className="min-h-full w-full">{children}</div>
      </div>
    </div>
  );
}

function ChatPane({ children }: { children: ReactNode }) {
  return (
    <aside
      className={cn(
        "chatbot-scrollbar h-full shrink-0 overflow-y-auto px-4 xl:px-6",
        "w-[430px] max-lg:w-full max-lg:flex-1 max-lg:border-l max-lg:border-zinc-200 dark:max-lg:border-zinc-700",
      )}
    >
      {children}
    </aside>
  );
}

export function DashboardShell({ chatContent, appContent }: DashboardShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <DashboardPane>{appContent}</DashboardPane>
      <ChatPane>{chatContent}</ChatPane>
    </div>
  );
}