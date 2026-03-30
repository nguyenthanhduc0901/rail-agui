"use client";

import { useEffect, useRef, ReactNode } from "react";
import { CopilotChat } from "@copilotkit/react-core/v2";
import { useAgent } from "@copilotkit/react-core/v2";

import { DashboardShell } from "@/components/dashboard-shell";
import { AppLayout } from "./layout/AppLayout";
import { FleetDashboard } from "./screens/FleetDashboard";
import { RailDashboardAIProvider } from "./context/rail-dashboard-ai-context";
import { FleetDataProvider, useFleetData } from "./context/fleet-data-context";
import {
  useChatHistoryGuard,
  useRailDashboardAIControls,
  useRailChatSuggestions,
  useRailToolRendering,
} from "@/hooks";

function RailDashboardWorkspace(): ReactNode {
  useChatHistoryGuard();
  useRailToolRendering();
  useRailDashboardAIControls();
  useRailChatSuggestions();

  const { refresh } = useFleetData();
  const { agent } = useAgent();
  const wasRunning = useRef(false);

  useEffect(() => {
    if (wasRunning.current && !agent.isRunning) {
      refresh();
    }
    wasRunning.current = agent.isRunning;
  }, [agent.isRunning, refresh]);

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
    <FleetDataProvider>
      <RailDashboardAIProvider>
        <RailDashboardWorkspace />
      </RailDashboardAIProvider>
    </FleetDataProvider>
  );
}

