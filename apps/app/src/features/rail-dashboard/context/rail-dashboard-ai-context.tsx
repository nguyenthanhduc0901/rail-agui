"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

const defaultFilters = {
  trainId: "all",
  system: "all",
  priority: "all",
  status: "all",
} as const;

const MAX_WIDGETS = 12;
const MAX_MAINTENANCE_STEPS = 12;

export interface DashboardFilters {
  trainId: string;
  system: string;
  priority: string;
  status: string;
}

export interface Widget {
  id: string;
  kind: "summary" | "risk" | "queue" | "trend";
  title: string;
  summary: string;
  value: string;
  severity: "info" | "warning" | "critical";
  trainId: string;
  createdAt: string;
}

export interface MaintenanceStep {
  id: string;
  order: number;
  title: string;
  details?: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in-progress" | "done";
  estimatedHours?: number;
  assigneeId?: string;
  assigneeName?: string;
}

export interface RailDashboardAIContextType {
  filters: DashboardFilters;
  updateFilters: (partial: Partial<DashboardFilters>) => void;
  clearFilters: () => void;
  widgets: Widget[];
  addWidget: (widget: Partial<Widget>) => void;
  clearWidgets: () => void;
  maintenancePlan: MaintenanceStep[];
  setMaintenancePlan: (plan: MaintenanceStep[]) => void;
}

const RailDashboardAIContext = createContext<RailDashboardAIContextType | null>(
  null,
);

interface RailDashboardAIProviderProps {
  children: ReactNode;
}

export function RailDashboardAIProvider({
  children,
}: RailDashboardAIProviderProps) {
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [maintenancePlan, setMaintenancePlanState] = useState<MaintenanceStep[]>(
    [],
  );

  const updateFilters = useCallback((partial: Partial<DashboardFilters>) => {
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

  const addWidget = useCallback((widget: Partial<Widget>) => {
    const id =
      widget?.id ||
      `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setWidgets((prev) => {
      const next: Widget[] = [
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

  const updateMaintenancePlan = useCallback((plan: MaintenanceStep[]) => {
    const next = Array.isArray(plan) ? plan.slice(0, MAX_MAINTENANCE_STEPS) : [];

    setMaintenancePlanState((prev) => {
      if (prev.length === next.length) {
        const unchanged = prev.every((step, idx) => {
          const incoming = next[idx];
          return (
            step?.id === incoming?.id &&
            step?.status === incoming?.status &&
            step?.title === incoming?.title
          );
        });
        if (unchanged) return prev;
      }
      return next;
    });
  }, []);

  const value = useMemo<RailDashboardAIContextType>(
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

export function useRailDashboardAI(): RailDashboardAIContextType {
  const context = useContext(RailDashboardAIContext);
  if (!context) {
    throw new Error(
      "useRailDashboardAI must be used within RailDashboardAIProvider",
    );
  }
  return context;
}
