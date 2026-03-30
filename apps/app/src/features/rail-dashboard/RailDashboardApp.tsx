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
  const { maintenancePlan, setMaintenancePlan } = useRailDashboardAI();
  const { agent } = useAgent();
  const wasRunning = useRef(false);
  const seedDoneRef = useRef(false);

  // Auto-refresh fleet data when agent finishes a run
  useEffect(() => {
    if (wasRunning.current && !agent.isRunning) {
      refresh();
    }
    wasRunning.current = agent.isRunning;
  }, [agent.isRunning, refresh]);

  // Seed plan board from DB on first load (restores plan after page refresh)
  useEffect(() => {
    if (seedDoneRef.current || isLoading) return;
    seedDoneRef.current = true;
    if (planSteps.length > 0 && maintenancePlan.length === 0) {
      setMaintenancePlan(
        planSteps.map((s) => ({
          id:             s.id,
          order:          s.order,
          title:          s.title,
          details:        s.details ?? undefined,
          priority:       s.priority,
          status:         s.status,
          estimatedHours: s.estimatedHours,
          assigneeId:     s.assigneeId,
          assigneeName:   s.assigneeName,
        }))
      );
    }
  }, [isLoading, planSteps, maintenancePlan.length, setMaintenancePlan]);

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

