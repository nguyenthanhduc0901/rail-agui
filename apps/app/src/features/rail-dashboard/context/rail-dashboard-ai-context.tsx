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
  status: "pending" | "doing" | "done";
  estimatedHours?: number;
  technicianId?: string;
  technicianName?: string;
}

export interface PendingPlanStep {
  seqOrder: number;
  title: string;
  estimatedHours: number;
  technicianId?: string | null;
  technicianName?: string | null;
}

export interface PendingIssuePlan {
  issueId: string;
  issueTitle: string;
  mode: 'create' | 'append';
  existingCount: number;
  rationale?: string;
  steps: PendingPlanStep[];
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
  highlightByStatus: boolean;
  setHighlightByStatus: (value: boolean) => void;
  // Per-carriage system highlight
  highlightedCarriageIds: Set<string>;
  toggleCarriageHighlight: (carriageId: string, enabled: boolean) => void;
  // Currently open carriage (modal context)
  activeCarriageId: string | null;
  activeTrainId: string | null;
  setActiveCarriage: (carriageId: string | null, trainId: string | null) => void;
  // Pending AI-proposed issue plan awaiting approval
  pendingIssuePlan: PendingIssuePlan | null;
  setPendingIssuePlan: (plan: PendingIssuePlan | null) => void;
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
  const [highlightByStatus, setHighlightByStatus] = useState(false);
  const [highlightedCarriageIds, setHighlightedCarriageIds] = useState<Set<string>>(new Set());
  const [activeCarriageId, setActiveCarriageIdState] = useState<string | null>(null);
  const [activeTrainId, setActiveTrainIdState] = useState<string | null>(null);
  const [pendingIssuePlan, setPendingIssuePlan] = useState<PendingIssuePlan | null>(null);

  const toggleCarriageHighlight = useCallback((carriageId: string, enabled: boolean) => {
    setHighlightedCarriageIds((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.add(carriageId);
      } else {
        next.delete(carriageId);
      }
      return next;
    });
  }, []);

  const setActiveCarriage = useCallback((carriageId: string | null, trainId: string | null) => {
    setActiveCarriageIdState(carriageId);
    setActiveTrainIdState(trainId);
    // Clear highlight for this carriage when closed
    if (carriageId === null) {
      setHighlightedCarriageIds((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        // We don't know old carriageId here, so leave the set as-is
        // Highlights persist until explicitly toggled off
        return next;
      });
    }
  }, []);

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
      highlightByStatus,
      setHighlightByStatus,
      highlightedCarriageIds,
      toggleCarriageHighlight,
      activeCarriageId,
      activeTrainId,
      setActiveCarriage,
      pendingIssuePlan,
      setPendingIssuePlan,
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
      highlightByStatus,
      setHighlightByStatus,
      highlightedCarriageIds,
      toggleCarriageHighlight,
      activeCarriageId,
      activeTrainId,
      setActiveCarriage,
      pendingIssuePlan,
      setPendingIssuePlan,
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
