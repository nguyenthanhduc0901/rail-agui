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
  type Train,
  type Carriage,
  type Technician,
  type Issue,
} from "../data/railDataSource";

export interface PlanStep {
  id: string;
  issueId: string | null;
  technicianId: string | null;
  technicianName: string;
  order: number;
  title: string;
  details?: string | null;
  estimatedHours?: number;
  status: "pending" | "doing" | "done";
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
  trains: [],
  carriages: {},
  technicians: [],
  issues: [],
  planSteps: [],
  isLoading: true,
  refresh: () => {},
});

export function FleetDataProvider({ children }: { children: React.ReactNode }) {
  const [trains, setTrains] = useState<Train[]>([]);
  const [carriages, setCarriages] = useState<Record<string, Carriage[]>>({});
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([]);
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
        if (data.trains)      setTrains(data.trains);
        if (data.carriages)   setCarriages(data.carriages);
        if (data.technicians) setTechnicians(data.technicians);
        if (data.issues)      setIssues(data.issues);
        if (data.planSteps)   setPlanSteps(data.planSteps);
      }
    } catch {
      // Keep current data on error
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

export function useFleetData(): FleetData {
  return useContext(FleetDataContext);
}

