"use client";

import { CopilotChat } from "@copilotkit/react-core/v2";

export function ChatPanel() {
  return (
    <aside className="sticky top-0 hidden h-screen w-full max-w-[420px] shrink-0 self-start border-l border-slate-200 bg-white/95 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-black/20 lg:block">
      <div className="h-full overflow-y-auto px-4 py-4">
        <CopilotChat
          input={{
            disclaimer: () => null,
            className: "pb-4",
          }}
          className="h-full"
          labels={{
            title: "Rail AI Assistant",
            initial: "Xin chào! Tôi có thể hỗ trợ bạn phân tích tình trạng đội tàu.",
          }}
        />
      </div>
    </aside>
  );
}
