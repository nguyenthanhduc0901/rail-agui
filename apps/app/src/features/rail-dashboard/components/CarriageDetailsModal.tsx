"use client";

import { Fragment, useState, useMemo, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Clock } from 'lucide-react';
import { getCarriageSystems, getActiveIssuesByCarriage, getCarriagesByTrain, type SystemHealth, type Carriage, type Train, type Technician } from '../data/railDataSource';
import { useFleetData } from '../context/fleet-data-context';
import { useRailDashboardAI } from '../context/rail-dashboard-ai-context';

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
  critical: 'bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-300',
  high:     'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  medium:   'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  low:      'bg-blue-100 text-blue-700 dark:bg-sky-950/40 dark:text-sky-400',
}[priority] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400');

const PRIORITY_LEVEL: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const SYSTEM_OPTIONS = [
  { value: 'All',     label: 'All Systems' },
  { value: 'HVAC',    label: 'HVAC' },
  { value: 'Brakes',  label: 'Brakes' },
  { value: 'Doors',   label: 'Doors' },
  { value: 'Power',   label: 'Power' },
  { value: 'Network', label: 'Network' },
];

const PRIORITY_OPTIONS = [
  { value: 'All',      label: 'All Priorities' },
  { value: 'Critical', label: 'Critical' },
  { value: 'High',     label: 'High' },
  { value: 'Medium',   label: 'Medium' },
  { value: 'Low',      label: 'Low' },
];

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Newest First' },
  { value: 'date-asc',  label: 'Oldest First' },
  { value: 'priority',  label: 'Priority (High-Low)' },
];

// ─── PLAN STEP INTERFACE ───────────────────────────────────────────────────────

interface PlanStepLocal {
  id: string;
  title: string;
  details: string;
  technicianId: string;
  estimatedHours: number;
  seqOrder: number;
}

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

function renderSystemUI(system: SystemHealth, hasIssues: boolean, status: HealthStatus, isLast: boolean = false, showEffects: boolean = false): ReactNode {
  switch (system.name) {
    case 'HVAC':
      return (
        <div className={`absolute top-[-14px] left-[25%] group cursor-pointer ${hasIssues && showEffects ? 'animate-pulse' : ''}`}>
          <SystemTooltip system={system} hasIssues={hasIssues} status={status} />
          <div className="relative">
            {hasIssues && showEffects && <PingRings status={status} />}
            <div className={`w-20 h-4 bg-slate-200 border-2 border-b-0 ${status.border} rounded-t-md flex items-center justify-evenly px-1 relative z-10 overflow-hidden ${hasIssues && showEffects ? status.glow : ''}`}>
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
        <div className={`absolute top-[-20px] right-[25%] group cursor-pointer ${hasIssues && showEffects ? 'animate-pulse' : ''}`}>
          <SystemTooltip system={system} hasIssues={hasIssues} status={status} />
          <div className="relative flex flex-col items-center">
            {hasIssues && showEffects && <PingRings status={status} />}
            <div className={`w-6 h-3 border-t-2 border-slate-400 rounded-t-full mb-0.5 ${hasIssues ? 'border-red-400' : ''}`} />
            <div className={`w-4 h-2 border-t-2 border-slate-400 rounded-t-full mb-0.5 ${hasIssues ? 'border-red-400' : ''}`} />
            <div className={`w-6 h-3 bg-slate-200 border-2 border-b-0 ${status.border} rounded-t-full flex justify-center items-end pb-0.5 relative z-10`}>
              <div className={`w-1.5 h-1.5 rounded-full ${status.bg} ${status.glow}`} />
            </div>
          </div>
        </div>
      );

    case 'Doors':
      // Tính toán khoảng cách từ mép phải:
      // - Toa cuối (isLast): Padding(24px) + Đuôi toa(112px) + Khoảng cách(20px) = 156px
      // - Toa thường: Padding(32px)
      const rightPos = isLast ? 'right-[156px]' : 'right-[32px]';
      
      return (
        <div className={`absolute top-[16%] ${rightPos} w-[115px] h-[70%] group cursor-pointer z-20`}>
          <SystemTooltip system={system} hasIssues={hasIssues} status={status} />
          {/* Khung cửa */}
          <div className={`relative w-full h-full border-2 ${status.border} bg-slate-200/90 backdrop-blur-md rounded-sm flex overflow-hidden shadow-md ${hasIssues && showEffects ? status.glow : ''}`}>
            {hasIssues && showEffects && <PingRings status={status} rounded="rounded-sm" />}
            
            {/* Cánh cửa trái */}
            <div className="flex-1 border-r border-slate-400/60 flex flex-col items-center pt-2 gap-2">
              <div className="w-5 h-10 bg-slate-800/80 rounded-sm shadow-inner" />
              <div className="w-0.5 h-1/2 bg-slate-400/80 rounded-full" />
            </div>
            
            {/* Cánh cửa phải */}
            <div className="flex-1 border-l border-slate-400/60 flex flex-col items-center pt-2 gap-2">
              <div className="w-5 h-10 bg-slate-800/80 rounded-sm shadow-inner" />
              <div className="w-0.5 h-1/2 bg-slate-400/80 rounded-full" />
            </div>
          </div>
          
          {/* Đèn tín hiệu */}
          {hasIssues && showEffects && (
            <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-1.5 rounded-full ${status.bg} ${status.glow} z-30`} />
          )}
        </div>
      );

    case 'Power':
      return (
        <div className={`absolute bottom-[-17px] right-[32%] group cursor-pointer ${hasIssues && showEffects ? 'animate-pulse' : ''}`}>
          <SystemTooltip system={system} hasIssues={hasIssues} status={status} />
          <div className="relative">
            {hasIssues && showEffects && <PingRings status={status} />}
            <div className={`w-16 h-5 bg-slate-700 border-2 ${status.border} rounded-b-md flex items-center justify-between px-1 relative z-10 ${hasIssues && showEffects ? status.glow : ''}`}>
              <div className="w-3 h-2 bg-slate-600 border border-slate-500 rounded-sm" />
              <div className="w-3 h-2 bg-slate-600 border border-slate-500 rounded-sm" />
              <div className={`w-2 h-2 rounded-full ${status.bg} ${status.glow}`} />
            </div>
          </div>
        </div>
      );

    case 'Brakes':
      return (
        <Fragment>
          {/* Front Axle Brakes */}
          <div className={`absolute bottom-[-22px] left-[15%] group cursor-pointer z-10 ${hasIssues && showEffects ? 'animate-pulse' : ''}`}>
            <SystemTooltip system={system} hasIssues={hasIssues} status={status} />
            <div className="relative flex gap-3">
              {hasIssues && showEffects && <PingRings status={status} />}
              <div className={`w-9 h-9 rounded-full border-4 ${status.border} border-t-transparent opacity-60`} />
              <div className={`w-9 h-9 rounded-full border-4 ${status.border} border-b-transparent opacity-60`} />
              <div className={`absolute top-0 left-0 w-full h-1/2 border-t-4 ${status.border} rounded-t-full opacity-100 z-20`} />
            </div>
          </div>
          {/* Rear Axle Brakes */}
          <div className={`absolute bottom-[-22px] right-[15%] group cursor-pointer z-10 ${hasIssues && showEffects ? 'animate-pulse' : ''}`}>
            <div className="relative flex gap-3">
              {hasIssues && showEffects && <PingRings status={status} />}
              <div className={`w-9 h-9 rounded-full border-4 ${status.border} border-t-transparent opacity-60`} />
              <div className={`w-9 h-9 rounded-full border-4 ${status.border} border-b-transparent opacity-60`} />
              <div className={`absolute top-0 left-0 w-full h-1/2 border-t-4 ${status.border} rounded-t-full opacity-100 z-20`} />
            </div>
          </div>
        </Fragment>
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
  const { issues: liveIssues, carriages: liveCarriages, technicians: liveTechnicians, refresh: refreshFleet } = useFleetData();
  const { highlightedCarriageIds } = useRailDashboardAI();
  const showEffects = carriage ? highlightedCarriageIds.has(carriage.id) : false;
  const [filterSystem,   setFilterSystem]   = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [sortBy,         setSortBy]         = useState('date-desc');

  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  
  // Plan steps state
  const [planSteps, setPlanSteps] = useState<PlanStepLocal[]>([]);

  // Wrapped onClose to handle cleanup
  const handleClose = () => {
    setSelectedIssueId(null);
    setFilterSystem('All');
    setFilterPriority('All');
    setPlanSteps([]);
    onClose();
  };

  const systems = useMemo(
    () => (train && carriage ? getCarriageSystems(train.id, carriage.id) : []),
    [train, carriage],
  );

  const rawIssues = useMemo(
    () => (carriage ? getActiveIssuesByCarriage(carriage.id, liveIssues) : []),
    [carriage, liveIssues],
  );

  const filteredIssues = useMemo(() => {
    let result = [...rawIssues];
    if (filterSystem !== 'All')   result = result.filter(i => i.systemCategory === filterSystem);
    if (filterPriority !== 'All') result = result.filter(i => i.priority === filterPriority.toLowerCase());
    return result.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime();
      if (sortBy === 'date-asc')  return new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime();
      if (sortBy === 'priority')  return PRIORITY_LEVEL[b.priority] - PRIORITY_LEVEL[a.priority];
      return 0;
    });
  }, [rawIssues, filterSystem, filterPriority, sortBy]);

  const selectedIssue = useMemo(
    () => rawIssues.find(i => i.id === selectedIssueId),
    [rawIssues, selectedIssueId],
  );

  // Handler to select an issue and load its plan steps
  const handleSelectIssue = (issueId: string) => {
    setSelectedIssueId(issueId);
    const issue = rawIssues.find(i => i.id === issueId);
    if (issue) {
      // If issue has existing plan steps, load them; otherwise create a default one
      if (issue.planSteps && issue.planSteps.length > 0) {
        setPlanSteps(issue.planSteps.map(ps => ({
          id: ps.id,
          title: ps.title,
          details: '',  // Details not stored in DB currently
          technicianId: ps.technicianId || '',
          estimatedHours: ps.estimatedHours || 2.0,
          seqOrder: ps.seqOrder,
        })));
      } else {
        // Create default empty plan step
        setPlanSteps([{
          id: crypto.randomUUID(),
          title: '',
          details: '',
          technicianId: '',
          estimatedHours: issue.totalEstimatedHours || 2.0,
          seqOrder: 1,
        }]);
      }
    }
  };

  // Handler to save action plan
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSaveActionPlan = async () => {
    if (!selectedIssue) return;
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/action-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId: selectedIssue.id,
          planSteps: planSteps.map(step => ({
            id: step.id,
            title: step.title,
            technicianId: step.technicianId || null,
            estimatedHours: step.estimatedHours,
            seqOrder: step.seqOrder,
          })),
        }),
      });
      if (res.ok) {
        setSaveStatus('success');
        await refreshFleet();
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        const data = await res.json();
        console.error('Save failed:', data.error);
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Failed to save action plan:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handler to clear issue selection
  const handleClearIssueSelection = () => {
    setSelectedIssueId(null);
    setPlanSteps([]);
  };

  // Calculate total estimated hours from plan steps
  const totalEstimatedHours = useMemo(() => {
    return planSteps.reduce((sum, step) => sum + (step.estimatedHours || 0), 0);
  }, [planSteps]);

  // Plan step handlers
  const addPlanStep = () => {
    const newStep: PlanStepLocal = {
      id: crypto.randomUUID(),
      title: '',
      details: '',
      technicianId: '',
      estimatedHours: 2.0,
      seqOrder: planSteps.length + 1,
    };
    setPlanSteps([...planSteps, newStep]);
  };

  const removePlanStep = (stepId: string) => {
    const updated = planSteps
      .filter(s => s.id !== stepId)
      .map((s, idx) => ({ ...s, seqOrder: idx + 1 }));
    setPlanSteps(updated);
  };

  const updatePlanStep = (stepId: string, field: keyof PlanStepLocal, value: string | number) => {
    setPlanSteps(planSteps.map(s =>
      s.id === stepId ? { ...s, [field]: value } : s
    ));
  };

  if (!isOpen || !carriage) return null;

  const portalRoot = typeof document !== 'undefined' ? document.getElementById('app-modal-portal') : null;

  const modalContent = (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-800/40 backdrop-blur-md" onClick={handleClose} />

      <div className="relative bg-white dark:bg-slate-900 w-full max-w-7xl h-[88vh] rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.50)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-black/5 dark:border-slate-800">

        {/* Header */}
        <div className="bg-white dark:bg-slate-900 px-8 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center z-10 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm shadow-sm font-bold">{carriage.id}</span>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {carriage.type} Carriage Diagnostics
            </h2>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{train?.name}</span>
              <span className="ml-1 text-slate-400 dark:text-slate-500">(ID: {train?.id})</span>
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors border border-slate-200 dark:border-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: 50/50 Layout */}
        <div className="flex flex-1 overflow-hidden bg-slate-50/50 dark:bg-slate-950">

          {/* LEFT COLUMN (50%) */}
          <div className="w-1/2 flex flex-col border-r border-slate-200 dark:border-slate-800">

            {/* TOP: Issues List with Filters */}
            <div className="h-3/5 flex flex-col border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80">
              <div className="bg-white dark:bg-slate-900 px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-sm z-10">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    Reported Issues
                    <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs font-bold">
                      {filteredIssues.length}
                    </span>
                  </h3>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <FilterSelect label="System"   value={filterSystem}   onChange={setFilterSystem}   options={SYSTEM_OPTIONS} />
                  <FilterSelect label="Priority" value={filterPriority} onChange={setFilterPriority} options={PRIORITY_OPTIONS} />
                  <FilterSelect label="Sort by"  value={sortBy}         onChange={setSortBy}         options={SORT_OPTIONS} />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 rail-scrollbar">
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
                        onClick={() => handleSelectIssue(issue.id)}
                        className={`cursor-pointer p-3 rounded-xl transition-all duration-200 group border ${
                          isSelected
                            ? 'bg-blue-50/50 dark:bg-sky-900/20 border-blue-200 dark:border-sky-800 shadow-md ring-1 ring-blue-500/20 dark:ring-sky-500/30'
                            : 'bg-white dark:bg-slate-900 border-transparent shadow-[0_2px_4px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700'
                        }`}
                      >
                        {/* Row 1: ID + priority + status + date */}
                        <div className="flex justify-between items-center mb-1.5">
                          <div className="flex gap-1.5 items-center">
                            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${isSelected ? 'text-blue-700 bg-blue-100 dark:text-sky-300 dark:bg-sky-900/50' : 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800'}`}>
                              {issue.id}
                            </span>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${getPriorityStyle(issue.priority)}`}>
                              {issue.priority}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-semibold ${
                              issue.status === 'open'        ? 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' :
                              issue.status === 'in-progress' ? 'text-blue-600 bg-blue-100 dark:bg-sky-900/30 dark:text-sky-400' :
                              issue.status === 'resolved'    ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                               'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {issue.status.replace('-', ' ')}
                            </span>
                          </div>
                          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 shrink-0">{new Date(issue.reportedAt).toLocaleDateString()}</span>
                        </div>
                        {/* Row 2: title + system */}
                        <div className="flex items-center gap-2">
                          <h4 className={`font-semibold text-sm line-clamp-1 flex-1 transition-colors ${isSelected ? 'text-blue-700 dark:text-sky-400' : 'text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-sky-400'}`}>
                            {issue.title ?? issue.description}
                          </h4>
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md shrink-0 font-medium">
                            {issue.systemCategory}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* BOTTOM: Carriage Blueprint */}
            <div className={`h-2/5 relative overflow-hidden flex items-center justify-center p-6 shrink-0 shadow-sm z-20 ${
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
                <span className="text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-wider">Carriage Blueprint</span>
              </div>

              {(() => {
                const allCarriages = train ? getCarriagesByTrain(train.id, liveCarriages) : [];
                const isHead = allCarriages.length > 0 && allCarriages[0].id === carriage.id;
                const isLast = allCarriages.length > 1 && allCarriages[allCarriages.length - 1].id === carriage.id;
                const shapeClasses = isHead
                  ? 'rounded-tl-[80px] rounded-bl-3xl rounded-r-2xl'
                  : isLast
                    ? 'rounded-r-[80px] rounded-l-2xl'
                    : 'rounded-2xl';
                return (
                  <div className={`relative h-full aspect-[2.5/1] max-w-3xl max-h-48 bg-gradient-to-b from-slate-50 to-slate-200 border-2 border-slate-300 shadow-xl flex flex-col justify-between z-10 transition-all duration-300 ${shapeClasses}`}>
                    <div className="absolute top-[60%] left-0 right-0 h-2 bg-blue-600 opacity-80" />
                    <div className={`flex justify-between pt-8 gap-5 absolute inset-x-0 ${isHead ? 'pl-6 pr-8' : isLast ? 'pl-8 pr-6' : 'px-8'}`}>
                      {isHead && (
                        <div className="w-28 h-12 bg-slate-800 rounded-tl-[60px] rounded-tr-md rounded-bl-lg border-2 border-slate-400 shadow-inner relative overflow-hidden shrink-0">
                          <div className="absolute top-0 right-4 w-12 h-full bg-white/10 skew-x-12" />
                        </div>
                      )}
                      {/* Dồn 4 cửa sổ lên trước */}
                      {[1].map(i => (
                        <div key={i} className="h-12 flex-1 bg-slate-800 rounded-lg border-2 border-slate-400 shadow-inner relative overflow-hidden">
                          <div className="absolute top-0 right-2 w-16 h-full bg-white/10 skew-x-12" />
                        </div>
                      ))}
                      {/* Khoảng trống 110px dành cho cửa ra vào được đẩy xuống cuối */}
                      <div className="w-[140px] shrink-0" />
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
                          {/* Thêm biến isLast vào đây */}
                          {renderSystemUI(system, hasIssues, status, isLast, showEffects)}
                        </Fragment>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

          </div>

          {/* RIGHT COLUMN (50%): Issue Detail & Action Plan */}
          <div className="w-1/2 bg-white dark:bg-slate-900 flex flex-col z-10">{selectedIssue ? (
                <div className="flex flex-col h-full animate-in slide-in-from-right-2 duration-300">
                  {/* Issue Header - Hidden as info already displayed in issue card */}
                  <div className="hidden p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
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
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-snug mb-3">
                      {selectedIssue.title ?? selectedIssue.description}
                    </h3>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={`px-3 py-1 rounded-full capitalize font-semibold ${
                        selectedIssue.status === 'open'        ? 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' :
                        selectedIssue.status === 'in-progress' ? 'text-blue-600 bg-blue-100 dark:bg-sky-900/30 dark:text-sky-400' :
                        selectedIssue.status === 'resolved'    ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                                 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {selectedIssue.status.replace('-', ' ')}
                      </span>
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <Clock className="w-4 h-4" />
                        <span className="font-semibold">{totalEstimatedHours.toFixed(1)}h total</span>
                      </div>
                    </div>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 p-6 overflow-y-auto space-y-6 rail-scrollbar">
                    
                    {/* Issue Description */}
                    <div>
                      <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">Issue Description</label>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-700/50">
                        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                          {selectedIssue.description}
                        </p>
                      </div>
                    </div>

                    {/* Action Plan / Plan Steps */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                          Action Plan ({planSteps.length} {planSteps.length === 1 ? 'step' : 'steps'})
                        </label>
                        <button
                          onClick={addPlanStep}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-sky-400 hover:text-blue-700 dark:hover:text-sky-300 bg-blue-50 dark:bg-sky-900/30 hover:bg-blue-100 dark:hover:bg-sky-900/50 rounded-lg transition-colors border border-blue-200 dark:border-sky-800"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Step
                        </button>
                      </div>

                      <div className="space-y-4">
                        {planSteps.map((step, index) => {
                          const assignedTech = liveTechnicians.find(t => t.id === step.technicianId);
                          return (
                            <div
                              key={step.id}
                              className="p-4 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow"
                            >
                              <div className="flex items-start gap-3 mb-3">
                                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                  {index + 1}
                                </div>
                                <div className="flex-1 space-y-2">
                                  {/* Step Title + Technician + Hours on one compact row */}
                                  <input
                                    type="text"
                                    value={step.title}
                                    onChange={(e) => updatePlanStep(step.id, 'title', e.target.value)}
                                    placeholder="Step title..."
                                    className="w-full px-3 py-1.5 text-sm font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                                  />

                                  {/* Technician & Hours Row */}
                                  <div className="flex items-center gap-3">
                                    {/* Technician Dropdown */}
                                    <div className="flex-1 flex items-center gap-2">
                                      <AssigneeAvatar technician={assignedTech} />
                                      <select
                                        value={step.technicianId}
                                        onChange={(e) => updatePlanStep(step.id, 'technicianId', e.target.value)}
                                        className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer transition-shadow"
                                      >
                                        <option value="">Unassigned</option>
                                        {liveTechnicians.map(tech => (
                                          <option key={tech.id} value={tech.id}>
                                            {tech.name} ({tech.specialty})
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Estimated Hours */}
                                    <div className="flex items-center gap-2">
                                      <Clock className="w-4 h-4 text-slate-400" />
                                      <input
                                        type="number"
                                        value={step.estimatedHours}
                                        onChange={(e) => updatePlanStep(step.id, 'estimatedHours', parseFloat(e.target.value) || 0)}
                                        min="0"
                                        step="0.5"
                                        className="w-20 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                                      />
                                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">hrs</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Delete Button */}
                                <button
                                  onClick={() => removePlanStep(step.id)}
                                  disabled={planSteps.length === 1}
                                  className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent shrink-0"
                                  title="Delete step"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Scheduled Date */}
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Scheduled Date
                      </label>
                      <input
                        type="date"
                        defaultValue={selectedIssue.scheduledDate?.slice(0, 10) ?? ''}
                        className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm text-slate-700 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                    <button
                      onClick={handleClearIssueSelection}
                      className="px-4 py-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      Clear Selection
                    </button>
                    <button onClick={handleSaveActionPlan} disabled={isSaving} className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed">
                      {isSaving ? 'Saving...' : saveStatus === 'success' ? '✅ Saved!' : saveStatus === 'error' ? '❌ Error' : 'Save Action Plan'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/30 dark:bg-slate-900/30">
                  <div className="w-20 h-20 mb-6 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 border-dashed flex items-center justify-center">
                    <svg className="w-10 h-10 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">Issue Diagnostic Planner</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                    Select an issue from the list on the left to review details, create an action plan with multiple steps, and assign technicians.
                  </p>
                </div>
              )}
            </div>
          
        </div>
      </div>
    </div>
  );

  return portalRoot ? createPortal(modalContent, portalRoot) : modalContent;
}
