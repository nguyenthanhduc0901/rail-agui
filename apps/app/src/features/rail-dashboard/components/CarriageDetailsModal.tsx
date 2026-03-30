"use client";

import { Fragment, useState, useMemo, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getCarriageSystems, getActiveIssuesByCarriage, getTechnicianById, getCarriagesByTrain, getAllTechnicians, type SystemHealth, type Carriage, type Train, type Technician } from '../data/railDataSource';

interface HealthStatus {
  color: string;
  bg: string;
  glow: string;
  label: string;
  border: string;
  lightBg: string;
}

const getHealthStatus = (health: number): HealthStatus => {
  if (health >= 85) return {
    color: 'text-emerald-600', bg: 'bg-emerald-500',
    glow: 'shadow-[0_0_14px_rgba(16,185,129,0.45)]', label: 'Healthy',
    border: 'border-emerald-500/30', lightBg: 'bg-emerald-50',
  };
  if (health >= 70) return {
    color: 'text-amber-600', bg: 'bg-amber-500',
    glow: 'shadow-[0_0_14px_rgba(245,158,11,0.45)]', label: 'Warning',
    border: 'border-amber-500/30', lightBg: 'bg-amber-50',
  };
  return {
    color: 'text-red-600', bg: 'bg-red-500',
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.65)]', label: 'Critical',
    border: 'border-red-500/30', lightBg: 'bg-red-50',
  };
};

const getPriorityStyle = (priority: string): string => ({
  high:   'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  low:    'bg-blue-100 text-blue-700 dark:bg-sky-950/40 dark:text-sky-400',
}[priority] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400');

const PRIORITY_LEVEL: Record<string, number> = { high: 3, medium: 2, low: 1 };

const SYSTEM_OPTIONS = [
  { value: 'All',     label: 'All Systems' },
  { value: 'HVAC',    label: 'HVAC' },
  { value: 'Brakes',  label: 'Brakes' },
  { value: 'Doors',   label: 'Doors' },
  { value: 'Power',   label: 'Power' },
  { value: 'Network', label: 'Network' },
];

const PRIORITY_OPTIONS = [
  { value: 'All',    label: 'All Priorities' },
  { value: 'High',   label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low',    label: 'Low' },
];

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Newest First' },
  { value: 'date-asc',  label: 'Oldest First' },
  { value: 'priority',  label: 'Priority (High-Low)' },
];

// ─── SUB-COMPONENTS ────────────────────────────────────────────────────────────

function SystemTooltip({ system, hasIssues, status }: { system: SystemHealth; hasIssues: boolean; status: HealthStatus }): ReactNode {
  return (
    <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-52 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-3 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 transform group-hover:-translate-y-1">
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{system.name}</span>
        {hasIssues && (
          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">
            Issue
          </span>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Health Status</span>
          <span className={`font-bold ${status.color}`}>{system.health}%</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full ${status.bg}`} style={{ width: `${system.health}%` }} />
        </div>
      </div>
    </div>
  );
}

function PingRings({ status, rounded = 'rounded-full' }: { status: HealthStatus; rounded?: string }): ReactNode {
  return (
    <>
      <span className={`absolute -inset-2 ${status.bg} opacity-20 ${rounded}`} />
      <span className={`absolute -inset-4 ${status.bg} opacity-10 ${rounded} animate-breathe`} />
    </>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }): ReactNode {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{label}</label>
      <select
        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-700 dark:text-slate-100 outline-none focus:border-blue-400 dark:focus:border-sky-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-sky-900/40 transition-all cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt: { value: string; label: string }) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function AssigneeAvatar({ technician }: { technician?: Technician }): ReactNode {
  if (technician) {
    return (
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${technician.avatarColor} shadow-sm border-2 border-white dark:border-slate-800 cursor-help shrink-0`}
        title={`Assigned to ${technician.name} (${technician.specialty})`}
      >
        {technician.initials}
      </div>
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700 border-dashed cursor-help shrink-0"
      title="Unassigned"
    >
      ?
    </div>
  );
}

// ─── SYSTEM BLUEPRINT RENDERING ────────────────────────────────────────────────

function renderSystemUI(system: SystemHealth, hasIssues: boolean, status: HealthStatus): ReactNode {
  switch (system.name) {
    case 'HVAC':
      return (
        <div className="absolute top-[-14px] left-[25%] group cursor-pointer">
          <SystemTooltip system={system} hasIssues={hasIssues} status={status} />
          <div className="relative">
            {hasIssues && <PingRings status={status} />}
            <div className={`w-20 h-4 bg-slate-200 border-2 border-b-0 ${status.border} rounded-t-md flex items-center justify-evenly px-1 relative z-10 overflow-hidden`}>
              <div className="w-4 h-full bg-slate-300 border-x border-slate-400 opacity-50 flex items-center justify-center">
                <div className={`w-2 h-2 rounded-full ${status.bg} ${status.glow}`} />
              </div>
              <div className="w-10 flex gap-0.5">
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="flex-1 h-3 bg-slate-800 rounded-sm" />)}
              </div>
            </div>
          </div>
        </div>
      );

    case 'Network':
      return (
        <div className="absolute top-[-20px] right-[25%] group cursor-pointer">
          <SystemTooltip system={system} hasIssues={hasIssues} status={status} />
          <div className="relative flex flex-col items-center">
            {hasIssues && <PingRings status={status} />}
            <div className={`w-6 h-3 border-t-2 border-slate-400 rounded-t-full mb-0.5 ${hasIssues ? 'border-red-400' : ''}`} />
            <div className={`w-4 h-2 border-t-2 border-slate-400 rounded-t-full mb-0.5 ${hasIssues ? 'border-red-400' : ''}`} />
            <div className={`w-6 h-3 bg-slate-200 border-2 border-b-0 ${status.border} rounded-t-full flex justify-center items-end pb-0.5 relative z-10`}>
              <div className={`w-1.5 h-1.5 rounded-full ${status.bg} ${status.glow}`} />
            </div>
          </div>
        </div>
      );

    case 'Doors':
      return (
        <div className="absolute top-[10%] left-[58%] -translate-x-1/2 w-[100px] h-[80%] group cursor-pointer">
          <SystemTooltip system={system} hasIssues={hasIssues} status={status} />
          <div className="relative w-full h-full">
            {hasIssues && (
              <>
                <span className={`absolute -inset-2 ${status.bg} opacity-10 rounded-md`} />
                <span className={`absolute -inset-4 ${status.bg} rounded-md animate-breathe`} />
              </>
            )}
            <div className={`w-full h-full border-2 ${status.border} bg-slate-100 rounded-sm flex relative z-10`}>
              <div className="flex-1 border-r border-slate-300 flex flex-col items-center pt-2 gap-1">
                <div className="w-5 h-12 bg-slate-800 rounded-sm shadow-inner" />
              </div>
              <div className="flex-1 border-l border-slate-300 flex flex-col items-center pt-2 gap-1">
                <div className="w-5 h-12 bg-slate-800 rounded-sm shadow-inner" />
              </div>
            </div>
            <div className={`absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-1.5 rounded-full ${status.bg} ${status.glow} z-20`} />
          </div>
        </div>
      );

    case 'Power':
      return (
        <div className="absolute bottom-[-17px] right-[32%] group cursor-pointer">
          <SystemTooltip system={system} hasIssues={hasIssues} status={status} />
          <div className="relative">
            {hasIssues && <PingRings status={status} />}
            <div className={`w-16 h-5 bg-slate-700 border-2 ${status.border} rounded-b-md flex items-center justify-between px-1 relative z-10`}>
              <div className="w-3 h-2 bg-slate-600 border border-slate-500 rounded-sm" />
              <div className="w-3 h-2 bg-slate-600 border border-slate-500 rounded-sm" />
              <div className={`w-2 h-2 rounded-full ${status.bg} ${status.glow}`} />
            </div>
          </div>
        </div>
      );

    case 'Brakes':
      return (
        <div className="absolute bottom-[-24px] left-[20%] group cursor-pointer z-30">
          <SystemTooltip system={system} hasIssues={hasIssues} status={status} />
          <div className="relative flex gap-4">
            {hasIssues && <PingRings status={status} />}
            <div className="relative z-10">
              <div className={`absolute -top-1 -right-1 w-3 h-3 ${status.bg} border border-white rounded-sm z-20 ${status.glow} rotate-45`} />
              <div className="w-10 h-10 rounded-full border-[3px] border-slate-600 bg-slate-300 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border border-slate-400 bg-slate-200" />
              </div>
            </div>
            <div className="relative z-10">
              <div className={`absolute -top-1 -left-1 w-3 h-3 ${status.bg} border border-white rounded-sm z-20 ${status.glow} -rotate-45`} />
              <div className="w-10 h-10 rounded-full border-[3px] border-slate-600 bg-slate-300 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border border-slate-400 bg-slate-200" />
              </div>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────

interface CarriageDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  train: Train | null;
  carriage: Carriage | null;
}

export function CarriageDetailsModal({ isOpen, onClose, train, carriage }: CarriageDetailsModalProps): ReactNode {
  const [filterSystem,   setFilterSystem]   = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterAssignee, setFilterAssignee] = useState('All');
  const [sortBy,         setSortBy]         = useState('date-desc');

  const [selectedIssueId,  setSelectedIssueId]  = useState<string | null>(null);
  const [planText,         setPlanText]         = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSelectedIssueId(null);
      setFilterSystem('All');
      setFilterPriority('All');
      setFilterAssignee('All');
    }
  }, [isOpen]);

  const systems = useMemo(
    () => (train && carriage ? getCarriageSystems(train.id, carriage.id) : []),
    [train, carriage],
  );

  const rawIssues = useMemo(
    () => (train && carriage ? getActiveIssuesByCarriage(train.id, carriage.id) : []),
    [train, carriage],
  );

  const assigneeOptions = useMemo(() => {
    const names = rawIssues
      .map(i => getTechnicianById(i.assigneeId)?.name)
      .filter((n): n is string => Boolean(n));
    return ['All', 'Unassigned', ...new Set(names)].map(a => ({ value: a, label: a }));
  }, [rawIssues]);

  const filteredIssues = useMemo(() => {
    let result = [...rawIssues];
    if (filterSystem !== 'All')   result = result.filter(i => i.systemCategory === filterSystem);
    if (filterPriority !== 'All') result = result.filter(i => i.priority === filterPriority.toLowerCase());
    if (filterAssignee !== 'All') {
      result = filterAssignee === 'Unassigned'
        ? result.filter(i => !i.assigneeId)
        : result.filter(i => getTechnicianById(i.assigneeId)?.name === filterAssignee);
    }
    return result.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.planning.reportedAt).getTime() - new Date(a.planning.reportedAt).getTime();
      if (sortBy === 'date-asc')  return new Date(a.planning.reportedAt).getTime() - new Date(b.planning.reportedAt).getTime();
      if (sortBy === 'priority')  return PRIORITY_LEVEL[b.priority] - PRIORITY_LEVEL[a.priority];
      return 0;
    });
  }, [rawIssues, filterSystem, filterPriority, filterAssignee, sortBy]);

  const selectedIssue = useMemo(
    () => rawIssues.find(i => i.id === selectedIssueId),
    [rawIssues, selectedIssueId],
  );

  useEffect(() => {
    if (selectedIssue) {
      setPlanText(selectedIssue.description || '');
      setSelectedAssignee(selectedIssue.assigneeId || '');
    }
  }, [selectedIssue]);

  if (!isOpen || !carriage) return null;

  const allTechnicians = getAllTechnicians();
  const portalRoot = typeof document !== 'undefined' ? document.getElementById('app-modal-portal') : null;

  const modalContent = (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-800/40 backdrop-blur-md" onClick={onClose} />

      <div className="relative bg-white dark:bg-slate-900 w-full max-w-7xl h-[88vh] rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.50)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-black/5 dark:border-slate-800">

        {/* Header */}
        <div className="bg-white dark:bg-slate-900 px-8 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center z-10 shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
              <span className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm shadow-sm">{carriage.id}</span>
              {carriage.type} Carriage Diagnostics
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Train: <span className="font-semibold text-slate-700 dark:text-slate-200">{train?.name}</span> (ID: {train?.id})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors border border-slate-200 dark:border-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 overflow-hidden bg-slate-50/50 dark:bg-slate-950">

          {/* TOP: Carriage Blueprint */}
          <div className={`h-[40%] min-h-[220px] relative overflow-hidden flex items-center justify-center p-6 border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-sm z-20 ${
            carriage.healthStatus === 'critical' ? 'bg-red-50/70 dark:bg-red-950/20' :
            carriage.healthStatus === 'warning'  ? 'bg-amber-50/70 dark:bg-amber-950/20' :
            'bg-white dark:bg-slate-900'
          }`}>
            <div
              className="absolute inset-0 opacity-[0.4]"
              style={{ backgroundImage: 'linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}
            />
            <div className="absolute top-4 left-6 flex items-center gap-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm z-20">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
              </span>
              <span className="text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-wider">Live Schema</span>
            </div>

            {(() => {
              const allCarriages = train ? getCarriagesByTrain(train.id) : [];
              const isHead = allCarriages.length > 0 && allCarriages[0].id === carriage.id;
              const isLast = allCarriages.length > 1 && allCarriages[allCarriages.length - 1].id === carriage.id;
              const shapeClasses = isHead
                ? 'rounded-tl-[80px] rounded-bl-3xl rounded-r-2xl'
                : isLast
                  ? 'rounded-r-[80px] rounded-l-2xl'
                  : 'rounded-2xl';
              return (
                <div className={`relative h-full aspect-[2.5/1] max-w-4xl max-h-56 bg-gradient-to-b from-slate-50 to-slate-200 border-2 border-slate-300 shadow-xl flex flex-col justify-between z-10 transition-all duration-300 ${shapeClasses}`}>
                  <div className="absolute top-[60%] left-0 right-0 h-2 bg-blue-600 opacity-80" />
                  <div className={`flex justify-between pt-8 gap-5 absolute inset-x-0 ${isHead ? 'pl-6 pr-8' : isLast ? 'pl-8 pr-6' : 'px-8'}`}>
                    {isHead && (
                      <div className="w-28 h-12 bg-slate-800 rounded-tl-[60px] rounded-tr-md rounded-bl-lg border-2 border-slate-400 shadow-inner relative overflow-hidden shrink-0">
                        <div className="absolute top-0 right-4 w-12 h-full bg-white/10 skew-x-12" />
                      </div>
                    )}
                    {[1, 2].map(i => (
                      <div key={i} className="h-12 flex-1 bg-slate-800 rounded-lg border-2 border-slate-400 shadow-inner relative overflow-hidden">
                        <div className="absolute top-0 right-2 w-16 h-full bg-white/10 skew-x-12" />
                      </div>
                    ))}
                    <div className="w-[60px] shrink-0" />
                    {[3, 4].map(i => (
                      <div key={i} className="h-12 flex-1 bg-slate-800 rounded-lg border-2 border-slate-400 shadow-inner relative overflow-hidden">
                        <div className="absolute top-0 right-2 w-16 h-full bg-white/10 skew-x-12" />
                      </div>
                    ))}
                    {isLast && (
                      <div className="w-28 h-12 bg-slate-800 rounded-tr-[60px] rounded-tl-md rounded-br-lg border-2 border-slate-400 shadow-inner relative overflow-hidden shrink-0">
                        <div className="absolute top-0 right-4 w-12 h-full bg-white/10 skew-x-12" />
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-[-18px] left-[15%] flex gap-3 z-0">
                    {[0, 1].map(i => (
                      <div key={`wheel-l-${i}`} className="w-9 h-9 rounded-full border-[3px] border-slate-600 bg-slate-300 flex items-center justify-center shadow-md">
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-400 bg-slate-200" />
                      </div>
                    ))}
                  </div>
                  <div className="absolute bottom-[-18px] right-[15%] flex gap-3 z-0">
                    {[0, 1].map(i => (
                      <div key={`wheel-r-${i}`} className="w-9 h-9 rounded-full border-[3px] border-slate-600 bg-slate-300 flex items-center justify-center shadow-md">
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-400 bg-slate-200" />
                      </div>
                    ))}
                  </div>
                  {systems.map(system => {
                    const status    = getHealthStatus(system.health);
                    const hasIssues = rawIssues.some(i => i.systemCategory === system.name);
                    return (
                      <Fragment key={system.id}>
                        {renderSystemUI(system, hasIssues, status)}
                      </Fragment>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* BOTTOM: Issues list + Detail pane */}
          <div className="flex-1 flex overflow-hidden z-10">

            {/* LEFT: Issues list */}
            <div className="w-[45%] flex flex-col border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80">
              <div className="bg-white dark:bg-slate-900 px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-sm z-10">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    Reported Issues
                    <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs font-bold">
                      {filteredIssues.length}
                    </span>
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <FilterSelect label="System"   value={filterSystem}   onChange={setFilterSystem}   options={SYSTEM_OPTIONS} />
                  <FilterSelect label="Priority" value={filterPriority} onChange={setFilterPriority} options={PRIORITY_OPTIONS} />
                  <FilterSelect label="Assignee" value={filterAssignee} onChange={setFilterAssignee} options={assigneeOptions} />
                  <FilterSelect label="Sort by"  value={sortBy}         onChange={setSortBy}         options={SORT_OPTIONS} />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 rail-scrollbar">
                {filteredIssues.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-3">
                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="font-medium text-slate-500 dark:text-slate-400">No active issues found.</p>
                  </div>
                ) : (
                  filteredIssues.map(issue => {
                    const isSelected = selectedIssueId === issue.id;
                    return (
                      <div
                        key={issue.id}
                        onClick={() => setSelectedIssueId(issue.id)}
                        className={`cursor-pointer p-4 rounded-2xl transition-all duration-200 group border ${
                          isSelected
                            ? 'bg-blue-50/50 dark:bg-sky-900/20 border-blue-200 dark:border-sky-800 shadow-md ring-1 ring-blue-500/20 dark:ring-sky-500/30'
                            : 'bg-white dark:bg-slate-900 border-transparent shadow-[0_2px_4px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2.5">
                          <div className="flex gap-2 items-center">
                            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${isSelected ? 'text-blue-700 bg-blue-100 dark:text-sky-300 dark:bg-sky-900/50' : 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800'}`}>
                              {issue.id}
                            </span>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${getPriorityStyle(issue.priority)}`}>
                              {issue.priority}
                            </span>
                          </div>
                          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{new Date(issue.planning.reportedAt).toLocaleDateString()}</span>
                        </div>
                        <h4 className={`font-semibold text-sm mb-1.5 line-clamp-1 transition-colors ${isSelected ? 'text-blue-700 dark:text-sky-400' : 'text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-sky-400'}`}>
                          {issue.title ?? issue.description}
                        </h4>
                        <div className="flex items-center gap-2 text-xs font-medium mt-3">
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-md">
                            {issue.systemCategory}
                          </span>
                          <span className={`px-2 py-1 rounded-full capitalize font-semibold ${
                            issue.status === 'open'        ? 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' :
                            issue.status === 'in-progress' ? 'text-blue-600 bg-blue-100 dark:bg-sky-900/30 dark:text-sky-400' :
                                                             'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {issue.status.replace('-', ' ')}
                          </span>
                          <div className="flex-1" />
                          <AssigneeAvatar technician={getTechnicianById(issue.assigneeId)} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT: Detail / Planning pane */}
            <div className="w-[55%] bg-white dark:bg-slate-900 flex flex-col z-10">
              {selectedIssue ? (
                <div className="flex flex-col h-full animate-in slide-in-from-right-2 duration-300">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-mono font-bold text-blue-700 bg-blue-50 dark:bg-sky-900/40 dark:text-sky-300 px-2.5 py-1 rounded-md border border-blue-100 dark:border-sky-800">
                        {selectedIssue.id}
                      </span>
                      <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${getPriorityStyle(selectedIssue.priority)}`}>
                        {selectedIssue.priority} PRIORITY
                      </span>
                      <div className="flex-1" />
                      <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                        {selectedIssue.systemCategory} System
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-snug">
                      {selectedIssue.title ?? selectedIssue.description}
                    </h3>
                  </div>

                  <div className="flex-1 p-6 overflow-y-auto space-y-6 rail-scrollbar">
                    <div>
                      <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">Initial Diagnostics Description</label>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-700/50">
                        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                          {selectedIssue.description}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          Action Plan / Repair Notes
                        </label>
                        <textarea
                          value={planText}
                          onChange={(e) => setPlanText(e.target.value)}
                          placeholder="Detail the steps for resolution..."
                          className="w-full h-32 p-3.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-sm text-slate-700 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          Assign Technician
                        </label>
                        <select
                          value={selectedAssignee}
                          onChange={(e) => setSelectedAssignee(e.target.value)}
                          className="w-full p-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm text-slate-700 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
                        >
                          <option value="">Unassigned</option>
                          {allTechnicians.map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.specialty})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          Target Date
                        </label>
                        <input
                          type="date"
                          defaultValue={selectedIssue.planning.scheduledDate ?? ''}
                          className="w-full p-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm text-slate-700 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                    <button
                      onClick={() => setSelectedIssueId(null)}
                      className="px-4 py-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      Clear Selection
                    </button>
                    <button className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-[0.98]">
                      Save Repair Plan
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/30 dark:bg-slate-900/30">
                  <div className="w-20 h-20 mb-6 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 border-dashed flex items-center justify-center">
                    <svg className="w-10 h-10 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">Issue Diagnostic Planner</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                    Select an issue from the reported list on the left to review its details, assign a technician, and construct a repair action plan.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return portalRoot ? createPortal(modalContent, portalRoot) : modalContent;
}
