"use client";

import { AppLayout } from "./layout/AppLayout";
import { FleetDashboard } from "./screens/FleetDashboard";

export function RailDashboardApp() {
  return (
    <AppLayout>
      <FleetDashboard />
    </AppLayout>
  );
}
