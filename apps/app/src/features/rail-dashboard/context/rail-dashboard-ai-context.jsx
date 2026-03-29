"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

const defaultFilters = {
  trainId: "all",
  system: "all",
  priority: "all",
  status: "all",
};

const MAX_WIDGETS = 12;
const MAX_MAINTENANCE_STEPS = 12;

const RailDashboardAIContext = createContext(null);

export function RailDashboardAIProvider({ children }) {
  const [filters, setFilters] = useState(defaultFilters);
  const [widgets, setWidgets] = useState([]);
  const [maintenancePlan, setMaintenancePlanState] = useState([]);

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

    setWidgets((prev) => {
      const next = [
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
      ];

      return next.slice(0, MAX_WIDGETS);
    });
  }, []);

  const clearWidgets = useCallback(() => {
    setWidgets([]);
  }, []);

  const updateMaintenancePlan = useCallback((plan) => {
    const next = Array.isArray(plan) ? plan.slice(0, MAX_MAINTENANCE_STEPS) : [];

    setMaintenancePlanState((prev) => {
      if (prev.length === next.length) {
        const unchanged = prev.every((step, idx) => {
          const incoming = next[idx];
          return (
            step?.id === incoming?.id &&
            step?.done === incoming?.done &&
            step?.title === incoming?.title
          );
        });
        if (unchanged) return prev;
      }
      return next;
    });
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
      setMaintenancePlan: updateMaintenancePlan,
    }),
    [
      filters,
      updateFilters,
      clearFilters,
      widgets,
      addWidget,
      clearWidgets,
      maintenancePlan,
      updateMaintenancePlan,
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
