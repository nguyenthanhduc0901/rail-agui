import railData from './rail-data.json'

export const trains = railData.trains
export const carriagesByTrain = railData.carriagesByTrain
export const issues = railData.issues
export const navLinks = railData.navLinks

const baseSystems = [
  { key: 'brakes', label: 'Brakes' },
  { key: 'hvac', label: 'HVAC' },
  { key: 'doors', label: 'Doors' },
  { key: 'power', label: 'Power' },
  { key: 'network', label: 'Network' },
]

export const getCarriageSystems = (trainId, carriageId) => {
  const seed = Number(trainId.replace('T', '')) * 10 + Number(carriageId.replace('C', ''))

  return baseSystems.map((system, index) => {
    const health = Math.max(52, 97 - ((seed + index * 7) % 43))

    return {
      id: `${trainId}-${carriageId}-${system.key}`,
      name: system.label,
      health,
      trend: Array.from({ length: 7 }).map((_, day) => ({
        day: `D${day + 1}`,
        value: Math.max(35, health - 7 + ((seed + day + index * 2) % 12)),
      })),
    }
  })
}

export const getCarriagesByTrain = (trainId) => carriagesByTrain[trainId] || []

export const getActiveIssuesByCarriage = (trainId, carriageId) =>
  issues.filter(
    (issue) => issue.trainId === trainId && issue.carriageId === carriageId && issue.status !== 'closed',
  )
