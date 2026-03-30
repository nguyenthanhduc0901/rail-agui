import React, { useState } from "react";
import { Check, X, Sparkles, Bell } from "lucide-react";

export interface ConfirmChangesProps {
  args: any;
  respond: any;
  status: any;
  onReject: () => void;
  onConfirm: () => void;
}

export function ConfirmChanges({ args, respond, status, onReject, onConfirm }: ConfirmChangesProps) {
  const [accepted, setAccepted] = useState<boolean | null>(null);

  if (accepted !== null) {
    return (
      <div 
        data-testid="status-display"
        className={`flex items-center gap-2.5 py-3 px-5 rounded-[20px] text-sm font-bold shadow-2xl animate-in fade-in zoom-in-95 duration-500 ${
          accepted 
            ? "bg-emerald-500 text-white shadow-emerald-200/50" 
            : "bg-slate-800 text-white shadow-slate-200/50"
        }`}
      >
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
          {accepted ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
        </div>
        <span>{accepted ? "Changes Applied Successfully" : "Proposed Changes Discarded"}</span>
      </div>
    );
  }

  return (
    <div
      data-testid="confirm-changes-modal"
      className="bg-white rounded-lg shadow-2xl border border-slate-100 p-3 w-[220px] animate-in fade-in slide-in-from-bottom-2 duration-400 pointer-events-auto cursor-move"
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3 h-3 text-slate-400" />
        <h3 className="text-xs font-bold text-slate-900">Confirm Updates</h3>
      </div>
      
      <p className="text-slate-500 text-[10px] mb-3 leading-tight">Accept AI proposed changes?</p>
      
      <div className="flex justify-end gap-2">
        <button
          data-testid="reject-button"
          disabled={status !== "executing"}
          onClick={() => {
            if (respond) {
              setAccepted(false);
              onReject();
              respond({ accepted: false });
            }
          }}
          className="px-2.5 py-1 rounded bg-slate-50 text-slate-600 text-[10px] font-bold hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          Reject
        </button>
        <button
          data-testid="confirm-button"
          disabled={status !== "executing"}
          onClick={() => {
            if (respond) {
              setAccepted(true);
              onConfirm();
              respond({ accepted: true });
            }
          }}
          className="px-2.5 py-1 rounded bg-black text-white text-[10px] font-bold hover:bg-zinc-800 shadow-sm transition-colors disabled:opacity-50"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
