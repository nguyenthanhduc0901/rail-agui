"use client";

import { useEffect, useRef, ReactNode } from "react";
import { CopilotChat } from "@copilotkit/react-core/v2";
import { useAgent } from "@copilotkit/react-core/v2";

import { DashboardShell } from "@/components/dashboard-shell";
import { AppLayout } from "./layout/AppLayout";
import { FleetDashboard } from "./screens/FleetDashboard";
import { RailDashboardAIProvider } from "./context/rail-dashboard-ai-context";
import { FleetDataProvider, useFleetData } from "./context/fleet-data-context";
import { useRailDashboardAI } from "./context/rail-dashboard-ai-context";
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

  const { refresh, planSteps, isLoading } = useFleetData();
  const { setMaintenancePlan } = useRailDashboardAI();
  const { agent } = useAgent();
  const wasRunning = useRef(false);

  // Auto-refresh fleet data when agent finishes a run
  useEffect(() => {
    if (wasRunning.current && !agent.isRunning) {
      refresh();
    }
    wasRunning.current = agent.isRunning;
  }, [agent.isRunning, refresh]);

  // Sync plan board from DB whenever planSteps updates.
  // Handles both initial page load and post-update_plan_step refreshes.
  // Skips while agent is actively streaming so the live board isn't overwritten.
  useEffect(() => {
    if (isLoading || planSteps.length === 0 || agent.isRunning) return;
    setMaintenancePlan(
      planSteps.map((s) => ({
        id:             s.id,
        order:          s.order,
        title:          s.title,
        details:        s.details ?? undefined,
        status:         s.status,
        estimatedHours: s.estimatedHours,
        technicianId:   s.technicianId ?? undefined,
        technicianName: s.technicianName,
      }))
    );
  }, [planSteps, isLoading, agent.isRunning, setMaintenancePlan]);

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

