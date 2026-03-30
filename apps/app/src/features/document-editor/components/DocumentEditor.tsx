"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Rnd } from "react-rnd";
import {
  useAgent,
  UseAgentUpdate,
  useHumanInTheLoop,
  useConfigureSuggestions,
} from "@copilotkit/react-core/v2";
import { useCopilotAction } from "@copilotkit/react-core";
import { ConfirmChanges } from "./ConfirmChanges";
import { fromMarkdown, diffPartialText } from "../utils/editor-utils";

const extensions = [StarterKit];

interface AgentState {
  document: string;
}

interface DocumentEditorProps {
  initialValue?: string;
  onChange?: (value: string) => void;
  className?: string;
  agentId?: string;
}

export const DocumentEditor = ({
  initialValue = "",
  onChange,
  className = "relative min-h-[400px] w-full",
  agentId = "sample_agent"
}: DocumentEditorProps) => {

  const [pendingDiffData, setPendingDiffData] = useState<{ old: string; new: string } | null>(null);
  const [currentDocument, setCurrentDocument] = useState(initialValue);
  const [placeholderVisible, setPlaceholderVisible] = useState(false);

  const lastValueRef = useRef(initialValue);
  const isLoadingRef = useRef(false);
  const isPendingDiffRef = useRef(false); 
  const wasRunning = useRef(false);
  const lastInitialValueRef = useRef(initialValue);

  // Editor initialization with markdown content and update handler
  const editor = useEditor({
    extensions,
    content: fromMarkdown(initialValue),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "p-4 focus:outline-none min-h-[inherit] [&_em]:bg-emerald-100 [&_em]:text-emerald-800 [&_em]:not-italic [&_em]:rounded-sm [&_em]:px-0.5 [&_s]:bg-rose-100 [&_s]:text-rose-800 [&_s]:line-through [&_s]:rounded-sm [&_s]:px-0.5"
      },
    },
    onUpdate: ({ editor }) => {
      // Prevent saving intermediate diff HTML to the parent state during AI runs or reviews
      if (isLoadingRef.current || isPendingDiffRef.current) return;
      const currentText = editor.getText();
      if (currentText !== lastValueRef.current) {
        lastValueRef.current = currentText;
        onChange?.(currentText);
      }
    }
  });

  // Agent state and control hooks
  const { agent } = useAgent({
    agentId: agentId,
    updates: [UseAgentUpdate.OnStateChanged, UseAgentUpdate.OnRunStatusChanged],
  });

  const agentState = agent.state as AgentState | undefined;
  const setAgentState = useCallback((s: AgentState) => agent.setState(s), [agent]);
  const isLoading = agent.isRunning;

  // Ticket switching logic
  useEffect(() => {
    if (initialValue !== lastInitialValueRef.current) {
      lastInitialValueRef.current = initialValue;

      // Reset all logic flags to prevent old ticket data from triggering HITL
      wasRunning.current = false;
      isPendingDiffRef.current = false;
      setPendingDiffData(null);

      // Sync local state and Ref
      setCurrentDocument(initialValue);
      lastValueRef.current = initialValue;

      // Force update editor content
      if (editor) {
        editor.commands.setContent(fromMarkdown(initialValue));
      }

      // Crucial: Update Agent state immediately so it doesn't compare new ticket content with old document memory
      setAgentState({ document: initialValue });
    }
  }, [initialValue, editor, setAgentState]);

  // AI Run Detection and HITL Trigger
  useEffect(() => {
    // Stage A: AI Run Starts
    if (isLoading && !wasRunning.current) {
      const snapshot = editor?.getText() || "";
      setCurrentDocument(snapshot); // Capture snapshot of current text before AI changes it
      isLoadingRef.current = true;
    }

    // Stage B: AI Run Finishes (Trigger HITL)
    if (!isLoading && wasRunning.current) {
      isLoadingRef.current = false;
      const finalAIDoc = agentState?.document || "";

      // Compare snapshot against final AI result
      if (finalAIDoc !== currentDocument && finalAIDoc !== "") {
        const diff = diffPartialText(currentDocument, finalAIDoc, true);
        editor?.commands.setContent(fromMarkdown(diff));

        // Populate diff data and lock editor for review
        setPendingDiffData({ old: currentDocument, new: finalAIDoc });
        isPendingDiffRef.current = true;
      }
    }

    wasRunning.current = isLoading;
    editor?.setEditable(!isLoading);
  }, [isLoading, agentState?.document, editor, currentDocument]);

  // Initial content sync on mount or agent state change
  useEffect(() => {
    if (isLoading) {
      const newDocument = agentState?.document || "";
      const diff = currentDocument.trim().length > 0
        ? diffPartialText(currentDocument, newDocument)
        : newDocument;
      editor?.commands.setContent(fromMarkdown(diff));
    }
  }, [agentState?.document, isLoading, currentDocument, editor]);

  // Human typing sync
  useEffect(() => {
    const text = editor?.getText() || "";
    setPlaceholderVisible(text.length === 0);

    // Only sync to Agent state if no AI process or Review is active
    if (!isLoading && !isPendingDiffRef.current && text !== agentState?.document) {
      setCurrentDocument(text);
      setAgentState({ document: text });
    }
  }, [editor?.getText(), isLoading, setAgentState, agentState?.document]);

  // HITL Response Handlers
  const handleConfirmDiff = useCallback(() => {
    if (!pendingDiffData) return;
    const finalDoc = pendingDiffData.new;

    isPendingDiffRef.current = false; // Unlock editor updates
    editor?.commands.setContent(fromMarkdown(finalDoc));
    lastValueRef.current = finalDoc;
    setCurrentDocument(finalDoc);
    setAgentState({ document: finalDoc });
    onChange?.(finalDoc);

    setPendingDiffData(null);
  }, [pendingDiffData, editor, setAgentState, onChange]);

  const handleRejectDiff = useCallback(() => {
    if (!pendingDiffData) return;
    const oldDoc = pendingDiffData.old;

    isPendingDiffRef.current = false; // Unlock editor updates
    editor?.commands.setContent(fromMarkdown(oldDoc));
    lastValueRef.current = oldDoc;
    setCurrentDocument(oldDoc);
    setAgentState({ document: oldDoc });
    onChange?.(oldDoc);

    setPendingDiffData(null);
  }, [pendingDiffData, editor, setAgentState, onChange]);

  // Suggestion configuration for the editor context
  useConfigureSuggestions({
    suggestions: [
      {
        title: "Fix grammar & tone",
        message: "Fix the grammar, spelling, and tone of the current description.",
      },
      {
        title: "Professional rewrite",
        message: "Rewrite the current description to be more professional and technically detailed.",
      },
      {
        title: "Help me expand",
        message: "Expand on the current issue description with more specific technical details.",
      },
      {
        title: "Fix all issues",
        message: "Briefly summarize and propose fixes for all reported issues in this carriage.",
      },
      {
        title: "Write final report",
        message: "Write a comprehensive maintenance report based on all identified issues.",
      },
    ],
    available: (agentId === "sample_agent" ? "always" : "disabled") as any,
  });

  useHumanInTheLoop({
    agentId: agentId,
    name: "confirm_changes",
    render: ({ args, respond, status }) => (
      <ConfirmChanges
        args={args}
        respond={respond}
        status={status}
        onReject={handleRejectDiff}
        onConfirm={handleConfirmDiff}
      />
    ),
  }, [handleRejectDiff, handleConfirmDiff, agentId]);

  useCopilotAction({
    name: "write_document",
    available: "remote",
    parameters: [{ name: "document", type: "string", required: true }],
    handler: async () => "Awaiting user review in editor...",
    render: ({ status }) => (
      <div className={`p-3 text-sm rounded-xl border ${status === "executing" ? "bg-emerald-50 text-emerald-700 animate-pulse border-emerald-100" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
        {status === "executing" ? "Drafting changes in editor..." : "Review changes in editor."}
      </div>
    ),
  }, [agentId]);

  return (
    <div className={className}>
      {placeholderVisible && (
        <div className="absolute top-4 left-4 pointer-events-none text-gray-400">Type here...</div>
      )}
      <EditorContent editor={editor} />

      {/* Manual UI Fallback for Pending Diffs */}
      {pendingDiffData && (
        <Rnd
          default={{ x: 450, y: 20, width: 220, height: 'auto' }}
          enableResizing={false}
          bounds="parent"
          className="z-50"
        >
          <ConfirmChanges
            args={{}}
            respond={() => { }}
            status="executing"
            onConfirm={handleConfirmDiff}
            onReject={handleRejectDiff}
          />
        </Rnd>
      )}
    </div>
  );
};