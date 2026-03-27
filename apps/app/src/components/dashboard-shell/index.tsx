"use client";

import { ReactNode, useState } from "react";
import { useFrontendTool } from "@copilotkit/react-core";

import { ModeToggle } from "./mode-toggle";

interface DashboardShellProps {
  chatContent: ReactNode;
  appContent: ReactNode;
}

const CHATBOT_WIDTH_APP_MODE = "430px";

export function DashboardShell({ chatContent, appContent }: DashboardShellProps) {
  const [mode, setMode] = useState<"chat" | "app">("chat");

  useFrontendTool({
    name: "enableAppMode",
    description: "Enable app mode while the user inspects dashboard details.",
    handler: async () => {
      setMode("app");
    },
  });

  useFrontendTool({
    name: "enableChatMode",
    description: "Enable chat mode.",
    handler: async () => {
      setMode("chat");
    },
  });

  return (
    <div className="h-screen flex flex-row overflow-hidden">
      <ModeToggle mode={mode} onModeChange={setMode} />

      <div
        className={`h-full overflow-y-auto rail-scrollbar ${
          mode === "app"
            ? "flex-1 border-r border-zinc-200 dark:border-zinc-700 max-lg:border-r-0"
            : "w-0 border-r-0"
        }`}
      >
        <div className="w-full min-h-full">{appContent}</div>
      </div>

      <div
        className={`h-full overflow-y-auto chatbot-scrollbar ${
          mode === "app"
            ? "min-w-[320px] max-w-[420px] px-4 xl:px-6 max-lg:hidden"
            : "flex-1 max-w-[48rem] ml-auto px-4 lg:px-6"
        }`}
        style={mode === "app" ? { width: CHATBOT_WIDTH_APP_MODE } : undefined}
      >
        {chatContent}
      </div>
    </div>
  );
}