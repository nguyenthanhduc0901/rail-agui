"use client";

import { CopilotChat } from "@copilotkit/react-core/v2";

import { DashboardShell } from "@/components/dashboard-shell";
import { AppLayout } from "./layout/AppLayout";
import { FleetDashboard } from "./screens/FleetDashboard";
import { RailDashboardAIProvider } from "./context/rail-dashboard-ai-context";
import {
  useChatHistoryGuard,
  useRailDashboardAIControls,
  useRailChatSuggestions,
  useRailToolRendering,
} from "@/hooks";

function RailDashboardWorkspace() {
  useChatHistoryGuard();
  useRailToolRendering();
  useRailDashboardAIControls();
  useRailChatSuggestions();

  return (
    <DashboardShell
      chatContent={
        <CopilotChat input={{ disclaimer: () => null, className: "pb-6" }} />
      }
      appContent={
        <AppLayout>
          <FleetDashboard />
        </AppLayout>
      }
    />
  );
}

export function RailDashboardApp() {
  return (
    <RailDashboardAIProvider>
      <RailDashboardWorkspace />
    </RailDashboardAIProvider>
  );
}

