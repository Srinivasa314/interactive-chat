# Interactive Chat UI

A chat interface where LLM responses are rendered as interactive widgets instead of plain text. Every user interaction re-queries the LLM, which returns a fresh UI as structured JSON. The LLM is the logic layer — no client-side state management, no conditionals, no DSL.

## How It Works

1. User sends a message or interacts with a widget (selects a dropdown, moves a slider, clicks a button).
2. The client sends the conversation history + current widget state to the LLM.
3. The LLM calls any necessary APIs, processes the results, and returns a JSON response describing the UI.
4. The client renders the JSON using a fixed set of React components.
5. Repeat.

The JSON is purely a **render format**. It contains no logic, no expressions, no bindings. The LLM decides what to show, what to filter, and how to handle edge cases — every time.

```
User action → widget state sent to LLM → LLM calls APIs → LLM returns UI JSON → client renders
```

## Why JSON, Not Code

LLM-generated code (React, HTML, etc.) makes sense when the output is **reusable** — a component you'll maintain, a page you'll ship. But most chatbot interactions are **throwaway**. The user asks a question, explores the result, and moves on. Generating a full React component for a one-off flight search result is wasteful — it's code nobody will read, maintain, or reuse.

JSON as a render format fits this: lightweight to generate, cheap to throw away, and the LLM can produce a completely different UI on the next turn without any wasted effort.

## Why LLM-On-Every-Interaction

- **No client-side logic.** The UI JSON is just layout + data. The client is a dumb renderer.
- **Every edge case is handled.** Empty results, API errors, partial data — the LLM adapts the UI naturally instead of requiring pre-coded branches.
- **The UI can change shape.** A search form becomes a results table becomes a confirmation card. The LLM generates the right interface for each state.

## UI JSON Spec

The LLM returns a response object containing an array of **blocks**.
```
{ "blocks": [ Block, Block, ... ] }
```

### Widget Types (examples)

**select** — Dropdown menu.
| Property | Type | Required | Description |
|---|---|---|---|
| `label` | string | yes | Display label |
| `value` | string | yes | Currently selected option |
| `options` | string[] | yes | Available choices |

**table** — Data table.
| Property | Type | Required | Description |
|---|---|---|---|
| `columns` | string[] | yes | Column headers |
| `rows` | any[][] | yes | Row data, one array per row |

**button** — Clickable action trigger.
| Property | Type | Required | Description |
|---|---|---|---|
| `label` | string | yes | Button text |

Other widget types: `text`, `slider`, `toggle`, `text_input`, `button`, `image`, `card`.

## Latency Strategy

| Interaction | Strategy |
|---|---|
| Dropdown / filter change | LLM round-trip |
| Slider | Debounce ~500ms, then LLM round-trip |
| Button click | LLM round-trip |
| Text input | Submit on enter/button, not on keystroke |
| Widget-internal interactions (zoom/pan on charts, sort a table column, expand a row) | Client-side — handled by the React component itself |

Streaming is critical — progressively render JSON tokens as they arrive. Show a loading indicator during transitions (not a skeleton, since the UI shape may change entirely between responses).

## Example Use Cases

### 1. Flight Search

> "Find me flights from Austin to NYC next Friday"

**Initial response:** a form with departure city, destination, date picker, and class selector.

**After the user fills in the form and submits:** the LLM calls a flights API and returns a results table with airline, price, departure time, and a "Book" button per row.

**User clicks "Book" on a row:** the LLM returns a confirmation card with passenger details form.

**If the API returns no results:** the LLM returns a friendly message suggesting alternative dates, with a date slider to explore nearby days.

### 2. Learning Quiz

> "Quiz me on Spanish vocabulary, intermediate level"

**Initial response:** a multiple-choice question with four option buttons, a difficulty selector, and a topic dropdown (food, travel, business).

**User selects an answer:** the LLM returns whether it was correct, an explanation, the user's running score as a progress bar, and the next question.

**User changes topic to "travel":** the LLM generates a new question from that category, keeping the score intact.
