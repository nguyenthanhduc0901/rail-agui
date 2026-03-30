"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  trains as staticTrains,
  carriages as staticCarriages,
  technicians as staticTechnicians,
  issues as staticIssues,
  type Train,
  type Carriage,
  type Technician,
  type Issue,
} from "../data/railDataSource";

export interface PlanStep {
  id: string;
  planId: string;
  order: number;
  issueId: string | null;
  title: string;
  details?: string | null;
  priority: "high" | "medium" | "low";
  status: "pending" | "in-progress" | "done";
  estimatedHours?: number;
  assigneeId?: string;
  assigneeName?: string;
  createdAt: string;
}

export interface FleetData {
  trains: Train[];
  carriages: Record<string, Carriage[]>;
  technicians: Technician[];
  issues: Issue[];
  planSteps: PlanStep[];
  isLoading: boolean;
  refresh: () => void;
}

const FleetDataContext = createContext<FleetData>({
  trains: staticTrains,
  carriages: staticCarriages,
  technicians: staticTechnicians,
  issues: staticIssues,
  planSteps: [],
  isLoading: false,
  refresh: () => {},
});

export function FleetDataProvider({ children }: { children: React.ReactNode }) {
  const [trains, setTrains] = useState<Train[]>(staticTrains);
  const [carriages, setCarriages] = useState<Record<string, Carriage[]>>(staticCarriages);
  const [technicians, setTechnicians] = useState<Technician[]>(staticTechnicians);
  const [issues, setIssues] = useState<Issue[]>(staticIssues);
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([]);
  // Start as loading so seeding waits for the first API response
  const [isLoading, setIsLoading] = useState(true);
  const isFetching = useRef(false);

  const refresh = useCallback(async () => {
    if (isFetching.current) return;
    isFetching.current = true;
    setIsLoading(true);
    try {
      const res = await fetch("/api/fleet", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.trains) setTrains(data.trains);
        if (data.carriages) setCarriages(data.carriages);
        if (data.technicians) setTechnicians(data.technicians);
        if (data.issues) setIssues(data.issues);
        if (data.planSteps) setPlanSteps(data.planSteps);
      }
    } catch {
      // Keep static fallback data on network/parse error
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <FleetDataContext.Provider
      value={{ trains, carriages, technicians, issues, planSteps, isLoading, refresh }}
    >
      {children}
    </FleetDataContext.Provider>
  );
}

export const useFleetData = () => useContext(FleetDataContext);
