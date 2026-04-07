import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createProvider, createMockProvider } from "./services/llm.js";
import { createWebSearchToolset } from "./services/toolset.js";

const fallbackResponse = {
  widgets: [
    {
      id: "welcome",
      blocks: [
        {
          type: "text",
          content:
            "Hello! I'm your interactive assistant. How can I help you today?",
        },
      ],
    },
    {
      id: "quick-actions",
      blocks: [
        {
          type: "card",
          title: "Quick Actions",
          blocks: [
            { type: "button", label: "Tell me a joke" },
            { type: "button", label: "Create a quiz" },
            { type: "button", label: "Show me a demo" },
          ],
        },
      ],
    },
  ],
};

const fallbackResponseJson = JSON.stringify(fallbackResponse);

const interactionResponse = {
  widgets: [
    {
      id: "welcome",
      blocks: [
        {
          type: "text",
          content: "Here's what I can do for you!",
        },
      ],
    },
  ],
};

// Response with interactive controls for testing toggle/select behavior
const controlsResponse = {
  widgets: [
    {
      id: "controls",
      blocks: [
        { type: "toggle", label: "Dark mode", value: true },
        { type: "select", label: "Theme", value: "blue", options: ["blue", "green", "red"] },
        { type: "text", content: "Controls are active" },
      ],
    },
  ],
};

const controlsResponseJson = JSON.stringify(controlsResponse);

const toggledOffResponse = {
  widgets: [
    {
      id: "controls",
      blocks: [
        { type: "toggle", label: "Dark mode", value: false },
        { type: "select", label: "Theme", value: "blue", options: ["blue", "green", "red"] },
        { type: "text", content: "Dark mode disabled" },
      ],
    },
  ],
};

const selectedGreenResponse = {
  widgets: [
    {
      id: "controls",
      blocks: [
        { type: "toggle", label: "Dark mode", value: true },
        { type: "select", label: "Theme", value: "green", options: ["blue", "green", "red"] },
        { type: "text", content: "Theme changed to green" },
      ],
    },
  ],
};

// For any user message followed by the assistant's fallback response, then a
// "Clicked ..." interaction, return the interaction response.
// We match all three synthetic message prefixes that widget interactions produce.
const interactionPrefixes = [
  "Clicked",
  "Selected",
  "Toggled",
  "Set",
  "Entered",
];

function buildInteractionEntries(userMessages: string[]) {
  const entries = [];
  for (const userMsg of userMessages) {
    for (const prefix of interactionPrefixes) {
      // Match: [user msg] -> [assistant fallback] -> [interaction]
      // We can't enumerate all interaction messages, so we use a set of common ones
      // from the quick-actions buttons
      for (const buttonLabel of [
        "Tell me a joke",
        "Create a quiz",
        "Show me a demo",
      ]) {
        entries.push({
          messages: [
            { role: "user" as const, content: userMsg },
            { role: "assistant" as const, content: fallbackResponseJson },
            {
              role: "user" as const,
              content: `${prefix} "${buttonLabel}"`,
            },
          ],
          response: interactionResponse,
        });
      }
    }
  }
  return entries;
}

// Build entries for common user messages used in e2e tests
const mockEntries = [
  ...buildInteractionEntries([
    "Hello",
    "Hi there",
    "Start",
    "Show me something",
    "First message",
  ]),
  // Controls test: "Show controls" → controls response
  {
    messages: [{ role: "user" as const, content: "Show controls" }],
    response: controlsResponse,
  },
  // Toggle off: conversation history → toggled off response
  {
    messages: [
      { role: "user" as const, content: "Show controls" },
      { role: "assistant" as const, content: controlsResponseJson },
      { role: "user" as const, content: 'Toggled Dark mode off' },
    ],
    response: toggledOffResponse,
  },
  // Select green: conversation history → selected green response
  {
    messages: [
      { role: "user" as const, content: "Show controls" },
      { role: "assistant" as const, content: controlsResponseJson },
      { role: "user" as const, content: 'Selected "green" for Theme' },
    ],
    response: selectedGreenResponse,
  },
];

const llm =
  process.env.MOCK_LLM === "true"
    ? createMockProvider(mockEntries, fallbackResponse)
    : createProvider();

const toolset = process.env.MOCK_LLM === "true" ? undefined : createWebSearchToolset();
const app = createApp(llm, toolset);

const PORT = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(
    `Server running on port ${PORT}${process.env.MOCK_LLM === "true" ? " (mock LLM)" : ""}`
  );
});
