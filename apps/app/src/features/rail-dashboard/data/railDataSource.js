import generatedData from './rail-data.json';

export const trains = generatedData.trains;
export const carriagesByTrain = generatedData.carriagesByTrain;
export const issues = generatedData.issues;
export const navLinks = generatedData.navLinks;

const subsystemTemplates = [
  { key: 'brakes', label: 'Brakes' },
  { key: 'hvac', label: 'HVAC' },
  { key: 'doors', label: 'Doors' },
  { key: 'power', label: 'Power' },
  { key: 'network', label: 'Network' },
];

export const getCarriagesByTrain = (trainId) => carriagesByTrain[trainId] || [];

export const getActiveIssuesByCarriage = (trainId, carriageId) =>
  issues.filter(
    (issue) =>
      issue.trainId === trainId &&
      issue.carriageId === carriageId &&
      issue.status !== 'closed',
  );

export const getCarriageSystems = (trainId, carriageId) => {
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
