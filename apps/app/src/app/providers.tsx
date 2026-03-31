"use client";

import { CopilotKit } from "@copilotkit/react-core/v2";
import { ThemeProvider } from "@/hooks/use-theme";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {/* a2ui={{}} enables the A2UI declarative renderer.
          The backend already has a2ui.injectA2UITool set, which gives the agent
          the log_a2ui_event tool for emitting rich charts, cards, and tables. */}
      <CopilotKit runtimeUrl="/api/copilotkit" agent="default" a2ui={{}}>
        {children}
      </CopilotKit>
    </ThemeProvider>
  );
}
