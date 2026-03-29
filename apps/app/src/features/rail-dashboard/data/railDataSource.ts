import generatedData from './rail-data.json';

interface Train {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  openIssues: number;
  efficiency: number;
}

interface Carriage {
  id: string;
  type: string;
  status: 'healthy' | 'warning' | 'critical';
  issues: number;
}

interface Issue {
  id: string;
  trainId: string;
  carriageId: string;
  system: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'in-progress' | 'closed';
}

interface NavLink {
  label: string;
  to: string;
}

interface SystemHealth {
  id: string;
  name: string;
  health: number;
  trend: Array<{ day: string; value: number }>;
}

export const trains: Train[] = generatedData.trains;
export const carriagesByTrain: Record<string, Carriage[]> = generatedData.carriagesByTrain;
export const issues: Issue[] = generatedData.issues;
export const navLinks: NavLink[] = generatedData.navLinks;

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
