import { Fragment, useMemo, useState } from 'react'
import { getCarriagesByTrain, type Train, type Carriage } from '../data/railDataSource'
import { useFleetData } from '../context/fleet-data-context'
import { CarriageDetailsModal } from '../components/CarriageDetailsModal'
import { MaintenancePlanBoard } from '../components/MaintenancePlanBoard'
import { useRailDashboardAI } from '../context/rail-dashboard-ai-context'

type StatusKey = 'healthy' | 'warning' | 'critical'

const statusConfig: Record<StatusKey, { dot: string; text: string; progress: string; label: string; bodyClass: string }> = {
  healthy:  { dot: 'bg-emerald-400 animate-pulse', text: 'text-emerald-600', progress: 'bg-emerald-500', label: 'Healthy',  bodyClass: 'train-car-healthy' },
  warning:  { dot: 'bg-amber-400 animate-pulse',   text: 'text-amber-500',   progress: 'bg-amber-500',   label: 'Warning',  bodyClass: 'train-car-warning' },
  critical: { dot: 'status-dot-danger',             text: 'text-red-500',     progress: 'bg-red-500',     label: 'Critical', bodyClass: 'train-car-critical' },
}
  
const TrainBogie = ({ className }: { className?: string }) => (
  <div className={`absolute -bottom-3 flex gap-1 bg-slate-600 p-1.5 rounded-full z-10 shadow-sm ${className}`}>
    <div className="w-4 h-4 rounded-full bg-slate-200 border-[3px] border-slate-600" />
    <div className="w-4 h-4 rounded-full bg-slate-200 border-[3px] border-slate-600" />
  </div>
)

const CarriageWindow = () => (
  <div className="train-window-glass flex-1 h-8 border border-slate-700/60 shadow-inner" />
)

export function FleetDashboard() {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTrain, setSelectedTrain] = useState<Train | null>(null)
  const [selectedCarriage, setSelectedCarriage] = useState<Carriage | null>(null)
  const { trains, issues, carriages } = useFleetData()
  const {
    filters,
    updateFilters,
    clearFilters,
  } = useRailDashboardAI()

  const systemOptions = useMemo(() => {
    return ['all', ...new Set(issues.map((issue) => issue.systemCategory))]
  }, [issues])

  const filteredTrains = useMemo(() => {
    return trains.filter((train) => {
      if (filters.trainId !== 'all' && train.id !== filters.trainId) {
        return false
      }

      const trainIssues = issues.filter((issue) => issue.trainId === train.id)

      if (filters.system !== 'all' && !trainIssues.some((issue) => issue.systemCategory === filters.system)) {
        return false
      }

      if (filters.priority !== 'all' && !trainIssues.some((issue) => issue.priority === filters.priority)) {
        return false
      }

      if (filters.status !== 'all' && !trainIssues.some((issue) => issue.status === filters.status)) {
        return false
      }

      return true
    })
  }, [trains, issues, filters.priority, filters.status, filters.system, filters.trainId])

  const openIssuesInFilteredScope = useMemo(() => {
    return issues.filter((issue) => {
      if (!filteredTrains.some((train) => train.id === issue.trainId)) {
        return false
      }

      if (filters.system !== 'all' && issue.systemCategory !== filters.system) return false
      if (filters.priority !== 'all' && issue.priority !== filters.priority) return false
      if (filters.status !== 'all' && issue.status !== filters.status) return false

      return issue.status === 'open'
    }).length
  }, [issues, filteredTrains, filters.priority, filters.status, filters.system])

  const openModal = (train: Train, carriage: Carriage) => {
    setSelectedTrain(train)
    setSelectedCarriage(carriage)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setSelectedTrain(null)
    setSelectedCarriage(null)
  }

  return (
    <section className="space-y-12 pb-12">
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Live Train Fleet</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              AI filter scope: {filteredTrains.length} trains, {openIssuesInFilteredScope} open issues.
            </p>
          </div>

          <button
            onClick={clearFilters}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Clear Filters
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Train
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              value={filters.trainId}
              onChange={(e) => updateFilters({ trainId: e.target.value })}
            >
              <option value="all">All Trains</option>
              {trains.map((train) => (
                <option key={train.id} value={train.id}>{train.id}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            System
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              value={filters.system}
              onChange={(e) => updateFilters({ system: e.target.value })}
            >
              {systemOptions.map((system) => (
                <option key={system} value={system}>{system}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Priority
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              value={filters.priority}
              onChange={(e) => updateFilters({ priority: e.target.value })}
            >
              <option value="all">all</option>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </label>

          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Status
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              value={filters.status}
              onChange={(e) => updateFilters({ status: e.target.value })}
            >
              <option value="all">all</option>
              <option value="open">open</option>
              <option value="in-progress">in-progress</option>
              <option value="closed">closed</option>
            </select>
          </label>
        </div>

      </div>

      <div className="space-y-16">
        {filteredTrains.map((train) => {
          const config = statusConfig[train.healthStatus]
          const carriageList = getCarriagesByTrain(train.id, carriages)
          const headCarriage = carriageList[0]
          const remainingCarriages = carriageList.slice(1)
          const headCarriageConfig = headCarriage ? statusConfig[headCarriage.healthStatus] : config

          return (
            <div key={train.id} className="relative rounded-2xl bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_15px_35px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200 dark:bg-slate-900">
              
              <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${config.dot}`} />
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{train.name} <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">(ID: {train.id})</span></h3>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider dark:text-slate-400">Efficiency</p>
                    <p className={`font-bold text-lg ${train.metrics.efficiency >= 80 ? 'text-emerald-600' : train.metrics.efficiency >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{train.metrics.efficiency}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider dark:text-slate-400">Issues</p>
                    <p className={`font-bold text-lg ${train.healthStatus === 'critical' ? 'issue-count-danger' : config.text}`}>{train.metrics.openIssues}</p>
                  </div>

                </div>
              </div>

              <div className="relative pt-4">
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                  <div className="flex items-end gap-0 relative w-max min-w-full px-4 pb-[20px] pt-2">
                    
                    <div className="absolute bottom-0 left-0 right-0 z-0 flex flex-col pointer-events-none h-[16px]">
                      <div className="w-full h-[4px] bg-slate-400 border-b border-slate-500 shadow-sm" />
                      <div 
                        className="w-full h-[6px] mt-[1px]"
                        style={{
                          backgroundImage: 'repeating-linear-gradient(90deg, #475569 0px, #475569 10px, transparent 10px, transparent 22px)'
                        }}
                      />
                      <div className="w-full h-[4px] bg-slate-200/80 rounded-full mt-[1px]" />
                    </div>

<div
  className="relative flex-shrink-0 h-40 w-64 group cursor-pointer transition-transform hover:-translate-y-1 z-10 block"
  onClick={() => headCarriage && openModal(train, headCarriage)}
>
  
  <div className={`absolute inset-0 border-2 ${headCarriageConfig.bodyClass} rounded-tl-[100px] rounded-bl-2xl rounded-r-lg overflow-hidden shadow-md flex flex-col`}>
    
    <div className="absolute top-2 left-7 w-24 h-14 bg-slate-800/90 rounded-tl-[80px] rounded-tr-md rounded-bl-lg border-r-2 border-b-2 border-slate-700/50 shadow-inner flex items-center justify-center">
      <div className="absolute top-2 right-4 w-8 h-1 bg-white/20 rounded-full rotate-[-10deg]" />
    </div>

    <div className="absolute bottom-6 left-6 flex gap-3">
      <div className="w-4 h-2 bg-amber-200 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
      <div className="w-4 h-2 bg-amber-200 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
    </div>

    <div className="absolute top-20 left-12 right-0 h-1 bg-white/30" />
    <div className="absolute top-[88px] left-20 right-0 h-1 bg-white/20" />

    <div className="absolute left-0 right-0 top-16 px-5 pointer-events-none">
      <div className="flex justify-between items-end mb-2">
        <span className="text-[10px] font-bold text-slate-700 bg-white/50 px-1.5 py-0.5 rounded">
          {headCarriage?.type ?? 'Head'}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[9px] text-slate-600">
          <span>Issues</span>
          <span className="font-bold">{headCarriage?.openIssuesCount ?? 0}</span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${headCarriageConfig.progress} rounded-full`}
            style={{ width: `${Math.min((headCarriage?.openIssuesCount ?? 0) * 20, 100)}%` }}
          />
        </div>
      </div>
    </div>

    <div className="flex-1" />
    
    <div className="h-3 w-full bg-slate-500 border-t border-slate-400" />
  </div>

  <div className="absolute -top-6 left-1/2 w-12 h-8 pointer-events-none">
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-slate-600" />
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-6 bg-slate-500 origin-bottom rotate-[30deg]" />
    <div className="absolute bottom-5 left-[60%] w-6 h-1 bg-slate-400 -rotate-[60deg]" />
    <div className="absolute top-0 left-[35%] w-8 h-0.5 bg-slate-700 shadow-sm" />
  </div>
  
  <TrainBogie className="left-[25%]" />
  <TrainBogie className="right-[15%]" />
</div>

                    {remainingCarriages.map((carriage: Carriage, index: number) => {
                      const carriageConfig = statusConfig[carriage.healthStatus]
                      const isLast = index === remainingCarriages.length - 1
                      const shapeClasses = isLast ? "rounded-r-[3rem] rounded-l-lg" : "rounded-lg"

                      return (
                        <Fragment key={carriage.id}>
                          <div className="w-4 h-3 bg-slate-600 mb-6 flex-shrink-0 border-y border-slate-500 shadow-sm z-0" />

                          <div 
                            className="relative flex-shrink-0 h-40 w-44 cursor-pointer transition-transform hover:-translate-y-1 group z-10 block"
                            onClick={() => openModal(train, carriage)}
                          >
                            
                            <div className={`absolute inset-0 border-2 ${carriageConfig.bodyClass} ${shapeClasses} overflow-hidden shadow-md flex flex-col`}>
                              <div className="absolute top-6 left-0 right-0 px-4 flex gap-2">
                                <CarriageWindow />
                                <CarriageWindow />
                                {!isLast && <CarriageWindow />}
                              </div>
                              <div className="absolute left-0 right-0 bottom-10 px-4 pointer-events-none">
                                <div className="flex justify-between items-end mb-2">
                                  <span className="text-[10px] font-bold text-slate-700 bg-white/50 px-1.5 py-0.5 rounded">{carriage.type}</span>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex justify-between items-center text-[9px] text-slate-600">
                                    <span>Issues</span>
                                    <span className="font-bold">{carriage.openIssuesCount}</span>
                                  </div>
                                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div className={`h-full ${carriageConfig.progress} rounded-full`} style={{ width: `${Math.min(carriage.openIssuesCount * 20, 100)}%` }} />
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex-1" />

                              <div className="h-3 w-full bg-slate-500 border-t border-slate-400" />
                            </div>
                            
                            <TrainBogie className="left-[15%]" />
                            <TrainBogie className="right-[15%]" />
                          </div>
                        </Fragment>
                      )
                    })}
                  </div>
                </div>

              </div>
            </div>
          )
        })}

        {filteredTrains.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            No trains match current AI filters.
          </div>
        )}
      </div>

      {/* ── Maintenance Plan Board (shown when AI generates a plan) ─────── */}
      <MaintenancePlanBoard />

      <CarriageDetailsModal 
        isOpen={modalOpen}
        onClose={closeModal}
        train={selectedTrain}
        carriage={selectedCarriage}
      />
    </section>
  )
}