"use client";

import { CopilotChat } from "@copilotkit/react-core/v2";

import { DashboardShell } from "@/components/dashboard-shell";
import { AppLayout } from "./layout/AppLayout";
import { FleetDashboard } from "./screens/FleetDashboard";
import {
  useRailChatSuggestions,
  useRailToolRendering,
  useRailDashboardContext,
} from "@/hooks";

export function RailDashboardApp() {
  useRailToolRendering();
  useRailChatSuggestions();
  useRailDashboardContext();

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
