"use client";

import { Fragment, useState, useMemo, useEffect, useCallback, ReactNode } from 'react';
import { X, ChevronLeft, Pencil } from 'lucide-react';
import { useCopilotReadable, useCopilotAction } from "@copilotkit/react-core";
import { getCarriageSystems, getActiveIssuesByCarriage, type SystemHealth, type Carriage, type Train, type Assignee } from '../data/railDataSource';
import { DocumentEditor } from '@/features/document-editor/components/DocumentEditor';
import { ConfirmChanges } from '@/features/document-editor/components/ConfirmChanges';
import { IssueCard, InlineAiChat } from './IssueCard';

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
    glow: 'shadow-[0_0_8px_rgba(16,185,129,0.2)]', label: 'Healthy',
    border: 'border-emerald-500/30', lightBg: 'bg-emerald-50',
  };
  if (health >= 70) return {
    color: 'text-amber-600', bg: 'bg-amber-500',
    glow: 'shadow-[0_0_8px_rgba(245,158,11,0.2)]', label: 'Warning',
    border: 'border-amber-500/30', lightBg: 'bg-amber-50',
  };
  return {
    color: 'text-red-600', bg: 'bg-red-500',
    glow: 'shadow-[0_0_12px_rgba(239,68,68,0.3)]', label: 'Critical',
    border: 'border-red-500/30', lightBg: 'bg-red-50',
  };
};

export const getPriorityStyle = (priority: string): string => ({
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-blue-50 text-blue-700 border-blue-200',
}[priority] ?? 'bg-slate-50 text-slate-700 border-slate-200');

const PRIORITY_LEVEL: Record<string, number> = { high: 3, medium: 2, low: 1 };

const SYSTEM_OPTIONS = [
  { value: 'All', label: 'All Systems' },
  { value: 'HVAC', label: 'HVAC' },
  { value: 'Brakes', label: 'Brakes' },
  { value: 'Doors', label: 'Doors' },
  { value: 'Power', label: 'Power' },
  { value: 'Network', label: 'Network' },
];

const PRIORITY_OPTIONS = [
  { value: 'All', label: 'All Priorities' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Newest First' },
  { value: 'date-asc', label: 'Oldest First' },
  { value: 'priority', label: 'Priority (High-Low)' },
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
      <span className={`absolute -inset-2 ${status.bg} opacity-10 ${rounded}`} />
      <span className={`absolute -inset-4 ${status.bg} ${rounded} animate-breathe`} />
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
  const [filterSystem, setFilterSystem] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterAssignee, setFilterAssignee] = useState('All');
  const [sortBy, setSortBy] = useState('date-desc');
  const [showFilters, setShowFilters] = useState(true);

  const [selectedIssue, setSelectedIssue] = useState(null);
  const [editedDescriptions, setEditedDescriptions] = useState({});
  
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
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
    const names = rawIssues.map(i => i.assignee?.name).filter((n): n is string => Boolean(n));
    return ['All', 'Unassigned', ...new Set(names)].map(a => ({ value: a, label: a }));
  }, [rawIssues]);

  const filteredIssues = useMemo(() => {
    let result = [...rawIssues];
    if (filterSystem !== 'All') result = result.filter(i => i.system === filterSystem);
    if (filterPriority !== 'All') result = result.filter(i => i.priority === filterPriority.toLowerCase());
    if (filterAssignee !== 'All') {
      result = filterAssignee === 'Unassigned'
        ? result.filter(i => !i.assignee)
        : result.filter(i => i.assignee?.name === filterAssignee);
    }
    return result.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime();
      if (sortBy === 'date-asc') return new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime();
      if (sortBy === 'priority') return PRIORITY_LEVEL[b.priority] - PRIORITY_LEVEL[a.priority];
      return 0;
    });
  }, [rawIssues, filterSystem, filterPriority, filterAssignee, sortBy]);

  // CopilotKit readable context
  useCopilotReadable({
    description: "ACTIVE DIAGNOSTIC ISSUES (TICKETS): This is the primary list of all reported problems for this carriage. It includes fields like 'id' (e.g. ISS-1001), 'system', 'priority', and 'currentDescription'.",
    value: filteredIssues.map(i => ({
      id: i.id,
      system: i.system,
      priority: i.priority,
      status: i.status,
      currentDescription: editedDescriptions[i.id] || i.description
    })),
  });

  useCopilotReadable({
    description: "CURRENTLY FOCUSED ISSUE (PREDICTIVE EDITING TARGET): This is the issue the user is actively editing right now in the DocumentEditor. If the user asks to rewrite, fix grammar, or improve 'this issue', YOU MUST use the 'write_document' tool to replace its content.",
    value: selectedIssue ? {
      id: selectedIssue.id,
      currentTextEditing: editedDescriptions[selectedIssue.id] || selectedIssue.description
    } : "User is not actively editing any specific issue right now.",
  });

  useCopilotAction({
    name: "proposeIssueDescriptionFix",
    description: "Propose a grammar or context fix for a specific issue's description. Use this when the user asks you to rewrite a specific issue ID that is NOT the 'CURRENTLY FOCUSED ISSUE'.",
    available: "remote",
    parameters: [
      { name: "issueId", type: "string", description: "The exact string ID of the issue to fix (e.g. 'IS-HVC-01')", required: true },
      { name: "oldDescription", type: "string", description: "The current description text", required: true },
      { name: "newDescription", type: "string", description: "The proposed new description with corrections applied", required: true }
    ],
    handler: async (args) => {
      return "Proposing changes to the user. Awaiting their acceptance.";
    },
    render: ({ status, args, respond }) => (
      <ConfirmChanges
        args={args}
        respond={respond}
        status={status}
        onReject={() => { }}
        onConfirm={() => {
          if (args.issueId && args.newDescription) {
            setEditedDescriptions(prev => ({ ...prev, [args.issueId]: args.newDescription }));
          }
        }}
      />
    )
  }, []);

  const handleSelectIssue = useCallback((issue) => {
    setSelectedIssue(prev => prev?.id === issue.id ? null : issue);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setSelectedIssue(null);
  }, []);


  if (!isOpen || !carriage) return null;
  const editorOpen = !!selectedIssue;


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-800/40 backdrop-blur-md" onClick={onClose} />

      <div className="relative bg-white dark:bg-slate-900 w-full max-w-7xl h-[85vh] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">

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
          <div
            className={`bg-white relative overflow-hidden flex items-center justify-center border-r border-slate-100 transition-all duration-500 ${editorOpen ? 'w-0 opacity-0 pointer-events-none' : 'w-[45%] opacity-100'
              }`}
          >
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: 'linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)',
                backgroundSize: '24px 24px'
              }}
            />

            {/* Live Schema badge */}
            <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm z-20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <span className="text-slate-700 font-bold text-[10px] uppercase tracking-wider">Live Schema</span>
            </div>

            {/* Blueprint */}
            <div className={`relative bg-gradient-to-b from-slate-50 to-slate-200 rounded-2xl border-2 border-slate-300 shadow-xl flex flex-col justify-between z-10 transition-all duration-300 ${editorOpen ? 'w-[90%] aspect-[1.2/1]' : 'w-full max-w-2xl aspect-[2/1]'
              }`}>
              <div className="absolute top-[60%] left-0 right-0 h-2 bg-blue-600 opacity-80" />

              {/* Windows */}
              <div className={`flex justify-between px-6 gap-4 absolute inset-x-0 ${editorOpen ? 'pt-8' : 'pt-14 px-10'}`}>
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 flex-1 bg-slate-800 rounded-lg border-2 border-slate-400 shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 right-2 w-8 h-full bg-white/10 skew-x-12" />
                  </div>
                ))}
                <div className="w-[60px]" />
                {[4, 5].map(i => (
                  <div key={i} className="h-10 flex-1 bg-slate-800 rounded-lg border-2 border-slate-400 shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 right-2 w-8 h-full bg-white/10 skew-x-12" />
                  </div>
                ))}
              </div>

              {/* Right-side wheels */}
              <div className="absolute bottom-[-20px] right-[15%] flex gap-4 z-0">
                {[0, 1].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-[3px] border-slate-600 bg-slate-300 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full border border-slate-400 bg-slate-200" />
                  </div>
                ))}
              </div>

              {/* System overlays */}
              {systems.map(system => {
                const status = getHealthStatus(system.health);
                const hasIssues = rawIssues.some(i => i.system === system.name);
                return (
                  <Fragment key={system.id}>
                    {renderSystemUI(system, hasIssues, status)}
                  </Fragment>
                );
              })}
            </div>

            {/* System health legend */}
            <div className="absolute bottom-4 left-4 right-4 flex gap-2 z-20">
              {systems.slice(0, editorOpen ? 2 : systems.length).map(sys => {
                const st = getHealthStatus(sys.health);
                const hasIssue = rawIssues.some(i => i.system === sys.name);
                return (
                  <div key={sys.id} className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium ${st.border} ${st.lightBg}`}>
                    <div className={`w-2 h-2 rounded-full ${st.bg}`} />
                    {!editorOpen && <span className={st.color}>{sys.name}</span>}
                    {hasIssue && <span className="text-red-500 font-bold">!</span>}
                  </div>
                );
              })}
            </div>
          </div>



          {/* Panel 2: Issues List */}
          <div className={`flex flex-col bg-slate-50 border-r border-slate-100 transition-all duration-500 ${editorOpen ? 'w-[38%]' : 'w-[55%]'
            }`}>

            {/* Issues header + filter toggle */}
            <div className="bg-white px-4 py-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 text-base">Reported Issues</h3>
                  <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs font-bold">
                    {filteredIssues.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowFilters(f => !f)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${showFilters
                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  {showFilters ? 'Hide filters' : 'Filters'}
                </button>
              </div>

              {showFilters && (
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                  <FilterSelect label="System" value={filterSystem} onChange={setFilterSystem} options={SYSTEM_OPTIONS} />
                  <FilterSelect label="Priority" value={filterPriority} onChange={setFilterPriority} options={PRIORITY_OPTIONS} />
                  <FilterSelect label="Assignee" value={filterAssignee} onChange={setFilterAssignee} options={assigneeOptions} />
                  <FilterSelect label="Sort by" value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
                </div>
              )}

              {/* Hint */}
              {!editorOpen && (
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                  <Pencil className="w-3 h-3" />
                  Click a ticket to edit its description with AI
                </p>
              )}
            </div>

            {/* Issues list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-slate-200">
              {filteredIssues.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 py-12">
                  <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-500">No active issues found.</p>
                </div>
              ) : (
                filteredIssues.map(issue => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    isSelected={selectedIssue?.id === issue.id}
                    onSelect={handleSelectIssue}
                    editedDescription={editedDescriptions[issue.id]}
                  />
                ))
              )}
            </div>
          </div>

          {/* Panel 3: Document Editor (slides in) */}
          {editorOpen && (
            <div className="flex-3 flex flex-col bg-white overflow-hidden">

              {/* Editor header */}
              <div className="px-5 py-3 border-b border-slate-100 bg-white shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {/* ── Back button – prominent ── */}
                  <button
                    onClick={handleCloseEditor}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-semibold text-sm rounded-lg transition-all shrink-0 border border-slate-200"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>

                  <div className="w-px h-5 bg-slate-200 shrink-0" />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                        {selectedIssue.id}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0 ${getPriorityStyle(selectedIssue.priority)}`}>
                        {selectedIssue.priority}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {selectedIssue.system} · {selectedIssue.status}
                    </p>
                  </div>
                </div>
              </div>

              {/* Fixed Editor body (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200">
                <DocumentEditor
                  key={selectedIssue.id}
                  initialValue={editedDescriptions[selectedIssue.id] || selectedIssue.description}
                  onChange={(val) => setEditedDescriptions(prev => ({ ...prev, [selectedIssue.id]: val }))}
                  className="relative min-h-full w-full bg-white"
                  agentId="sample_agent"
                />
              </div>

              {/* Fixed Bottom AI Interaction Bar */}
              <div className="shrink-0">
                <InlineAiChat />
              </div>
            </div>
          )}

          {/* Empty state when no issue selected */}
          {!editorOpen && (
            <div className="hidden" />
          )}


        </div>
      </div>
    </div>
  );
}
