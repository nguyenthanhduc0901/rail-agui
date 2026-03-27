"use client";

import { AppLayout } from "./layout/AppLayout";
import { FleetDashboard } from "./screens/FleetDashboard";
import { useGenerativeUIExamples } from "@/hooks";

export function RailDashboardApp() {
  useGenerativeUIExamples();

  return (
    <AppLayout>
      <FleetDashboard />
    </AppLayout>
  );
}
