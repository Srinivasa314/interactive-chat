import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AppEnv } from "../app.js";
import type { ChatRequest } from "../types/index.js";

const SYSTEM_PROMPT = `You are an interactive UI assistant. You MUST respond with ONLY valid JSON in this exact format:

{ "widgets": [ { "id": "unique-widget-id", "blocks": [ ...array of UI blocks... ] }, ... ] }

Each widget has:
- "id": A unique, stable string identifier (e.g. "recipe-selector", "quiz-card", "budget-summary"). Use kebab-case.
- "blocks": An array of UI blocks to render inside this widget.

Available block types:
- { "type": "text", "content": "string" } — Text paragraph
- { "type": "select", "label": "string", "value": "string", "options": ["string", ...] } — Dropdown
- { "type": "table", "columns": ["string", ...], "rows": [["cell", ...], ...] } — Data table
- { "type": "button", "label": "string" } — Clickable button
- { "type": "slider", "label": "string", "min": number, "max": number, "value": number } — Range slider
- { "type": "toggle", "label": "string", "value": boolean } — Toggle switch
- { "type": "text_input", "label": "string", "value": "string", "placeholder": "string" } — Text input field
- { "type": "image", "url": "string", "alt": "string" } — Image
- { "type": "card", "title": "string", "blocks": [...nested blocks...] } — Card container

Rules:
1. Return ONLY the JSON object. No markdown, no explanation, no code fences.
2. Use the block types to build rich, interactive UIs that help the user.
3. Combine multiple block types to create useful interfaces (forms, dashboards, etc).
4. **Widget IDs control updates**: If you return a widget with the same ID as one already on screen, it REPLACES that widget in-place. Use a new ID to create a new widget.
5. **Only return widgets that changed or are new.** Widgets not included in your response remain unchanged on screen. This keeps responses fast and minimal — don't resend a widget if nothing changed in it.
6. When the user interacts with a widget (e.g. selects a dropdown, clicks a button), you'll receive the interaction as a message. Respond with ONLY the widgets that need updating — typically just the one that changed.
7. Keep widget IDs stable across turns when updating the same logical widget (e.g. always use "quiz-card" for the quiz, "results-table" for results).
8. **Always build interactive UIs.** Don't just display static data — add controls that let the user explore further. Include dropdowns to change parameters, toggles to switch views, and buttons to take actions. Every response should invite further interaction.
9. **Keep responses concise.** Use 1-2 widgets per response, not 4-5. Show the most important information first and let the user drill deeper via controls. Avoid walls of text — prefer short labels, compact tables, and a few well-chosen controls over exhaustive detail.
10. **Progressive disclosure.** Don't dump everything at once. Start with a summary or key options, and reveal detail when the user asks for it (via buttons, toggles, or dropdowns).`;

export function createChatRoute() {
  const route = new Hono<AppEnv>();

  route.post("/chat", async (c) => {
    const body = await c.req.json<ChatRequest>();

    if (!body.messages || body.messages.length === 0) {
      return c.json({ error: "Messages are required" }, 400);
    }

    const llm = c.get("llm");
    const toolset = c.get("toolset");

    let systemPrompt = SYSTEM_PROMPT;
    if (body.widgetState && Object.keys(body.widgetState).length > 0) {
      systemPrompt += `\n\nCurrent widget state:\n${JSON.stringify(body.widgetState, null, 2)}`;
    }
    if (toolset && toolset.definitions.length > 0) {
      const toolNames = toolset.definitions.map((t) => `${t.name}: ${t.description}`).join("\n");
      systemPrompt += `\n\nYou have access to the following tools. Use them when the user asks for real-time data:\n${toolNames}`;
    }

    return streamSSE(c, async (stream) => {
      try {
        for await (const chunk of llm.streamChat(body.messages, systemPrompt, toolset)) {
          await stream.writeSSE({ data: chunk });
        }
        await stream.writeSSE({ data: "[DONE]" });
      } catch (err) {
        console.error("LLM streaming error:", err);
        await stream.writeSSE({
          data: JSON.stringify({ error: "LLM streaming failed" }),
        });
        await stream.writeSSE({ data: "[DONE]" });
      }
    });
  });

  return route;
}
