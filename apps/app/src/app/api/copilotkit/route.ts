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

const safeString = (value: unknown, max = 180) => {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return text.length > max ? `${text.slice(0, max)}...` : text;
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
  const startTime = Date.now();
  
  if (isCopilotDebug) {
    try {
      const body = await req.clone().json();
      const messages = Array.isArray(body?.messages) ? body.messages : [];
      const contexts = Array.isArray(body?.context) ? body.context : [];
      const messagesBytes = JSON.stringify(messages).length;
      const contextBytes = JSON.stringify(contexts).length;
      const lastUserMessage = [...messages]
        .reverse()
        .find((message: { role?: string }) => message?.role === "user");

      console.log("[copilot] incoming request", {
        messageCount: messages.length,
        contextCount: contexts.length,
        messagesBytes,
        contextBytes,
        lastUserPreview: safeString(lastUserMessage?.content),
      });
    } catch (error) {
      console.log("[copilot] unable to inspect request body", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
      endpoint: "/api/copilotkit",
      serviceAdapter: new ExperimentalEmptyAdapter(),
      runtime: new CopilotRuntime({
        agents: { default: defaultAgent },
        a2ui: { injectA2UITool: true },
      }),
    });

    const response = await handleRequest(req);
    
    if (isCopilotDebug) {
      const elapsed = Date.now() - startTime;
      console.log("[copilot] outgoing response", {
        status: response.status,
        elapsed: elapsed + "ms",
      });
    }
    
    return response;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error("[copilot] error", {
      error: error instanceof Error ? error.message : String(error),
      elapsed: elapsed + "ms",
    });
    
    throw error;
  }
};
