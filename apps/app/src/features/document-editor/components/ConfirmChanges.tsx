"use client";

import { useState } from "react";
import { Rnd } from "react-rnd";
import { Check, X, Sparkles } from "lucide-react";
import { diffTextToHtml } from "../utils/editor-utils";

interface ConfirmChangesProps {
  oldText: string;
  newText: string;
  onAccept: (newText: string) => void;
  onReject: () => void;
}

export function ConfirmChanges({ oldText, newText, onAccept, onReject }: ConfirmChangesProps) {
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    setAccepted(true);
    onAccept(newText);
  };

  const diffHtml = diffTextToHtml(oldText, newText);

  return (
    <Rnd
      default={{ x: 40, y: 40, width: 360, height: "auto" as unknown as number }}
      minWidth={280}
      maxWidth={520}
      enableResizing={false}
      bounds="parent"
      style={{ zIndex: 9999 }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden select-none">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-violet-50 dark:bg-violet-900/30 border-b border-violet-100 dark:border-violet-800/50 cursor-move">
          <Sparkles className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
            AI đề xuất thay đổi
          </span>
        </div>

        {/* Diff preview */}
        <div className="px-4 py-3 max-h-48 overflow-y-auto">
          <p
            className="text-xs leading-relaxed text-slate-700 dark:text-slate-300"
            dangerouslySetInnerHTML={{ __html: diffHtml }}
          />
        </div>

        {/* Actions */}
        {!accepted && (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={handleAccept}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-colors border border-emerald-200 dark:border-emerald-800"
            >
              <Check className="w-3.5 h-3.5" />
              Chấp nhận
            </button>
            <button
              onClick={onReject}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors border border-red-200 dark:border-red-800"
            >
              <X className="w-3.5 h-3.5" />
              Từ chối
            </button>
          </div>
        )}
        {accepted && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 text-center">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              ✓ Đã áp dụng thay đổi
            </span>
          </div>
        )}
      </div>
    </Rnd>
  );
}
