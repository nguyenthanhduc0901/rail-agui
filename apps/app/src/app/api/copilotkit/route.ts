import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";
import { NextRequest } from "next/server";

const isCopilotDebug =
  process.env.COPILOT_DEBUG === "1" ||
  process.env.NEXT_PUBLIC_COPILOT_DEBUG === "1";

const safeStr = (v: unknown, max = 180) => {
  const t = typeof v === "string" ? v : JSON.stringify(v ?? "");
  return t.length > max ? `${t.slice(0, max)}...` : t;
};

// 1. Define the agent connection to LangGraph
const defaultAgent = new LangGraphAgent({
  deploymentUrl:
    process.env.LANGGRAPH_DEPLOYMENT_URL || "http://localhost:8123",
  graphId: "sample_agent",
  langsmithApiKey: process.env.LANGSMITH_API_KEY || "",
});

// 3. Define the route and CopilotRuntime for the agent
export const POST = async (req: NextRequest) => {
  if (isCopilotDebug) {
    try {
      const body = await req.clone().json();
      const messages = Array.isArray(body?.messages) ? body.messages : [];
      const lastUser = [...messages].reverse().find((m: { role?: string }) => m?.role === "user");
      console.log("[copilot]", {
        messageCount: messages.length,
        bytes: JSON.stringify(messages).length,
        last: safeStr(lastUser?.content),
      });
    } catch { /* ignore */ }
  }

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    endpoint: "/api/copilotkit",
    serviceAdapter: new ExperimentalEmptyAdapter(),
    runtime: new CopilotRuntime({
      agents: { default: defaultAgent },
      a2ui: { injectA2UITool: true },
    }),
  });

  return handleRequest(req);
};
