"use client";

import { useEffect } from "react";
import { useAgent } from "@copilotkit/react-core/v2";

const MAX_MESSAGES = 5;

export const useChatHistoryGuard = () => {
  const { agent } = useAgent();

  useEffect(() => {
    if (!agent?.messages) return;
    
    const messageCount = agent.messages.length;
    const isRunning = agent.isRunning;
    
    // Only log on changes
    console.log("[guard] check", { messageCount, isRunning, maxMessages: MAX_MESSAGES });
    
    if (isRunning) {
      console.log("[guard] agent running, skip trim");
      return;
    }
    
    if (messageCount <= MAX_MESSAGES) {
      return;
    }
    
    const trimmed = agent.messages.slice(-MAX_MESSAGES);
    console.log("[guard] trimming from", messageCount, "to", trimmed.length);
    agent.setMessages(trimmed);
  }, [agent]);
};
