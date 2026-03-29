"use client";

import { useEffect } from "react";
import { useAgent } from "@copilotkit/react-core/v2";

const MAX_MESSAGES = 5;

export const useChatHistoryGuard = () => {
  const { agent } = useAgent();

  useEffect(() => {
    if (agent.isRunning) return;
    const messages = agent.messages ?? [];
    if (messages.length <= MAX_MESSAGES) return;
    agent.setMessages(messages.slice(-MAX_MESSAGES));
  }, [agent]);
};
