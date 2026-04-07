# Interactive Chat — Detailed Spec

This is the single source of truth for what the product does. Updated with each feature.

## Architecture

- **Frontend**: React 19 + Vite, renders UI blocks from JSON
- **Backend**: Hono on Node.js (tsx), proxies to LLM and streams responses via SSE
- **LLM**: Anthropic Claude (behind a generic `LLMProvider` interface)
- **Testing**: Vitest (backend unit tests via Hono `app.request()`), Playwright (e2e browser tests)

## Features

### Core Chat (v1)

1. **SSE Streaming Backend** — POST /api/chat streams LLM response as SSE `data:` events. Each event is a chunk of the JSON string. Final event is `[DONE]`. Backend constructs a system prompt instructing the LLM to return `{ "blocks": [...] }` JSON.

2. **Anthropic Provider** — Implements `LLMProvider` using `@anthropic-ai/sdk`. Streams Claude responses token-by-token via `messages.stream()`. System prompt tells Claude to respond only with valid UI JSON.

3. **Mock Provider (enhanced)** — Yields response in small chunks (simulating streaming) for realistic test behavior.

4. **Chat UI** — React component with:
   - Message input bar (text input + send button) at the bottom
   - Scrollable message area showing conversation history
   - User messages rendered as text bubbles
   - Assistant messages rendered as blocks via BlockRenderer
   - Loading indicator while waiting for LLM response ("Thinking" or "Using {tool_name}")
   - Existing widgets dim to 40% opacity with `pointer-events: none` during loading
   - Auto-scroll only on new user messages (not on widget updates or interactions)

5. **Block Rendering** — BlockRenderer renders all 9 block types:
   - `text` → paragraph
   - `select` → labeled dropdown
   - `table` → HTML table with headers
   - `button` → clickable button
   - `slider` → range input with label and value display
   - `toggle` → labeled checkbox/switch
   - `text_input` → labeled text field
   - `image` → img tag with alt text
   - `card` → titled container with nested blocks

6. **Widget Interactions** — When a user interacts with a widget (select change, button click, slider move, toggle, text input submit), the client:
   - Captures the interaction as a synthetic user message (e.g. "Selected 'Economy' for Class") for the LLM conversation history, but **does NOT display it** in the UI
   - The LLM response **replaces the current widget in-place** rather than appending a new message
   - Sends the full conversation history + current widget state to the backend
   - Debounces slider interactions (500ms)
   - Text inputs submit on Enter key
   - **Local state for interactive controls**: Select, toggle, slider, and text input components maintain local state so the UI reflects the user's action immediately (e.g. a dropdown shows the new selection, a toggle unchecks) without waiting for the LLM round-trip. The LLM response then syncs the authoritative value back.

7. **Widget State Seeding** — When widgets are rendered (initial response or updates), the client extracts default values from all interactive controls (select, slider, toggle, text_input) and populates `widgetState`. This ensures the LLM receives the full control state on subsequent interactions, including defaults it set itself.

8. **Progressive JSON Parsing** — Frontend accumulates SSE chunks and attempts to parse partial JSON to render blocks as they arrive. Falls back to showing loading state until valid JSON is available.

9. **Widget IDs and In-place Updates** — Every widget has a unique ID. The LLM controls whether to create new widgets or update existing ones:
   - The LLM response is `{ "widgets": [{ "id": "string", "blocks": [Block, ...] }, ...] }`
   - Each widget has a unique `id` chosen by the LLM (e.g. `"recipe-selector"`, `"shopping-list"`)
   - If a widget `id` already exists on screen, its blocks are **replaced in-place**
   - If a widget `id` is new, it is **appended** to the display
   - Widget interactions (select, button, etc.) are sent to the LLM as synthetic messages in the conversation history but are **not shown** in the UI
   - Widget interactions trigger an LLM round-trip; the response updates/creates widgets by ID
   - User-typed messages are shown as bubbles in the UI; the LLM response can update existing widgets or create new ones
   - The system prompt instructs the LLM to use stable IDs for widgets it wants to update across turns, and new IDs for new widgets

### Tool Calls (v2)

10. **Tool Call Support** — The LLM can call external tools/APIs during a conversation. The tool call loop runs entirely on the backend:
    - Backend sends conversation + tool definitions to the LLM
    - If the LLM responds with tool calls, backend executes them and sends results back to the LLM
    - Loop continues until the LLM produces a final text response (the UI JSON)
    - During tool execution, the backend streams `[TOOL:name]` status events via SSE so the frontend can show "Using {tool_name}" instead of "Thinking"
    - Once the final JSON response begins streaming, the tool status is cleared

11. **Modular Toolsets** — Tools are defined via a `Toolset` interface:
    ```ts
    interface ToolDefinition {
      name: string;
      description: string;
      input_schema: object; // JSON Schema
    }
    interface Toolset {
      definitions: ToolDefinition[];
      execute(name: string, input: Record<string, unknown>): Promise<string>;
    }
    ```
    - Toolsets are passed to the `LLMProvider` and injected into the chat route
    - Different toolsets can be swapped in at startup (e.g. weather tools, search tools, math tools)
    - The system prompt is augmented to tell the LLM which tools are available

12. **Web Search Toolset** — A general-purpose toolset for real-time data:
    - `web_search({ query: string })` — Searches the web and returns top results (title, URL, snippet)
    - Uses the Brave Search API (free tier: 2,000 queries/month, requires `BRAVE_SEARCH_API_KEY`)
    - Enables demos like product comparisons, research tasks, and anything needing current data

## API

### POST /api/chat

Request body:
```json
{
  "messages": [{ "role": "user" | "assistant", "content": "string" }],
  "widgetState": {}
}
```

Response: SSE stream. Events may include:
- `[TOOL:name]` — Tool status indicator (e.g. `[TOOL:web_search]`), sent during tool execution
- JSON chunks — Fragments of the UI JSON response, assembling into:
  ```json
  { "widgets": [{ "id": "string", "blocks": [Block, ...] }, ...] }
  ```
- `[DONE]` — End of stream

Each widget has a unique `id`. If the `id` matches an existing on-screen widget, it is replaced in-place. Otherwise a new widget is appended.

## UI Block Types

| Type | Properties |
|------|-----------|
| text | content: string |
| select | label, value, options: string[] |
| table | columns: string[], rows: unknown[][] |
| button | label: string |
| slider | label, min, max, value: number |
| toggle | label, value: boolean |
| text_input | label, value, placeholder?: string |
| image | url, alt?: string |
| card | title, blocks: Block[] (nested) |

## Interaction Model

- User sends a message or interacts with a widget
- Client sends full conversation history + current widget state to backend
- Backend calls LLM, which returns UI JSON
- Client renders the JSON as React components
- Widget-internal interactions (sort, zoom) are client-side only

## Latency

- Dropdown/filter/button: immediate LLM round-trip
- Slider: debounce 500ms then round-trip
- Text input: submit on enter/button, not on keystroke
- Streaming: progressively render JSON tokens as they arrive
- Loading indicator during transitions (not skeleton, since UI shape may change)
