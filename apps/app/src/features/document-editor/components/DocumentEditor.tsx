"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useAgent, UseAgentUpdate } from "@copilotkit/react-core/v2";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { diffTextToHtml } from "../utils/editor-utils";

interface DocumentEditorProps {
  /** Initial plain-text or markdown content to load into the editor. */
  initialValue: string;
  /** Called whenever the user edits content (receives current plain text). */
  onChange: (text: string) => void;
}

export function DocumentEditor({ initialValue, onChange }: DocumentEditorProps) {
  const { agent } = useAgent({
    updates: [UseAgentUpdate.OnStateChanged, UseAgentUpdate.OnRunStatusChanged],
  });

  // Track previous plain text so we can diff after an agent run
  const currentTextRef = useRef(initialValue);
  const prevRunningRef = useRef(false);

  // Proposed doc from agent.state.document (rendered when run finishes)
  const [proposedText, setProposedText] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit],
    immediatelyRender: false,
    content: initialValue,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[120px] p-3 outline-none text-slate-700 dark:text-slate-300 text-sm leading-relaxed",
      },
    },
    onUpdate({ editor }) {
      const text = editor.getText();
      currentTextRef.current = text;
      onChange(text);
    },
  });

  // Detect when agent finishes a run and document state changed
  useEffect(() => {
    const wasRunning = prevRunningRef.current;
    prevRunningRef.current = agent.isRunning;

    if (wasRunning && !agent.isRunning) {
      const newDoc = (agent.state as Record<string, unknown>)?.document;
      if (typeof newDoc === "string" && newDoc && newDoc !== currentTextRef.current) {
        setProposedText(newDoc);
        setShowConfirm(true);
      }
    }
  }, [agent.isRunning, agent.state]);

  const handleAccept = () => {
    if (!proposedText) return;
    if (editor) {
      editor.commands.setContent(proposedText);
      currentTextRef.current = proposedText;
      onChange(proposedText);
    }
    setShowConfirm(false);
    setProposedText(null);
  };

  const handleReject = () => {
    setShowConfirm(false);
    setProposedText(null);
  };

  const diffHtml = showConfirm && proposedText !== null
    ? diffTextToHtml(currentTextRef.current, proposedText)
    : "";

  return (
    <div className="relative flex flex-col h-full gap-2">
      {/* Editor or inline diff preview */}
      <div className={`flex-1 relative rounded-xl border bg-white dark:bg-slate-900 overflow-hidden ${
        showConfirm
          ? "border-blue-300 dark:border-sky-700 ring-2 ring-blue-200 dark:ring-sky-800/50"
          : "border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-blue-500/50"
      }`}>
        {showConfirm ? (
          // Inline diff view — replaces the live editor while reviewing
          <div
            className="prose prose-sm dark:prose-invert max-w-none min-h-[120px] p-3 text-slate-700 dark:text-slate-300 text-sm leading-relaxed
              [&_em]:bg-emerald-100 [&_em]:text-emerald-800 [&_em]:not-italic [&_em]:rounded-sm [&_em]:px-0.5
              [&_s]:bg-rose-100 [&_s]:text-rose-700 [&_s]:line-through [&_s]:rounded-sm [&_s]:px-0.5 dark:[&_em]:bg-emerald-900/40 dark:[&_em]:text-emerald-300 dark:[&_s]:bg-rose-900/40 dark:[&_s]:text-rose-400"
            dangerouslySetInnerHTML={{ __html: diffHtml }}
          />
        ) : (
          <>
            <EditorContent editor={editor} className="h-full" />
            {agent.isRunning && (
              <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 flex items-center justify-center">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 dark:bg-sky-500 text-white rounded-full text-xs font-semibold shadow-lg">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  AI is editing…
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Inline Accept / Reject bar — appears below the diff, no floating */}
      {showConfirm && (
        <div className="flex items-center gap-2 px-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-sky-400 mr-auto">
            <Sparkles className="w-3.5 h-3.5" />
            AI suggested changes
          </div>
          <button
            onClick={handleReject}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-3 h-3" />
            Reject
          </button>
          <button
            onClick={handleAccept}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
          >
            <Check className="w-3 h-3" />
            Accept
          </button>
        </div>
      )}
    </div>
  );
}
