import { describe, it, expect } from "vitest";
import { createApp } from "../app.js";
import { createMockProvider } from "../services/llm.js";
import type { LLMProvider } from "../services/llm.js";
import type { Toolset } from "../services/toolset.js";

const defaultResponse = {
  widgets: [
    {
      id: "greeting",
      blocks: [{ type: "text", content: "Hello from mock LLM" }],
    },
  ],
};

const multiWidgetResponse = {
  widgets: [
    { id: "greeting", blocks: [{ type: "text", content: "Hello" }] },
    { id: "actions", blocks: [{ type: "button", label: "Click me" }] },
  ],
};

function createTestApp(provider?: LLMProvider) {
  return createApp(provider ?? createMockProvider([], defaultResponse));
}

function postChat(app: ReturnType<typeof createApp>, body: object) {
  return app.request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readSSE(res: Response): Promise<string[]> {
  const text = await res.text();
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6));
}

function parseSSEData(events: string[]): unknown {
  const chunks = events.slice(0, events.indexOf("[DONE]"));
  return JSON.parse(chunks.join(""));
}

describe("POST /api/chat", () => {
  // --- SSE format ---

  it("returns SSE stream with correct content-type", async () => {
    const app = createTestApp();
    const res = await postChat(app, {
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });

  it("streams chunks that reassemble into the response JSON", async () => {
    const app = createTestApp();
    const res = await postChat(app, {
      messages: [{ role: "user", content: "hi" }],
    });

    const events = await readSSE(res);
    expect(events.indexOf("[DONE]")).toBeGreaterThan(0);

    const parsed = parseSSEData(events);
    expect(parsed).toEqual(defaultResponse);
  });

  it("ends stream with [DONE] event", async () => {
    const app = createTestApp();
    const res = await postChat(app, {
      messages: [{ role: "user", content: "hi" }],
    });

    const events = await readSSE(res);
    expect(events[events.length - 1]).toBe("[DONE]");
  });

  it("chunks response into small pieces (<=20 chars)", async () => {
    const app = createTestApp();
    const res = await postChat(app, {
      messages: [{ role: "user", content: "hi" }],
    });

    const events = await readSSE(res);
    const chunks = events.slice(0, events.indexOf("[DONE]"));
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(20);
    }
  });

  it("includes CORS headers", async () => {
    const app = createTestApp();
    const res = await postChat(app, {
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  // --- Request validation ---

  it("returns 400 when messages are missing", async () => {
    const app = createTestApp();
    const res = await postChat(app, { messages: [] });
    expect(res.status).toBe(400);
  });

  it("returns 400 when messages field is absent", async () => {
    const app = createTestApp();
    const res = await postChat(app, {});
    expect(res.status).toBe(400);
  });

  // --- Error handling ---

  it("handles provider errors gracefully", async () => {
    const errorProvider: LLMProvider = {
      async *streamChat() {
        throw new Error("LLM is down");
      },
    };
    const app = createTestApp(errorProvider);
    const res = await postChat(app, {
      messages: [{ role: "user", content: "hi" }],
    });

    const events = await readSSE(res);
    expect(events[events.length - 1]).toBe("[DONE]");
    const errorEvent = events.find((e) => e.includes("error"));
    expect(errorEvent).toBeDefined();
  });

  // --- Widget format ---

  it("accepts widgetState in request", async () => {
    const app = createTestApp();
    const res = await postChat(app, {
      messages: [{ role: "user", content: "hi" }],
      widgetState: { Class: "Economy" },
    });
    expect(res.status).toBe(200);
    const events = await readSSE(res);
    expect(events[events.length - 1]).toBe("[DONE]");
  });

  it("passes widgetState to the LLM system prompt", async () => {
    let capturedSystemPrompt = "";
    const capturingProvider: LLMProvider = {
      async *streamChat(_messages, systemPrompt) {
        capturedSystemPrompt = systemPrompt;
        yield JSON.stringify(defaultResponse);
      },
    };

    const app = createApp(capturingProvider);
    await postChat(app, {
      messages: [{ role: "user", content: "hi" }],
      widgetState: { "Dark mode": true, Theme: "blue" },
    });

    expect(capturedSystemPrompt).toContain("Dark mode");
    expect(capturedSystemPrompt).toContain("true");
    expect(capturedSystemPrompt).toContain("Theme");
    expect(capturedSystemPrompt).toContain("blue");
  });

  it("does not include widgetState in prompt when empty", async () => {
    let capturedSystemPrompt = "";
    const capturingProvider: LLMProvider = {
      async *streamChat(_messages, systemPrompt) {
        capturedSystemPrompt = systemPrompt;
        yield JSON.stringify(defaultResponse);
      },
    };

    const app = createApp(capturingProvider);
    await postChat(app, {
      messages: [{ role: "user", content: "hi" }],
      widgetState: {},
    });

    expect(capturedSystemPrompt).not.toContain("widget state");
  });

  it("supports multiple widgets in a single response", async () => {
    const app = createTestApp(createMockProvider([], multiWidgetResponse));
    const res = await postChat(app, {
      messages: [{ role: "user", content: "hi" }],
    });

    const parsed = parseSSEData(await readSSE(res)) as typeof multiWidgetResponse;
    expect(parsed.widgets).toHaveLength(2);
    expect(parsed.widgets[0].id).toBe("greeting");
    expect(parsed.widgets[1].id).toBe("actions");
  });

  // --- Mock provider matching ---

  it("returns matched entry when messages match exactly", async () => {
    const matchedResponse = {
      widgets: [
        { id: "special", blocks: [{ type: "text", content: "matched!" }] },
      ],
    };
    const app = createTestApp(
      createMockProvider(
        [
          {
            messages: [{ role: "user", content: "specific input" }],
            response: matchedResponse,
          },
        ],
        defaultResponse
      )
    );

    // Matched input
    const res1 = await postChat(app, {
      messages: [{ role: "user", content: "specific input" }],
    });
    const parsed1 = parseSSEData(await readSSE(res1)) as typeof matchedResponse;
    expect(parsed1.widgets[0].id).toBe("special");

    // Unmatched input falls back
    const res2 = await postChat(app, {
      messages: [{ role: "user", content: "other input" }],
    });
    const parsed2 = parseSSEData(await readSSE(res2)) as typeof defaultResponse;
    expect(parsed2.widgets[0].id).toBe("greeting");
  });

  it("matches on full conversation history, not just last message", async () => {
    const turn2Response = {
      widgets: [
        { id: "updated", blocks: [{ type: "text", content: "turn 2" }] },
      ],
    };
    const app = createTestApp(
      createMockProvider(
        [
          {
            messages: [
              { role: "user", content: "hi" },
              { role: "assistant", content: "hello" },
              { role: "user", content: "next" },
            ],
            response: turn2Response,
          },
        ],
        defaultResponse
      )
    );

    // Single message "next" — does NOT match (needs full history)
    const res1 = await postChat(app, {
      messages: [{ role: "user", content: "next" }],
    });
    expect(
      (parseSSEData(await readSSE(res1)) as typeof defaultResponse).widgets[0].id
    ).toBe("greeting");

    // Full history — matches
    const res2 = await postChat(app, {
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
        { role: "user", content: "next" },
      ],
    });
    expect(
      (parseSSEData(await readSSE(res2)) as typeof turn2Response).widgets[0].id
    ).toBe("updated");
  });

  // --- Toolset integration ---

  it("works with a toolset injected into the app", async () => {
    const mockToolset: Toolset = {
      definitions: [
        {
          name: "test_tool",
          description: "A test tool",
          input_schema: { type: "object", properties: { q: { type: "string" } } },
        },
      ],
      async execute() {
        return "tool result";
      },
    };

    // Mock LLM doesn't use tools, but the app should accept the toolset without errors
    const app = createApp(createMockProvider([], defaultResponse), mockToolset);
    const res = await postChat(app, {
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.status).toBe(200);
    const parsed = parseSSEData(await readSSE(res));
    expect(parsed).toEqual(defaultResponse);
  });

  it("works without a toolset (backwards compat)", async () => {
    const app = createApp(createMockProvider([], defaultResponse));
    const res = await postChat(app, {
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.status).toBe(200);
    const parsed = parseSSEData(await readSSE(res));
    expect(parsed).toEqual(defaultResponse);
  });

  // --- Tool call loop ---

  it("LLM provider that uses tools executes them and returns final response", async () => {
    const toolCallLog: { name: string; input: Record<string, unknown> }[] = [];
    const finalResponse = {
      widgets: [
        { id: "weather", blocks: [{ type: "text", content: "It is 20°C in Tokyo" }] },
      ],
    };

    // Custom LLM provider that simulates tool call flow
    let callCount = 0;
    const toolProvider: LLMProvider = {
      async *streamChat(_messages, _systemPrompt, toolset) {
        callCount++;
        if (callCount === 1 && toolset) {
          // Simulate: first call, LLM wants to use a tool
          // Execute the tool directly (simulating what createProvider does)
          const result = await toolset.execute("get_data", { city: "Tokyo" });
          toolCallLog.push({ name: "get_data", input: { city: "Tokyo" } });
          // Use the result to form the final response
          expect(result).toBe('{"temp":20,"city":"Tokyo"}');
        }
        // Return final UI JSON
        const json = JSON.stringify(finalResponse);
        yield json;
      },
    };

    const mockToolset: Toolset = {
      definitions: [
        {
          name: "get_data",
          description: "Get data",
          input_schema: { type: "object", properties: { city: { type: "string" } } },
        },
      ],
      async execute(name, input) {
        return JSON.stringify({ temp: 20, city: input.city });
      },
    };

    const app = createApp(toolProvider, mockToolset);
    const res = await postChat(app, {
      messages: [{ role: "user", content: "weather in Tokyo" }],
    });

    expect(res.status).toBe(200);
    const parsed = parseSSEData(await readSSE(res));
    expect(parsed).toEqual(finalResponse);
    expect(toolCallLog).toHaveLength(1);
    expect(toolCallLog[0]).toEqual({ name: "get_data", input: { city: "Tokyo" } });
  });

  it("handles tool execution errors gracefully", async () => {
    const errorToolProvider: LLMProvider = {
      async *streamChat(_messages, _systemPrompt, toolset) {
        if (toolset) {
          // Try to execute a tool that will throw
          try {
            await toolset.execute("bad_tool", {});
          } catch {
            // Tool failed, return error UI
          }
        }
        const errorResponse = {
          widgets: [
            { id: "error", blocks: [{ type: "text", content: "Tool failed" }] },
          ],
        };
        yield JSON.stringify(errorResponse);
      },
    };

    const mockToolset: Toolset = {
      definitions: [
        { name: "bad_tool", description: "Fails", input_schema: { type: "object" } },
      ],
      async execute() {
        throw new Error("API is down");
      },
    };

    const app = createApp(errorToolProvider, mockToolset);
    const res = await postChat(app, {
      messages: [{ role: "user", content: "do something" }],
    });

    expect(res.status).toBe(200);
    const events = await readSSE(res);
    expect(events[events.length - 1]).toBe("[DONE]");
    const parsed = parseSSEData(events) as { widgets: { id: string }[] };
    expect(parsed.widgets[0].id).toBe("error");
  });

  it("empty toolset does not affect request", async () => {
    const emptyToolset: Toolset = {
      definitions: [],
      async execute() {
        throw new Error("No tools available");
      },
    };

    const app = createApp(createMockProvider([], defaultResponse), emptyToolset);
    const res = await postChat(app, {
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.status).toBe(200);
    const parsed = parseSSEData(await readSSE(res));
    expect(parsed).toEqual(defaultResponse);
  });

  // --- Tool status events ---

  it("streams [TOOL:name] events when provider yields them", async () => {
    const toolStatusProvider: LLMProvider = {
      async *streamChat() {
        yield "[TOOL:web_search]";
        yield JSON.stringify(defaultResponse);
      },
    };

    const app = createTestApp(toolStatusProvider);
    const res = await postChat(app, {
      messages: [{ role: "user", content: "search something" }],
    });

    const events = await readSSE(res);
    expect(events).toContain("[TOOL:web_search]");
    // Tool status event should come before the JSON data
    const toolIdx = events.indexOf("[TOOL:web_search]");
    const doneIdx = events.indexOf("[DONE]");
    expect(toolIdx).toBeLessThan(doneIdx);
  });

  it("streams multiple [TOOL:name] events for multiple tool calls", async () => {
    const multiToolStatusProvider: LLMProvider = {
      async *streamChat() {
        yield "[TOOL:search_a]";
        yield "[TOOL:search_b]";
        yield JSON.stringify(defaultResponse);
      },
    };

    const app = createTestApp(multiToolStatusProvider);
    const res = await postChat(app, {
      messages: [{ role: "user", content: "search two things" }],
    });

    const events = await readSSE(res);
    expect(events).toContain("[TOOL:search_a]");
    expect(events).toContain("[TOOL:search_b]");
  });

  it("toolset with multiple tools can execute specific tool by name", async () => {
    const executedTools: string[] = [];
    const multiToolProvider: LLMProvider = {
      async *streamChat(_messages, _systemPrompt, toolset) {
        if (toolset) {
          const r1 = await toolset.execute("tool_a", { x: 1 });
          const r2 = await toolset.execute("tool_b", { y: 2 });
          executedTools.push(r1, r2);
        }
        yield JSON.stringify(defaultResponse);
      },
    };

    const multiToolset: Toolset = {
      definitions: [
        { name: "tool_a", description: "Tool A", input_schema: { type: "object" } },
        { name: "tool_b", description: "Tool B", input_schema: { type: "object" } },
      ],
      async execute(name, input) {
        return `${name}:${JSON.stringify(input)}`;
      },
    };

    const app = createApp(multiToolProvider, multiToolset);
    const res = await postChat(app, {
      messages: [{ role: "user", content: "use tools" }],
    });
    expect(res.status).toBe(200);
    expect(executedTools).toEqual(['tool_a:{"x":1}', 'tool_b:{"y":2}']);
  });
});
