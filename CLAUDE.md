# Interactive Chat

A chat interface where LLM responses are rendered as interactive widgets instead of plain text. See `product.md` for the full concept and `spec.md` for the detailed spec.

## Quick Start

```bash
pnpm install
pnpm dev          # Start frontend + backend dev servers
pnpm test         # Backend unit tests (Vitest)
pnpm test:e2e     # E2e tests (Playwright, starts mock servers automatically)
pnpm -r build     # Type-check and build everything
```

Requires `ANTHROPIC_API_KEY` and `BRAVE_SEARCH_API_KEY` in `backend/.env`.

## Slash Commands

- `/implement` — Full workflow for adding features: spec update → plan → code → tests → QA. Always use this for code changes.
- `/demo` — Record a demo by capturing screenshots via Playwright MCP. Includes QA pass on all screenshots.
- `/presentation` — Create or update the Marp slide deck.

## Architecture

- **Frontend**: React 19 + Vite (`frontend/`)
- **Backend**: Hono + Node.js (`backend/`), proxies to Anthropic Claude, streams responses via SSE
- **Tools**: Modular `Toolset` interface — currently `createWebSearchToolset()` using Brave Search API
- **Testing**: Vitest for backend unit tests, Playwright for e2e. Only the LLM layer is mocked (`createMockProvider`).

## Key Files

- `backend/src/routes/chat.ts` — System prompt + chat route
- `backend/src/services/llm.ts` — LLM provider (Anthropic + mock)
- `backend/src/services/toolset.ts` — Tool definitions (web search)
- `frontend/src/hooks/useChat.ts` — Chat state, SSE parsing, widget state management
- `frontend/src/components/BlockRenderer.tsx` — Renders all 9 block types
- `frontend/src/index.css` — All styling
