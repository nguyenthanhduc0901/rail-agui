"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

const defaultFilters = {
  trainId: "all",
  system: "all",
  priority: "all",
  status: "all",
};

const RailDashboardAIContext = createContext(null);

export function RailDashboardAIProvider({ children }) {
  const [filters, setFilters] = useState(defaultFilters);
  const [widgets, setWidgets] = useState([]);
  const [maintenancePlan, setMaintenancePlan] = useState([]);

  const updateFilters = useCallback((partial) => {
    setFilters((prev) => ({
      ...prev,
      ...Object.fromEntries(
        Object.entries(partial || {}).filter(([, value]) => value !== undefined),
      ),
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const addWidget = useCallback((widget) => {
    const id =
      widget?.id ||
      `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setWidgets((prev) => [
      {
        id,
        kind: widget?.kind || "summary",
        title: widget?.title || "AI Widget",
        summary: widget?.summary || "",
        value: widget?.value || "",
        severity: widget?.severity || "info",
        trainId: widget?.trainId || "all",
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  }, []);

  const clearWidgets = useCallback(() => {
    setWidgets([]);
  }, []);

  const value = useMemo(
    () => ({
      filters,
      updateFilters,
      clearFilters,
      widgets,
      addWidget,
      clearWidgets,
      maintenancePlan,
      setMaintenancePlan,
    }),
    [
      filters,
      updateFilters,
      clearFilters,
      widgets,
      addWidget,
      clearWidgets,
      maintenancePlan,
    ],
  );

  return (
    <RailDashboardAIContext.Provider value={value}>
      {children}
    </RailDashboardAIContext.Provider>
  );
}

export function useRailDashboardAI() {
  const context = useContext(RailDashboardAIContext);
  if (!context) {
    throw new Error("useRailDashboardAI must be used within RailDashboardAIProvider");
  }
  return context;
}
