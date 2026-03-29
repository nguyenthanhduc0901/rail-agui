# AG UI Chatbot (Rail Ops)

Production monorepo for a rail operations dashboard powered by CopilotKit + LangGraph.

## What is inside

- apps/app: Next.js frontend (dashboard + copilot chat)
- apps/agent: LangGraph Python agent with rail maintenance tools
- apps/mcp: MCP integration app

## Tech stack

- Frontend: Next.js 16, React 19, Tailwind CSS 4
- Agent: LangGraph, LangChain, Gemini
- Monorepo: Turborepo + pnpm workspaces

## Prerequisites

- Node.js 18+
- pnpm 9+
- Python 3.12+
- GEMINI_API_KEY

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Configure environment:

```bash
cp .env.example .env
```

Set:

```bash
GEMINI_API_KEY=your-key
```

Optional debug/tracing (recommended when investigating chatbot lag/crash):

```bash
COPILOT_DEBUG=1
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=your-langsmith-api-key
LANGSMITH_PROJECT=rail-agui
AGENT_TOOL_DEBUG=1
```

3. Run all services:

```bash
pnpm dev
```

## Useful scripts

- pnpm dev:app
- pnpm dev:agent
- pnpm dev:mcp
- pnpm build
- pnpm lint

## Debugging Prompt Flow

When `COPILOT_DEBUG=1`, the Next.js runtime route logs request metadata to server console:

- number of messages sent to runtime
- number of context blocks
- bytes for messages and context separately
- serialized body size
- preview of the last user message

When `AGENT_TOOL_DEBUG=1`, the agent logs each tool call and key metadata
(filters, limits, result size) to the agent console.

For full LLM trace (prompt/tool execution/latency), use LangSmith:

1. Set `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY` in `.env`
2. Run `pnpm dev`
3. Open LangSmith project `rail-agui` to inspect each run timeline

Note: You can inspect prompt/tool trajectory, but not private chain-of-thought tokens.

## Agent Data Retrieval Policy

- Frontend does not inject rail dataset context per prompt.
- Agent retrieves task-specific data via backend tools on demand.
- Social chat replies (hi/hello/chào/cảm ơn) should not trigger data tools.
- Numeric operational claims must come from tool outputs from the same turn.

## Data model notes

- Dashboard data source is centralized in:
  - apps/app/src/features/rail-dashboard/data/railDataSource.js
- Static dataset is in:
  - apps/app/src/features/rail-dashboard/data/rail-data.json

## License

MIT
