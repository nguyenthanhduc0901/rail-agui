import generatedData from './rail-data.json';

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

export interface IssuePlanning {
  reportedAt: string;
  scheduledDate: string | null;
  estimatedHours: number;
}

export interface Issue {
  id: string;
  trainId: string;
  carriageId: string;
  systemCategory: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'in-progress' | 'closed';
  assigneeId: string | null;
  planning: IssuePlanning;
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

// Use type assertion since JSON has string types but we validate at runtime
export const technicians  = generatedData.technicians as unknown as Technician[];
export const trains       = generatedData.trains as unknown as Train[];
export const carriages    = generatedData.carriages as unknown as Record<string, Carriage[]>;
export const issues       = generatedData.issues as unknown as Issue[];
export const navLinks: NavLink[] = [{ to: '/rail-dashboard', label: 'Dashboard' }];

const subsystemTemplates = [
  { key: 'brakes',  label: 'Brakes'   },
  { key: 'hvac',    label: 'HVAC'     },
  { key: 'doors',   label: 'Doors'    },
  { key: 'power',   label: 'Power'    },
  { key: 'network', label: 'Network'  },
];

export const getTechnicianById = (id: string | null): Technician | undefined =>
  id ? technicians.find((t) => t.id === id) : undefined;

export const getCarriagesByTrain = (trainId: string): Carriage[] =>
  carriages[trainId] || [];

export const getActiveIssuesByCarriage = (trainId: string, carriageId: string): Issue[] =>
  issues.filter(
    (issue) =>
      issue.trainId === trainId &&
      issue.carriageId === carriageId &&
      issue.status !== 'closed',
  );

export const getCarriageSystems = (trainId: string, carriageId: string): SystemHealth[] => {
  // Extract numeric parts for seed: "C03-T02" → carriage=3, train=2
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
