"use client";

import { CopilotChat } from "@copilotkit/react-core/v2";

import { ExampleLayout } from "@/components/example-layout";
import { AppLayout } from "./layout/AppLayout";
import { FleetDashboard } from "./screens/FleetDashboard";
import {
  useExampleSuggestions,
  useGenerativeUIExamples,
  useRailDashboardContext,
} from "@/hooks";

export function RailDashboardApp() {
  useGenerativeUIExamples();
  useExampleSuggestions();
  useRailDashboardContext();

  return (
    <ExampleLayout
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
