"use client";

import { useAgent } from "@copilotkit/react-core/v2";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Bot, Send } from "lucide-react";

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant",
  content:
    "Xin chào! Tôi là trợ lý AI cho hệ thống vận hành đường sắt. Tôi có thể giúp bạn theo dõi đội tàu, kiểm tra trạng thái toa xe và xử lý sự cố.",
};

function extractMessageText(content) {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          if (typeof part.text === "string") return part.text;
          if (typeof part.content === "string") return part.content;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  if (typeof content === "object" && typeof content.text === "string") {
    return content.text;
  }
  return "";
}

export function ChatPanel() {
  const { agent } = useAgent();
  const [input, setInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const messagesEndRef = useRef(null);

  const messages = useMemo(() => {
    const normalizedAgentMessages = (agent.messages || [])
      .filter((msg) => msg?.role === "user" || msg?.role === "assistant")
      .map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: extractMessageText(msg.content),
      }))
      .filter((msg) => msg.content.trim().length > 0);

    return [WELCOME_MESSAGE, ...normalizedAgentMessages];
  }, [agent.messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agent.isRunning]);

  const sendMessage = useCallback(async () => {
    const userInput = input.trim();
    if (!userInput || agent.isRunning) return;

    setErrorMessage("");
    setInput("");

    try {
      agent.addMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: userInput,
      });
      await agent.runAgent();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Đã xảy ra lỗi khi gọi agent.",
      );
    }
  }, [agent, input]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <aside className="h-screen w-full max-w-[360px] shrink-0 border-l border-slate-200 bg-white shadow-sm">
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-emerald-600 px-4 py-3">
          <Bot className="h-5 w-5 text-white" />
          <div>
            <p className="text-sm font-semibold text-white leading-tight">
              Rail AI Assistant
            </p>
            <p className="text-[11px] text-emerald-200 leading-tight">
              Trợ lý vận hành đường sắt
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3 bg-slate-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <Bot className="h-4 w-4 text-emerald-600" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "rounded-tr-none bg-emerald-600 text-white"
                    : "rounded-tl-none bg-white text-slate-700 shadow-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {agent.isRunning && (
            <div className="flex gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <Bot className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-tl-none bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                Đang xử lý...
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {errorMessage}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập câu hỏi... (Enter để gửi)"
              rows={2}
              disabled={agent.isRunning}
              className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:outline-none transition-colors"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || agent.isRunning}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
              title="Gửi"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400 text-center">
            Shift+Enter để xuống dòng
          </p>
        </div>
      </div>
    </aside>
  );
}
