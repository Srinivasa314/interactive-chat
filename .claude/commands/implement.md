Implement a feature or improvement for the Interactive Chat project.

Input: $ARGUMENTS

## Workflow

Follow these steps in order. Do NOT skip steps or combine them.

### Step 1: Spec

- Read `product.md` for overall product context and the current detailed spec in `spec.md`.
- Carefully read the input description above.
- Ask clarifying questions if the requirements are ambiguous. Do not guess — ask.
- Update `spec.md` to incorporate the new feature/change. This is the single source of truth for what the product does. Keep it detailed and current.
- Confirm the spec changes with the user before proceeding.

### Step 2: Plan

- Enter plan mode to design the implementation.
- Identify which files need to be created or modified.
- Outline the approach at a high level — key types, components, routes, services.
- Call out any non-obvious decisions or trade-offs.
- Exit plan mode and present the full implementation plan to the user.
- **STOP and wait for explicit user approval before writing any code.** Do not proceed to Step 3 until the user confirms the plan.

### Step 3: Code

- Implement the plan. Write clean, minimal code — no speculative abstractions.
- Follow existing patterns in the codebase (Hono routes, Vitest tests, React components, etc.).
- After writing code, run `pnpm -r build` to verify there are no type errors.

### Step 4: QA

The ONLY thing mocked is the LLM layer. `createMockProvider(entries, fallback)` in `backend/src/services/llm.ts` is a map from full conversation message arrays to responses — it deep-compares the entire `messages` array against each entry. No other mocking anywhere. No React DOM testing — DOM assertions happen in e2e only.

- **Backend tests** (Vitest): Business logic, Hono routes via `app.request()`, SSE streaming, request parsing, error handling. Use `createApp(createMockProvider(entries, fallback))` — entries are `{ messages: ConversationMessage[], response: object }[]`, fallback is the default response when no entry matches.
- **E2e tests** (Playwright): Full browser tests against real frontend+backend dev servers. Backend runs with `MOCK_LLM=true`. The e2e mock in `backend/src/index.ts` uses `createMockProvider` with explicit entries mapping full conversation histories (including synthetic widget interaction messages) to responses, plus a fallback for any unmatched input. To add test coverage for new interactions, add new entries with the exact expected message history → response mapping.
- **Test coverage checklist** — Before finishing, review existing tests and ensure coverage for:
  - The specific feature being implemented (not just regression — write NEW tests for new behavior)
  - Happy path: the feature works as intended
  - Edge cases: empty inputs, missing fields, error states
  - Integration: the feature works end-to-end (e2e test)
  - If the feature changes the response format, update mock responses in both `backend/src/index.ts` (e2e mock) and `backend/src/__tests__/chat.test.ts` (unit mock)
- Run `pnpm test` and fix any failures.
- Run `pnpm test:e2e` and fix any failures.
- **UAT** (optional): Use the Playwright MCP tools to directly interact with the running app in a real browser — navigate, click, type, take screenshots, read the page. Start the dev servers first (`pnpm dev`), then use MCP tools to act as a real user against `http://localhost:5173`. The backend should be running with a real LLM (no `MOCK_LLM`). Use your judgement on when to do this — it makes sense for changes that affect LLM integration, prompt handling, or rendering of responses. Skip for purely structural changes. Verify that the UI looks and behaves correctly.
- Summarize what was built and what was tested.

### Step 5: Commit

- Stage all changed files and create a commit with a concise message describing the feature.
- Do NOT commit build artifacts (`dist/`, `node_modules/`, `*.profraw`, `presentation.html`, etc.) — check `.gitignore` is up to date.
- Do NOT commit files with secrets (`.env`, credentials, API keys).
- **Ask for user permission before pushing to the remote.**
