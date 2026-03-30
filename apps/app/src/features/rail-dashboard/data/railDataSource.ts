// Types are populated at runtime from /api/fleet (fleet.db)
// No static JSON import â€” all data comes from the live API

export interface Technician {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  specialty: string;
}

export interface TrainMetrics {
  openIssues: number;
  efficiency: number;
  totalCarriages: number;
  healthyCarriages: number;
}

export interface Train {
  id: string;
  name: string;
  fleetType: string;
  operationalState: 'in-service' | 'maintenance' | 'out-of-service';
  healthStatus: 'healthy' | 'warning' | 'critical';
  currentLocation: string;
  metrics: TrainMetrics;
}

export interface Carriage {
  id: string;
  serialNumber: string;
  sequence: number;
  type: string;
  healthStatus: 'healthy' | 'warning' | 'critical';
  openIssuesCount: number;
}

export interface PlanStep {
  id: string;
  issueId: string;
  technicianId: string | null;
  technicianName: string;
  seqOrder: number;
  title: string;
  estimatedHours: number;
  status: 'pending' | 'doing' | 'done';
}

export interface Issue {
  id: string;
  trainId: string;             // derived via carriages JOIN in API
  carriageId: string;
  systemCategory: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  reportedAt: string;
  scheduledDate: string | null;
  totalEstimatedHours: number;
  planSteps: PlanStep[];
}

export interface NavLink {
  label: string;
  to: string;
}

export interface SystemHealth {
  id: string;
  name: string;
  health: number;
  trend: Array<{ day: string; value: number }>;
}

// Empty defaults â€” real data loads from /api/fleet
export const technicians: Technician[] = [];
export const trains: Train[] = [];
export const carriages: Record<string, Carriage[]> = {};
export const issues: Issue[] = [];
export const navLinks: NavLink[] = [{ to: '/rail-dashboard', label: 'Dashboard' }];

const subsystemTemplates = [
  { key: 'brakes',  label: 'Brakes'   },
  { key: 'hvac',    label: 'HVAC'     },
  { key: 'doors',   label: 'Doors'    },
  { key: 'power',   label: 'Power'    },
  { key: 'network', label: 'Network'  },
];

export const getCarriagesByTrain = (trainId: string, _carriages = carriages): Carriage[] =>
  _carriages[trainId] || [];

export const getActiveIssuesByCarriage = (carriageId: string, _issues = issues): Issue[] =>
  _issues.filter(
    (issue) =>
      issue.carriageId === carriageId &&
      issue.status !== 'closed' &&
      issue.status !== 'resolved',
  );

export const getCarriageSystems = (trainId: string, carriageId: string): SystemHealth[] => {
  const trainNum    = Number(trainId.replace('T', ''))                        || 1;
  const carriageNum = Number(carriageId.replace(/^C(\d+).*/, '$1'))           || 1;
  const seed        = trainNum * 10 + carriageNum;

  return subsystemTemplates.map((system, index) => {
    const health = Math.max(52, 97 - ((seed + index * 7) % 43));
    return {
      id:     `${trainId}-${carriageId}-${system.key}`,
      name:   system.label,
      health,
      trend:  Array.from({ length: 7 }).map((_, day) => ({
        day:   `D${day + 1}`,
        value: Math.max(35, health - 7 + ((seed + day + index * 2) % 12)),
      })),
    };
  });
};

