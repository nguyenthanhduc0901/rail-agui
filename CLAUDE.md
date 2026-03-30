# Rail AI Dashboard (CopilotKit + LangGraph)

## Purpose
This repo is a starter template for building an AI-assisted rail operations dashboard.

It demonstrates:
- A Next.js frontend with CopilotKit chat + frontend tools
- A LangGraph backend agent with domain tools
- A shared workflow where AI helps inspect fleet status and maintenance issues

## Current Scope
This project is a **rail dashboard demo**, not the old todo demo.

Core UX:
- Inspect trains, carriages, and issues
- Ask the agent for summaries and recommendations
- Let the agent trigger frontend actions (theme toggle, mode switch, issue card rendering)

## Monorepo Structure

```text
apps/
├── app/      # Next.js frontend
├── agent/    # LangGraph Python agent
└── mcp/      # MCP integration
```

Key frontend files:
- `apps/app/src/app/layout.tsx`
- `apps/app/src/app/api/copilotkit/route.ts`
- `apps/app/src/features/rail-dashboard/RailDashboardApp.jsx`
- `apps/app/src/hooks/use-generative-ui-examples.tsx`
- `apps/app/src/hooks/use-example-suggestions.tsx`

Key backend files:
- `apps/agent/main.py`
- `apps/agent/src/rail_data.py`
- `apps/agent/src/state.py`

## CopilotKit v2 Setup (Current)

Frontend package versions:
- `@copilotkit/react-core`: `1.54.1`
- `@copilotkit/runtime`: `1.54.1`

Backend package version:
- `copilotkit==0.1.78` (Python)

Frontend imports use v2 path:
- `@copilotkit/react-core/v2`
- `@copilotkit/react-core/v2/styles.css`

### Important Runtime Compatibility Note
This repo currently uses a **single runtime endpoint** in Next.js:
- `POST /api/copilotkit`

Because of that, provider config in `layout.tsx` uses:
- `CopilotKitProvider`
- `runtimeUrl="/api/copilotkit"`
- `useSingleEndpoint`

This avoids 404 errors from nested REST-style paths like `/api/copilotkit/agent/default/run`.

## Migration Notes (v1 -> v2)
- `useCopilotReadable` context injection is removed from this project.
- Prefer v2 patterns: `useAgent`, frontend tools, and structured tool rendering.
- Migration reference:
  - https://docs.copilotkit.ai/langgraph/troubleshooting/migrate-to-v2

## Backend Runtime Route
`apps/app/src/app/api/copilotkit/route.ts` wires:
- `CopilotRuntime`
- `LangGraphAgent` (default agent)
- `copilotRuntimeNextJSAppRouterEndpoint`

Current agent mapping:
- Agent id: `default`
- LangGraph graph id: `sample_agent`
- Deployment URL: `LANGGRAPH_DEPLOYMENT_URL` or `http://localhost:8123`

## Development

From repo root:

```bash
pnpm install
pnpm dev
```

Useful scripts:
- `pnpm dev:app`
- `pnpm dev:agent`
- `pnpm dev:mcp`
- `pnpm build`
- `pnpm lint`

Agent environment:

```bash
# apps/agent/.env
GEMINI_API_KEY=your-key-here
```

## Design Principles
- Keep architecture simple and inspectable
- Keep CopilotKit integration explicit and version-safe
- Prefer domain tools over prompt-only answers
- Avoid unnecessary client-side context flooding

## Extension Guidance
When extending this template:
- Add/modify backend tools in `apps/agent/src/rail_data.py`
- Keep agent state schema in `apps/agent/src/state.py`
- Add frontend tools/renderers in `apps/app/src/hooks/use-generative-ui-examples.tsx`
- Keep runtime endpoint and provider transport mode aligned
