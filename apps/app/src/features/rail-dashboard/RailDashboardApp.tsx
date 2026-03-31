"use client";

import { useCallback, useEffect, ReactNode } from "react";
import { CopilotChat } from "@copilotkit/react-core/v2";
import { useAgent, UseAgentUpdate, useCopilotKit } from "@copilotkit/react-core/v2";

import { DashboardShell } from "@/components/dashboard-shell";
import { AppLayout } from "./layout/AppLayout";
import { FleetDashboard } from "./screens/FleetDashboard";
import { RailDashboardAIProvider } from "./context/rail-dashboard-ai-context";
import { FleetDataProvider, useFleetData } from "./context/fleet-data-context";
import { useRailDashboardAI } from "./context/rail-dashboard-ai-context";
import { IssueReportPanel } from "./components/IssueReportPanel";
import { AgentProgressView } from "./components/AgentProgressView";
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
  const { setMaintenancePlan, issueReport, openIssueReport, issueReportPanelOpen, closeIssueReportPanel, setAgentProgress } = useRailDashboardAI();
  const { agent } = useAgent({ updates: [UseAgentUpdate.OnStateChanged, UseAgentUpdate.OnRunStatusChanged] });
  const { copilotkit } = useCopilotKit();

  // Feature 2: use agent.subscribe() event bus instead of wasRunning ref polling.
  // onRunFinalized fires exactly once when a run completes (success or error),
  // ensuring data is always refreshed and progress is always cleared.
  useEffect(() => {
    const { unsubscribe } = agent.subscribe({
      onRunFinalized: () => {
        refresh();
        setAgentProgress([]);
      },
    });
    return unsubscribe;
  }, [agent, refresh, setAgentProgress]);

  // Feature 3: programmatic agent run trigger.
  // "Phân tích đội tàu" — fires a silent analysis without requiring the user to type.
  const handleAnalyzeFleet = useCallback(async () => {
    agent.addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content:
        "Phân tích tổng quan đội tàu: tóm tắt tình trạng hiện tại, liệt kê TOP 3 sự cố nghiêm trọng nhất, và đề xuất hành động ưu tiên cần thực hiện ngay.",
    });
    await copilotkit.runAgent({ agent });
  }, [agent, copilotkit]);

  // Feature 3: stop a running agent turn.
  const handleStopAgent = useCallback(() => {
    copilotkit.stopAgent({ agent });
  }, [agent, copilotkit]);

  // Sync issueReport from agent state whenever it changes
  useEffect(() => {
    const stateReport = (agent.state as { issueReport?: string } | undefined)?.issueReport;
    if (stateReport !== undefined && stateReport !== issueReport) {
      openIssueReport(stateReport ?? null);
    }
  }, [agent.state, issueReport, openIssueReport]);


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
    <>
      <DashboardShell
        chatContent={
          <>
            {/* Feature 3: Agent control toolbar — sticky above the chat scroll area */}
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-200 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-zinc-700 dark:bg-slate-900/95">
              <button
                onClick={handleAnalyzeFleet}
                disabled={agent.isRunning}
                title="Phân tích tổng quan đội tàu"
                className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-700 dark:hover:bg-sky-600"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Phân tích đội tàu
              </button>

              {agent.isRunning && (
                <button
                  onClick={handleStopAgent}
                  title="Dừng agent"
                  className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition-all hover:bg-red-50 dark:border-red-700 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Dừng
                </button>
              )}
            </div>

            <CopilotChat
              input={{ disclaimer: () => null, className: "pb-6" }}
              messageView={{
                children: ({ messageElements, interruptElement, isRunning, messages }) => (
                  <div className="flex flex-col">
                    {messageElements}
                    <AgentProgressView />
                    {interruptElement}
                    {/* Loading cursor — mirrors CopilotChatMessageView default behaviour.
                        Needed because custom children bypass the built-in cursor. */}
                    {isRunning && messages[messages.length - 1]?.role !== "reasoning" && (
                      <div
                        data-testid="copilot-loading-cursor"
                        className="cpk:w-[11px] cpk:h-[11px] cpk:rounded-full cpk:bg-foreground cpk:animate-pulse-cursor cpk:ml-1"
                      />
                    )}
                  </div>
                ),
              }}
            />
          </>
        }
        appContent={
          <AppLayout>
            <FleetDashboard />
          </AppLayout>
        }
      />

      {/* Floating button to re-open report panel when it has content */}
      {issueReport && !issueReportPanelOpen && (
        <button
          onClick={() => openIssueReport(issueReport)}
          className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Báo cáo
        </button>
      )}

      <IssueReportPanel
        report={issueReport}
        isOpen={issueReportPanelOpen}
        isStreaming={agent.isRunning}
        onClose={closeIssueReportPanel}
      />
    </>
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

