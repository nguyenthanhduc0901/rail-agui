"use client";

import { Fragment, useState, useMemo, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getCarriageSystems, getActiveIssuesByCarriage, getTechnicianById, getCarriagesByTrain, type SystemHealth, type Carriage, type Train, type Technician } from '../data/railDataSource';

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
  high:   'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-blue-100 text-blue-700',
}[priority] ?? 'bg-slate-100 text-slate-700');

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
        className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${technician.avatarColor} shadow-sm border-2 border-white cursor-help`}
        title={`Assigned to ${technician.name} (${technician.specialty})`}
      >
        {technician.initials}
      </div>
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700 border-dashed cursor-help"
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

  if (!isOpen || !carriage) return null;

  const portalRoot = typeof document !== 'undefined' ? document.getElementById('app-modal-portal') : null;

  const modalContent = (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-800/40 backdrop-blur-md" onClick={onClose} />

      <div className="relative bg-white dark:bg-slate-900 w-full max-w-7xl h-[85vh] rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.50)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-black/5 dark:border-slate-800">

        {/* Header */}
        <div className="bg-white dark:bg-slate-900 px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center z-10 shrink-0">
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
        <div className="flex flex-1 overflow-hidden bg-slate-50/50 dark:bg-slate-950">

          {/* LEFT: Carriage Blueprint */}
          <div className={`w-[55%] relative overflow-hidden flex items-center justify-center p-8 border-r border-slate-200 dark:border-slate-800 ${
            carriage.healthStatus === 'critical' ? 'bg-red-50/70 dark:bg-red-950/20' :
            carriage.healthStatus === 'warning'  ? 'bg-amber-50/70 dark:bg-amber-950/20' :
            'bg-white dark:bg-slate-900'
          }`}>
            <div
              className="absolute inset-0 opacity-[0.4]"
              style={{ backgroundImage: 'linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}
            />
            <div className="absolute top-6 left-6 flex items-center gap-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm z-20">
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
                ? 'rounded-tl-[100px] rounded-bl-3xl rounded-r-2xl'
                : isLast
                  ? 'rounded-r-[100px] rounded-l-2xl'
                  : 'rounded-2xl';

              return (
                <div className={`relative w-full max-w-2xl aspect-[2/1] bg-gradient-to-b from-slate-50 to-slate-200 border-2 border-slate-300 shadow-xl flex flex-col justify-between z-10 transition-all duration-300 ${shapeClasses}`}>
                  <div className="absolute top-[60%] left-0 right-0 h-2 bg-blue-600 opacity-80" />

                  {/* Windows */}
                  <div className={`flex justify-between pt-12 gap-5 absolute inset-x-0 ${isHead ? 'pl-6 pr-10' : isLast ? 'pl-10 pr-6' : 'px-10'}`}>

                    {/* Cab glass — Head */}
                    {isHead && (
                      <div className="w-32 h-14 bg-slate-800 rounded-tl-[60px] rounded-tr-md rounded-bl-lg border-2 border-slate-400 shadow-inner relative overflow-hidden shrink-0">
                        <div className="absolute top-0 right-4 w-12 h-full bg-white/10 skew-x-12" />
                      </div>
                    )}

                    {[1, 2].map(i => (
                      <div key={i} className="h-14 flex-1 bg-slate-800 rounded-lg border-2 border-slate-400 shadow-inner relative overflow-hidden">
                        <div className="absolute top-0 right-2 w-16 h-full bg-white/10 skew-x-12" />
                      </div>
                    ))}

                    {/* Door gap */}
                    <div className="w-[60px] shrink-0" />

                    {[3, 4].map(i => (
                      <div key={i} className="h-14 flex-1 bg-slate-800 rounded-lg border-2 border-slate-400 shadow-inner relative overflow-hidden">
                        <div className="absolute top-0 right-2 w-16 h-full bg-white/10 skew-x-12" />
                      </div>
                    ))}

                    {/* Cab glass — Last */}
                    {isLast && (
                      <div className="w-32 h-14 bg-slate-800 rounded-tr-[60px] rounded-tl-md rounded-br-lg border-2 border-slate-400 shadow-inner relative overflow-hidden shrink-0">
                        <div className="absolute top-0 right-4 w-12 h-full bg-white/10 skew-x-12" />
                      </div>
                    )}
                  </div>

                  {/* Bogies — left */}
                  <div className="absolute bottom-[-20px] left-[15%] flex gap-4 z-0">
                    {[0, 1].map(i => (
                      <div key={`wheel-l-${i}`} className="w-10 h-10 rounded-full border-[3px] border-slate-600 bg-slate-300 flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full border border-slate-400 bg-slate-200" />
                      </div>
                    ))}
                  </div>

                  {/* Bogies — right */}
                  <div className="absolute bottom-[-20px] right-[15%] flex gap-4 z-0">
                    {[0, 1].map(i => (
                      <div key={`wheel-r-${i}`} className="w-10 h-10 rounded-full border-[3px] border-slate-600 bg-slate-300 flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full border border-slate-400 bg-slate-200" />
                      </div>
                    ))}
                  </div>

                  {/* System overlays */}
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

          {/* RIGHT: Issues List */}
          <div className="w-[45%] flex flex-col bg-slate-50 dark:bg-slate-950 relative z-10">

            {/* Filters toolbar */}
            <div className="bg-white dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0 space-y-4 shadow-sm z-10">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-lg">
                  Reported Issues
                  <span className="bg-red-100 text-red-600 px-2.5 py-0.5 rounded-full text-sm font-bold">
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

            {/* Issues list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 rail-scrollbar">
              {filteredIssues.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-3">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="font-medium text-slate-500 dark:text-slate-400">No active issues found.</p>
                </div>
              ) : (
                filteredIssues.map(issue => (
                  <div
                    key={issue.id}
                    className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_2px_4px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08),0_4px_6px_-4px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200 group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex gap-2 items-center">
                        <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                          {issue.id}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${getPriorityStyle(issue.priority)}`}>
                          {issue.priority}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{new Date(issue.planning.reportedAt).toLocaleDateString()}</span>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-[15px] leading-snug group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors">
                        {issue.title ?? issue.description}
                      </h4>
                      <p className="mt-1 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                        {issue.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-medium">
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1.5 rounded-lg">
                        <svg className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {issue.systemCategory}
                      </div>
                      <div className="flex-1" />
                      <span className={`px-2.5 py-1.5 rounded-full capitalize font-semibold text-xs ${
                        issue.status === 'open'
                          ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300'
                          : issue.status === 'in-progress'
                            ? 'bg-blue-100 text-blue-600 dark:bg-sky-950/40 dark:text-sky-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {issue.status.replace('-', ' ')}
                      </span>
                      <AssigneeAvatar technician={getTechnicianById(issue.assigneeId)} />
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );

  return portalRoot ? createPortal(modalContent, portalRoot) : modalContent;
}
