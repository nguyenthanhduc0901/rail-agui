import generatedData from './rail-data.json';

export interface Train {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  openIssues: number;
  efficiency: number;
  healthyCarriages: number;
}

export interface Carriage {
  id: string;
  type: string;
  status: 'healthy' | 'warning' | 'critical';
  issues: number;
}

export interface Assignee {
  name: string;
  initials: string;
  color: string;
}

export interface Issue {
  id: string;
  trainId: string;
  carriageId: string;
  system: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'in-progress' | 'closed';
  assignee?: Assignee;
  date?: string;
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
export const trains = generatedData.trains as unknown as Train[];
export const carriagesByTrain = generatedData.carriagesByTrain as unknown as Record<string, Carriage[]>;
export const issues = generatedData.issues as unknown as Issue[];
export const navLinks = generatedData.navLinks as NavLink[];

const subsystemTemplates = [
  { key: 'brakes', label: 'Brakes' },
  { key: 'hvac', label: 'HVAC' },
  { key: 'doors', label: 'Doors' },
  { key: 'power', label: 'Power' },
  { key: 'network', label: 'Network' },
];

export const getCarriagesByTrain = (trainId: string): Carriage[] => 
  carriagesByTrain[trainId] || [];

export const getActiveIssuesByCarriage = (trainId: string, carriageId: string): Issue[] =>
  issues.filter(
    (issue) =>
      issue.trainId === trainId &&
      issue.carriageId === carriageId &&
      issue.status !== 'closed',
  );

export const getCarriageSystems = (trainId: string, carriageId: string): SystemHealth[] => {
  const seed = Number(trainId.replace('T', '')) * 10 + Number(carriageId.replace('C', ''));

  return subsystemTemplates.map((system, index) => {
    const health = Math.max(52, 97 - ((seed + index * 7) % 43));

    return {
      id: `${trainId}-${carriageId}-${system.key}`,
      name: system.label,
      health,
      trend: Array.from({ length: 7 }).map((_, day) => ({
        day: `D${day + 1}`,
        value: Math.max(35, health - 7 + ((seed + day + index * 2) % 12)),
      })),
    };
  });
};
