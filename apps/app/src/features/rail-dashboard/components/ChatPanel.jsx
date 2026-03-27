"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Minus } from "lucide-react";

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant",
  content:
    "Xin chào! Tôi là trợ lý AI cho hệ thống vận hành đường sắt. Tôi có thể giúp bạn theo dõi đội tàu, kiểm tra trạng thái toa xe và xử lý sự cố.",
};

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [messages] = useState([WELCOME_MESSAGE]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Logic gửi tin nhắn sẽ được định nghĩa sau
    }
  };

  const panelHeightClass = isMinimized ? "h-[52px]" : "h-[520px]";

  return (
    <>
      {/* Floating toggle button — chỉ hiển thị khi panel đóng */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 active:scale-95 transition-all"
          title="Mở trợ lý AI"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex w-[380px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-200 ${panelHeightClass}`}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between bg-emerald-600 px-4 py-3">
            <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized((v) => !v)}
                className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                title={isMinimized ? "Mở rộng" : "Thu nhỏ"}
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                title="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body — ẩn khi thu nhỏ */}
          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
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
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "rounded-tr-none bg-emerald-600 text-white"
                          : "rounded-tl-none bg-white text-slate-700 shadow-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="shrink-0 border-t border-slate-200 bg-white p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Nhập câu hỏi... (Enter để gửi)"
                    rows={1}
                    className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:outline-none transition-colors"
                  />
                  <button
                    disabled={!input.trim()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
                    title="Gửi"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400 text-center">
                  Shift+Enter để xuống dòng
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
