"use client";

import { useState } from "react";
import { Clock, User, CheckCircle, XCircle, Sparkles } from "lucide-react";
import { useFleetData } from "@/features/rail-dashboard/context/fleet-data-context";
import type { PendingIssuePlan } from "@/features/rail-dashboard/context/rail-dashboard-ai-context";

interface IssuePlanProposalCardProps {
  plan: PendingIssuePlan;
  status?: string;
}

export function IssuePlanProposalCard({ plan }: IssuePlanProposalCardProps) {
  const { refresh: refreshFleet, technicians } = useFleetData();
  const [approving, setApproving] = useState(false);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  const totalHours = plan.steps.reduce((s, st) => s + (st.estimatedHours || 0), 0);

  // Don't render if no steps yet (tool still streaming parameters)
  if (!plan.issueId || plan.steps.length === 0) {
    return (
      <div className="my-2 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-700/40 dark:bg-blue-950/30 p-4 text-sm flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-500 animate-pulse shrink-0" />
        <span className="text-blue-700 dark:text-blue-300">AI đang phân tích và đề xuất kế hoạch...</span>
      </div>
    );
  }

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await fetch("/api/action-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueId: plan.issueId,
          mode: plan.mode === "append" ? "append" : "replace",
          planSteps: plan.steps.map((step, i) => ({
            title: step.title,
            technicianId: step.technicianId ?? null,
            estimatedHours: step.estimatedHours,
            seqOrder: plan.mode === "append"
              ? plan.existingCount + i + 1
              : step.seqOrder,
          })),
        }),
      });
      if (res.ok) {
        setDone("approved");
        await refreshFleet();
      } else {
        const data = await res.json();
        console.error("Plan save failed:", data.error);
      }
    } catch (err) {
      console.error("Plan save error:", err);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = () => {
    setDone("rejected");
  };

  // ── Approved state
  if (done === "approved") {
    return (
      <div className="my-2 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-700/40 dark:bg-emerald-950/30 p-4 text-sm flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
        <div>
          <p className="font-semibold text-emerald-700 dark:text-emerald-300">Plan Approved!</p>
          <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">
            {plan.steps.length} steps saved to <span className="font-mono">{plan.issueId}</span>
          </p>
        </div>
      </div>
    );
  }

  // ── Rejected state
  if (done === "rejected") {
    return (
      <div className="my-2 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40 p-4 text-sm flex items-center gap-3">
        <XCircle className="w-5 h-5 text-slate-400 shrink-0" />
        <p className="text-slate-500 dark:text-slate-400">Plan proposal rejected.</p>
      </div>
    );
  }

  return (
    <div className="my-2 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-700/40 dark:bg-blue-950/30 text-sm overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-blue-200/60 dark:border-blue-700/30 flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-blue-800 dark:text-blue-200">AI Action Plan</span>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              plan.mode === "create"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                : "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
            }`}>
              {plan.mode === "create" ? "New Plan" : `Thêm vào (${plan.existingCount} bước cũ)`}
            </span>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5 font-mono">{plan.issueId}</p>
          {plan.issueTitle && (
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate font-medium">{plan.issueTitle}</p>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 shrink-0">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-semibold">{totalHours.toFixed(1)}h</span>
        </div>
      </div>

      {/* Rationale */}
      {plan.rationale && (
        <div className="px-4 py-2 bg-blue-50/70 dark:bg-blue-900/20 border-b border-blue-200/40 dark:border-blue-700/20">
          <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">{plan.rationale}</p>
        </div>
      )}

      {/* Steps */}
      <div className="px-4 py-2 space-y-2">
        {plan.mode === "append" && plan.existingCount > 0 && (
          <div className="flex items-center gap-2 py-1 opacity-50">
            <div className="w-5 h-5 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center text-[9px] font-bold shrink-0">
              ···
            </div>
            <p className="text-xs text-slate-500 italic">{plan.existingCount} bước hiện có</p>
          </div>
        )}
        {plan.steps.map((step, i) => {
          const tech = technicians.find(t => t.id === step.technicianId);
          const label = tech?.name ?? step.technicianName ?? null;
          const seqNum = plan.mode === "append" ? plan.existingCount + i + 1 : step.seqOrder;
          return (
            <div key={i} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                {seqNum}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 dark:text-slate-100 text-xs leading-snug">{step.title}</p>
                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {step.estimatedHours}h
                  </span>
                  {label && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {label}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-blue-200/60 dark:border-blue-700/30 flex items-center justify-between bg-blue-50/50 dark:bg-blue-900/10">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {plan.steps.length} bước · {totalHours.toFixed(1)}h tổng
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReject}
            disabled={approving}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
          >
            Từ chối
          </button>
          <button
            onClick={handleApprove}
            disabled={approving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {approving ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                Duyệt & Lưu
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
