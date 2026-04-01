# Feature: Sửa Issue Description (Issue Text Editing)

## Tổng quan kiến trúc

Tính năng này cho phép người dùng chọn một issue ticket và chỉnh sửa phần `description` của nó thông qua một rich-text editor (TipTap), có sự hỗ trợ của AI (LangGraph agent) để gợi ý, sửa ngữ pháp, viết lại nội dung. Luồng dữ liệu chính:

```
Issue list (CarriageDetailsModal)
  → Click issue → selectedIssue state
  → DocumentEditor (TipTap + CopilotKit)
  → AI proposes changes via write_document tool (backend)
  → diffPartialText highlights changes (green = added, red = removed)
  → ConfirmChanges UI → Confirm/Reject
  → editedDescriptions state updated
  → IssueCard re-renders with edited description
```

---

## 1. Data Model – Issue Interface

**File:** `apps/app/src/features/rail-dashboard/data/railDataSource.ts`

```typescript
export interface Issue {
  id: string;
  trainId: string;
  carriageId: string;
  system: string;
  title: string;
  description: string;           // <-- trường được edit
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'in-progress' | 'closed';
  assignee?: Assignee;
  date?: string;
}

export const getActiveIssuesByCarriage = (trainId: string, carriageId: string): Issue[] =>
  issues.filter(
    (issue) =>
      issue.trainId === trainId &&
      issue.carriageId === carriageId &&
      issue.status !== 'closed',
  );
```

---

## 2. Agent State – Document field

**File:** `apps/agent/src/state.py`

```python
from typing import Literal, Optional, TypedDict, Any, List
from langgraph.graph import MessagesState

class AgentState(MessagesState):
    document: Optional[str] = None   # <-- lưu nội dung document đang edit
    tools: List[Any] = []
    copilotkit: dict = {}
```

---

## 3. Backend Tool – `write_document`

**File:** `apps/agent/src/rail_data.py`

```python
@tool
def write_document(document: str) -> str:
    """
    Write a document. Use markdown formatting to format the document.
    It's good to format the document extensively so it's easy to read.
    You can use all kinds of markdown.
    However, do not use italic or strike-through formatting, it's reserved for another purpose.
    You MUST write the full document, even when changing only a few words.
    When making edits to the document, try to make them minimal - do not change every word.
    Keep stories SHORT!
    """
    return document


rail_tools = [
    get_fleet_overview,
    count_issues,
    get_train_summary,
    list_issues,
    generate_maintenance_plan_stream,
    request_bulk_issue_status_update,
    write_document,   # <-- tool dùng cho edit description
]
```

---

## 4. Backend Agent – System Prompt & Logic xử lý tool call

**File:** `apps/agent/main.py`

```python
async def chat_node(state: AgentState, config: Optional[RunnableConfig] = None) -> Command:
    # Extract copilotkit context from frontend
    frontend_context = ""
    ck_context = state.get("copilotkit", {}).get("context", [])
    if ck_context:
        frontend_context = "\nFRONTEND CONTEXT (useCopilotReadable):\n"
        for item in ck_context:
            desc = item.get("description", "Context")
            val = item.get("value", "")
            frontend_context += f"- {desc}:\n{val}\n\n"

    system_prompt = (
        "You are a helpful AI assistant for a Rail Inspection Dashboard. "
        "You have a direct view of the current document and the list of diagnostic issues (tickets) reported for the carriage.\n\n"
        
        "COMMUNICATION RULES:\n"
        "1. ALWAYS respond and comment in ENGLISH.\n"
        "2. If the user asks to fix grammar without specifying an ID, and there is a 'CURRENTLY FOCUSED ISSUE', "
        "YOU MUST use the 'write_document' tool to replace its content. Do NOT ask for an issue ID in this case.\n"
        "3. If the user explicitly asks to fix a specific ticket ID (e.g., ISS-1001) that is NOT focused, "
        "use the 'proposeIssueDescriptionFix' tool.\n"
        "4. Be proactive. Do not ask the user for the old or new description if they are already visible in the context.\n\n"
        
        "DOCUMENT EDITING:\n"
        "1. To write or fix the focused report, you MUST use the 'write_document' tool.\n"
        "2. You MUST write the full document, even when changing only a few words.\n"
        "3. DO NOT repeat the document content as a plain text message.\n"
        "4. Briefly summarize the changes you made in 2 sentences max.\n\n"
        
        f"{frontend_context}"
        f"CURRENT DOCUMENT (FOCUSED ISSUE):\n----\n{state.get('document')}\n----\n"
        "Note: Check the tool definitions and available context for the list of issues and their IDs."
    )

    model = ChatGoogleGenerativeAI(
        model=MODEL_NAME,
        google_api_key=gemini_api_key,
        timeout=45,
        max_retries=2,
    )

    model_with_tools = model.bind_tools(rail_tools)

    response = await model_with_tools.ainvoke(
        [SystemMessage(content=system_prompt), *state["messages"]],
        config,
    )

    messages = state["messages"] + [response]

    # Nếu AI gọi tool (write_document), cập nhật state.document và kết thúc để frontend xử lý (HITL)
    tool_calls = getattr(response, "tool_calls", [])
    if tool_calls:
        tool_call = tool_calls[0]
        tc_args = tool_call["args"] if isinstance(tool_call, dict) else tool_call.args
        
        return Command(
            goto=END,
            update={
                "messages": messages, 
                "document": tc_args.get("document") if isinstance(tc_args, dict) else getattr(tc_args, "document", state.get("document"))
            },
        )

    return Command(goto=END, update={"messages": messages})


# Graph definition
workflow = StateGraph(AgentState)
workflow.add_node("start_node", start_node)
workflow.add_node("chat_node", chat_node)
workflow.set_entry_point("start_node")
workflow.add_edge(START, "start_node")
workflow.add_edge("start_node", "chat_node")
workflow.add_edge("chat_node", END)

graph = workflow.compile(checkpointer=MemorySaver() if _is_fast_api else None)
```

---

## 5. CarriageDetailsModal – Container chính quản lý state editing

**File:** `apps/app/src/features/rail-dashboard/components/CarriageDetailsModal.tsx`

### 5a. State management

```typescript
const [selectedIssue, setSelectedIssue] = useState(null);
const [editedDescriptions, setEditedDescriptions] = useState({});
// editedDescriptions: { [issueId: string]: string }
// Lưu description đã edit theo từng issue ID, không thay đổi data gốc
```

### 5b. CopilotKit Readable – Truyền context lên AI

```typescript
// Danh sách tất cả issues (kèm description hiện tại sau khi edit)
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

// Issue đang được focus/edit (để AI biết dùng write_document cho issue nào)
useCopilotReadable({
  description: "CURRENTLY FOCUSED ISSUE (PREDICTIVE EDITING TARGET): This is the issue the user is actively editing right now in the DocumentEditor. If the user asks to rewrite, fix grammar, or improve 'this issue', YOU MUST use the 'write_document' tool to replace its content.",
  value: selectedIssue ? {
    id: selectedIssue.id,
    currentTextEditing: editedDescriptions[selectedIssue.id] || selectedIssue.description
  } : "User is not actively editing any specific issue right now.",
});
```

### 5c. CopilotKit Action – `proposeIssueDescriptionFix` (cho issue không được focus)

```typescript
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
```

### 5d. Issue selection handlers

```typescript
const handleSelectIssue = useCallback((issue) => {
  setSelectedIssue(prev => prev?.id === issue.id ? null : issue);
}, []);

const handleCloseEditor = useCallback(() => {
  setSelectedIssue(null);
}, []);
```

### 5e. Render Panel 2 – Issue List

```typescript
{filteredIssues.map(issue => (
  <IssueCard
    key={issue.id}
    issue={issue}
    isSelected={selectedIssue?.id === issue.id}
    onSelect={handleSelectIssue}
    editedDescription={editedDescriptions[issue.id]}  // truyền edited text xuống card
  />
))}
```

### 5f. Render Panel 3 – Document Editor (slide in khi chọn issue)

```typescript
const editorOpen = !!selectedIssue;

{editorOpen && (
  <div className="flex-3 flex flex-col bg-white overflow-hidden">
    {/* Editor header */}
    <div className="px-5 py-3 border-b border-slate-100 bg-white shrink-0 flex items-center justify-between">
      <button onClick={handleCloseEditor}>
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>
      <span className="text-xs font-mono font-bold">{selectedIssue.id}</span>
      <span className={getPriorityStyle(selectedIssue.priority)}>{selectedIssue.priority}</span>
    </div>

    {/* Editor body */}
    <div className="flex-1 overflow-y-auto p-6">
      <DocumentEditor
        key={selectedIssue.id}
        initialValue={editedDescriptions[selectedIssue.id] || selectedIssue.description}
        onChange={(val) => setEditedDescriptions(prev => ({ ...prev, [selectedIssue.id]: val }))}
        className="relative min-h-full w-full bg-white"
        agentId="sample_agent"
      />
    </div>

    {/* Inline AI Chat */}
    <div className="shrink-0">
      <InlineAiChat />
    </div>
  </div>
)}
```

---

## 6. IssueCard – Hiển thị description (có hỗ trợ edited text)

**File:** `apps/app/src/features/rail-dashboard/components/IssueCard.tsx`

```typescript
export function IssueCard({ 
  issue, 
  isSelected, 
  onSelect, 
  editedDescription   // nếu có → dùng edited text thay vì gốc
}: { 
  issue: any; 
  isSelected: boolean; 
  onSelect: (issue: any) => void; 
  editedDescription?: string 
}) {
  const description = editedDescription || issue.description;  // ưu tiên edited

  return (
    <button
      onClick={() => onSelect(issue)}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group ${
        isSelected
          ? 'bg-blue-50 border-blue-300 shadow-md ring-2 ring-blue-200'
          : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-sm'
      }`}
    >
      {/* Top row: ID + Priority */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            {issue.id}
          </span>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getPriorityStyle(issue.priority)}`}>
            {issue.priority}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <AssigneeAvatar assignee={issue.assignee} />
          {isSelected && (
            <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
              Editing
            </span>
          )}
        </div>
      </div>

      {/* Description preview (2 dòng tối đa, hiện edited text nếu có) */}
      <p className="text-sm text-slate-700 leading-snug line-clamp-2 mb-3">
        {description}
      </p>

      {/* Bottom row: System + Status + Edit hint */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1">
          {/* system icon */}
          <span className="font-medium">{issue.system}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full border font-medium capitalize ${
            issue.status === 'open'
              ? 'bg-red-50 text-red-500 border-red-200'
              : 'bg-blue-50 text-blue-500 border-blue-200'
          }`}>
            {issue.status.replace('-', ' ')}
          </span>
          {!isSelected && (
            <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-blue-500">
              <Pencil className="w-3 h-3" />
              Edit
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
```

### InlineAiChat – Chat AI nhúng trong editor panel

```typescript
export function InlineAiChat() {
  return (
    <div className="shrink-0 border-t border-violet-100 bg-gradient-to-b from-white to-violet-50/30 flex flex-col h-[280px]">
      <div className="flex-1 overflow-hidden">
        <CopilotChat
          agentId="sample_agent"
          className="h-full flex flex-col"
        />
      </div>
    </div>
  );
}
```

---

## 7. DocumentEditor – Rich text editor với TipTap + AI diff

**File:** `apps/app/src/features/document-editor/components/DocumentEditor.tsx`

```typescript
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

  // --- State ---
  const [pendingDiffData, setPendingDiffData] = useState<{ old: string; new: string } | null>(null);
  const [currentDocument, setCurrentDocument] = useState(initialValue);
  const [placeholderVisible, setPlaceholderVisible] = useState(false);

  const lastValueRef = useRef(initialValue);
  const isLoadingRef = useRef(false);
  const isPendingDiffRef = useRef(false); // Lock editor khi đang review diff
  const wasRunning = useRef(false);
  const lastInitialValueRef = useRef(initialValue);

  // --- TipTap Editor ---
  const editor = useEditor({
    extensions,
    content: fromMarkdown(initialValue),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        // em = added (xanh lá), s = removed (đỏ) - dùng cho diff visualization
        class: "p-4 focus:outline-none min-h-[inherit] [&_em]:bg-emerald-100 [&_em]:text-emerald-800 [&_em]:not-italic [&_em]:rounded-sm [&_em]:px-0.5 [&_s]:bg-rose-100 [&_s]:text-rose-800 [&_s]:line-through [&_s]:rounded-sm [&_s]:px-0.5"
      },
    },
    onUpdate: ({ editor }) => {
      // Không lưu intermediate diff HTML khi AI đang chạy hoặc đang review
      if (isLoadingRef.current || isPendingDiffRef.current) return;
      const currentText = editor.getText();
      if (currentText !== lastValueRef.current) {
        lastValueRef.current = currentText;
        onChange?.(currentText);
      }
    }
  });

  // --- CopilotKit Agent Hook ---
  const { agent } = useAgent({
    agentId: agentId,
    updates: [UseAgentUpdate.OnStateChanged, UseAgentUpdate.OnRunStatusChanged],
  });

  const agentState = agent.state as AgentState | undefined;
  const setAgentState = useCallback((s: AgentState) => agent.setState(s), [agent]);
  const isLoading = agent.isRunning;

  // --- Ticket switching: reset editor khi chuyển sang issue khác ---
  useEffect(() => {
    if (initialValue !== lastInitialValueRef.current) {
      lastInitialValueRef.current = initialValue;

      // Reset tất cả flags để tránh dữ liệu ticket cũ trigger HITL
      wasRunning.current = false;
      isPendingDiffRef.current = false;
      setPendingDiffData(null);

      setCurrentDocument(initialValue);
      lastValueRef.current = initialValue;

      if (editor) {
        editor.commands.setContent(fromMarkdown(initialValue));
      }

      // Cập nhật Agent state ngay để tránh so sánh sai ticket
      setAgentState({ document: initialValue });
    }
  }, [initialValue, editor, setAgentState]);

  // --- AI Run Detection & HITL Trigger ---
  useEffect(() => {
    // Stage A: AI bắt đầu chạy → chụp snapshot hiện tại
    if (isLoading && !wasRunning.current) {
      const snapshot = editor?.getText() || "";
      setCurrentDocument(snapshot);
      isLoadingRef.current = true;
    }

    // Stage B: AI chạy xong → so sánh snapshot vs kết quả AI → hiện diff
    if (!isLoading && wasRunning.current) {
      isLoadingRef.current = false;
      const finalAIDoc = agentState?.document || "";

      if (finalAIDoc !== currentDocument && finalAIDoc !== "") {
        const diff = diffPartialText(currentDocument, finalAIDoc, true);
        editor?.commands.setContent(fromMarkdown(diff));

        // Lock editor, chờ user confirm/reject
        setPendingDiffData({ old: currentDocument, new: finalAIDoc });
        isPendingDiffRef.current = true;
      }
    }

    wasRunning.current = isLoading;
    editor?.setEditable(!isLoading); // Disable editor khi AI đang chạy
  }, [isLoading, agentState?.document, editor, currentDocument]);

  // --- Real-time streaming: cập nhật editor theo agent state trong lúc AI chạy ---
  useEffect(() => {
    if (isLoading) {
      const newDocument = agentState?.document || "";
      const diff = currentDocument.trim().length > 0
        ? diffPartialText(currentDocument, newDocument)
        : newDocument;
      editor?.commands.setContent(fromMarkdown(diff));
    }
  }, [agentState?.document, isLoading, currentDocument, editor]);

  // --- Sync human typing → Agent state ---
  useEffect(() => {
    const text = editor?.getText() || "";
    setPlaceholderVisible(text.length === 0);

    if (!isLoading && !isPendingDiffRef.current && text !== agentState?.document) {
      setCurrentDocument(text);
      setAgentState({ document: text });
    }
  }, [editor?.getText(), isLoading, setAgentState, agentState?.document]);

  // --- HITL Handlers ---
  const handleConfirmDiff = useCallback(() => {
    if (!pendingDiffData) return;
    const finalDoc = pendingDiffData.new;

    isPendingDiffRef.current = false;
    editor?.commands.setContent(fromMarkdown(finalDoc));
    lastValueRef.current = finalDoc;
    setCurrentDocument(finalDoc);
    setAgentState({ document: finalDoc });
    onChange?.(finalDoc);    // cập nhật lên CarriageDetailsModal → editedDescriptions

    setPendingDiffData(null);
  }, [pendingDiffData, editor, setAgentState, onChange]);

  const handleRejectDiff = useCallback(() => {
    if (!pendingDiffData) return;
    const oldDoc = pendingDiffData.old;

    isPendingDiffRef.current = false;
    editor?.commands.setContent(fromMarkdown(oldDoc));
    lastValueRef.current = oldDoc;
    setCurrentDocument(oldDoc);
    setAgentState({ document: oldDoc });
    onChange?.(oldDoc);

    setPendingDiffData(null);
  }, [pendingDiffData, editor, setAgentState, onChange]);

  // --- Chat Suggestions ---
  useConfigureSuggestions({
    suggestions: [
      { title: "Fix grammar & tone", message: "Fix the grammar, spelling, and tone of the current description." },
      { title: "Professional rewrite", message: "Rewrite the current description to be more professional and technically detailed." },
      { title: "Help me expand", message: "Expand on the current issue description with more specific technical details." },
      { title: "Fix all issues", message: "Briefly summarize and propose fixes for all reported issues in this carriage." },
      { title: "Write final report", message: "Write a comprehensive maintenance report based on all identified issues." },
    ],
    available: (agentId === "sample_agent" ? "always" : "disabled") as any,
  });

  // --- Human In The Loop (HITL) Hook ---
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

  // --- CopilotKit Action: write_document (frontend side) ---
  useCopilotAction({
    name: "write_document",
    available: "remote",
    parameters: [{ name: "document", type: "string", required: true }],
    handler: async () => "Awaiting user review in editor...",
    render: ({ status }) => (
      <div className={`p-3 text-sm rounded-xl border ${
        status === "executing" 
          ? "bg-emerald-50 text-emerald-700 animate-pulse border-emerald-100" 
          : "bg-slate-50 text-slate-600 border-slate-200"
      }`}>
        {status === "executing" ? "Drafting changes in editor..." : "Review changes in editor."}
      </div>
    ),
  }, [agentId]);

  // --- Render ---
  return (
    <div className={className}>
      {placeholderVisible && (
        <div className="absolute top-4 left-4 pointer-events-none text-gray-400">Type here...</div>
      )}
      <EditorContent editor={editor} />

      {/* Manual UI Fallback cho Pending Diffs (draggable floating card) */}
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
```

---

## 8. ConfirmChanges – UI xác nhận/từ chối thay đổi của AI

**File:** `apps/app/src/features/document-editor/components/ConfirmChanges.tsx`

```typescript
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

  // Trạng thái sau khi user đã quyết định
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

  // Card xác nhận (draggable floating)
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
```

---

## 9. Editor Utilities – Markdown render & Diff computation

**File:** `apps/app/src/features/document-editor/utils/editor-utils.ts`

```typescript
import MarkdownIt from "markdown-it";
import { diffWords } from "diff";

// Chuyển markdown text → HTML cho TipTap
export function fromMarkdown(text: string) {
  const md = new MarkdownIt({
    typographer: true,
    html: true,
  });
  return md.render(text);
}

// So sánh oldText vs newText, tạo HTML diff:
//   <em>added words</em>    → highlight xanh lá trong editor
//   <s>removed words</s>   → highlight đỏ + gạch ngang trong editor
export function diffPartialText(oldText: string, newText: string, isComplete: boolean = false) {
  let oldTextToCompare = oldText;
  if (oldText.length > newText.length && !isComplete) {
    // Khi AI đang stream, cắt ngắn oldText để so sánh realtime
    oldTextToCompare = oldText.slice(0, newText.length);
  }

  const changes = diffWords(oldTextToCompare, newText);

  let result = "";
  changes.forEach((part) => {
    if (part.added) {
      result += `<em>${part.value}</em>`;    // xanh lá
    } else if (part.removed) {
      result += `<s>${part.value}</s>`;      // đỏ + gạch ngang
    } else {
      result += part.value;                  // không thay đổi
    }
  });

  if (oldText.length > newText.length && !isComplete) {
    result += oldText.slice(newText.length); // phần còn lại của oldText
  }

  return result;
}
```

---

## 10. Luồng dữ liệu (Data Flow Diagram)

```
User clicks issue card (IssueCard)
         │
         ▼
handleSelectIssue() → setSelectedIssue(issue)
         │
         ▼
Panel 3 (DocumentEditor) mở ra
  - initialValue = editedDescriptions[issue.id] || issue.description
  - agentId = "sample_agent"
         │
         ├─── User gõ thủ công
         │         │
         │         ▼
         │    editor.onUpdate → onChange(text)
         │         │
         │         ▼
         │    setEditedDescriptions({ [issueId]: text })
         │    setAgentState({ document: text })
         │
         └─── User hỏi AI qua InlineAiChat
                   │
                   ▼
              AI (Gemini) nhận context:
               - CURRENTLY FOCUSED ISSUE (useCopilotReadable)
               - state.document (AgentState)
               - System prompt rules
                   │
                   ▼
              AI gọi write_document(newText)
                   │
                   ▼
              AgentState.document = newText (backend Command)
                   │
                   ▼
              useAgent() hook: isRunning → false
              wasRunning → true → Stage B triggered
                   │
                   ▼
              diffPartialText(snapshot, newText, true)
              → HTML diff với <em> và <s>
                   │
                   ▼
              editor.setContent(diffHTML)
              setPendingDiffData({ old, new })
              isPendingDiffRef = true (lock editor)
                   │
                   ▼
              ConfirmChanges UI xuất hiện (floating / HITL)
                   │
              ┌────┴────┐
              │         │
            Confirm   Reject
              │         │
              ▼         ▼
          handleConfirmDiff  handleRejectDiff
              │         │
              ▼         ▼
        editor = new   editor = old
        onChange(new)  onChange(old)
        setEditedDescriptions updated
```

---

## 11. Hai luồng AI editing

### Luồng A: Focused Issue (issue đang mở trong DocumentEditor)

AI sử dụng tool `write_document` → cập nhật `AgentState.document` → frontend hiện diff → user confirm/reject.

### Luồng B: Non-focused Issue (issue không được mở trong editor)

AI sử dụng action `proposeIssueDescriptionFix` (định nghĩa ở frontend trong `CarriageDetailsModal`) → frontend hiện `ConfirmChanges` → user confirm → `setEditedDescriptions({ [issueId]: newDescription })`.

---

## Danh sách file liên quan

| File | Vai trò |
|------|---------|
| `apps/app/src/features/rail-dashboard/components/CarriageDetailsModal.tsx` | Container chính: state `selectedIssue`, `editedDescriptions`, CopilotKit readable/action |
| `apps/app/src/features/rail-dashboard/components/IssueCard.tsx` | Hiển thị issue preview với `editedDescription` prop |
| `apps/app/src/features/document-editor/components/DocumentEditor.tsx` | TipTap editor + AI diff + HITL hooks |
| `apps/app/src/features/document-editor/components/ConfirmChanges.tsx` | UI Confirm/Reject floating card |
| `apps/app/src/features/document-editor/utils/editor-utils.ts` | `fromMarkdown()` + `diffPartialText()` |
| `apps/agent/src/rail_data.py` | Backend tool `write_document` |
| `apps/agent/src/state.py` | `AgentState` với field `document` |
| `apps/agent/main.py` | `chat_node` với system prompt + xử lý tool call → cập nhật `state.document` |
