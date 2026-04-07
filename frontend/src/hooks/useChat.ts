import { useState, useCallback, useRef } from "react";
import type { Block, Widget, ChatResponse } from "../types/blocks";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export type DisplayItem =
  | { type: "user-message"; text: string }
  | { type: "widget"; id: string };

export function useChat() {
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>([]);
  const [widgets, setWidgets] = useState<Record<string, Widget>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [streamingWidgets, setStreamingWidgets] = useState<Widget[] | null>(null);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const conversationHistoryRef = useRef<ConversationMessage[]>([]);
  const widgetStateRef = useRef<Record<string, unknown>>({});
  const abortRef = useRef<AbortController | null>(null);

  const extractWidgetState = useCallback((blocks: Block[]) => {
    for (const block of blocks) {
      switch (block.type) {
        case "select":
          widgetStateRef.current[block.label] = block.value;
          break;
        case "slider":
          widgetStateRef.current[block.label] = block.value;
          break;
        case "toggle":
          widgetStateRef.current[block.label] = block.value;
          break;
        case "text_input":
          widgetStateRef.current[block.label] = block.value;
          break;
        case "card":
          extractWidgetState(block.blocks);
          break;
      }
    }
  }, []);

  const mergeWidgets = useCallback(
    (incoming: Widget[]) => {
      for (const w of incoming) {
        extractWidgetState(w.blocks);
      }

      setWidgets((prev) => {
        const updated = { ...prev };
        for (const w of incoming) {
          updated[w.id] = w;
        }
        return updated;
      });

      setDisplayItems((prev) => {
        const existingIds = new Set(
          prev.filter((d): d is DisplayItem & { type: "widget" } => d.type === "widget").map((d) => d.id)
        );
        const newItems: DisplayItem[] = [];
        for (const w of incoming) {
          if (!existingIds.has(w.id)) {
            newItems.push({ type: "widget", id: w.id });
          }
        }
        return newItems.length > 0 ? [...prev, ...newItems] : prev;
      });
    },
    [extractWidgetState]
  );

  const sendToBackend = useCallback(
    async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setStreamingWidgets(null);
      setToolStatus(null);

      let buffer = "";

      try {
        const resp = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: conversationHistoryRef.current,
            widgetState: widgetStateRef.current,
          }),
          signal: controller.signal,
        });

        if (!resp.ok || !resp.body) {
          throw new Error(`Request failed: ${resp.status}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            const toolMatch = data.match(/^\[TOOL:(.+)\]$/);
            if (toolMatch) {
              setToolStatus(toolMatch[1]);
              continue;
            }

            buffer += data;

            try {
              const parsed: ChatResponse = JSON.parse(buffer);
              if (parsed.widgets) {
                setToolStatus(null);
                setStreamingWidgets(parsed.widgets);
              }
            } catch {
              // Incomplete JSON, keep accumulating
            }
          }
        }

        // Final parse
        let finalWidgets: Widget[] = [];
        try {
          const parsed: ChatResponse = JSON.parse(buffer);
          finalWidgets = parsed.widgets ?? [];
        } catch {
          finalWidgets = [
            {
              id: "error-" + Date.now(),
              blocks: [{ type: "text", content: buffer || "Failed to parse response" }],
            },
          ];
        }

        // Add assistant response to conversation history
        conversationHistoryRef.current.push({
          role: "assistant",
          content: buffer,
        });

        mergeWidgets(finalWidgets);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        mergeWidgets([
          {
            id: "error-" + Date.now(),
            blocks: [{ type: "text", content: `Error: ${(err as Error).message}` }],
          },
        ]);
      } finally {
        setIsLoading(false);
        setStreamingWidgets(null);
        setToolStatus(null);
      }
    },
    [mergeWidgets]
  );

  const sendMessage = useCallback(
    (text: string) => {
      // Add user message to display and conversation history
      setDisplayItems((prev) => [...prev, { type: "user-message", text }]);
      conversationHistoryRef.current.push({ role: "user", content: text });
      sendToBackend();
    },
    [sendToBackend]
  );

  const handleWidgetInteraction = useCallback(
    (block: Block, value: unknown) => {
      let description: string;

      switch (block.type) {
        case "select":
          description = `Selected "${value}" for ${block.label}`;
          widgetStateRef.current[block.label] = value;
          break;
        case "button":
          description = `Clicked "${block.label}"`;
          break;
        case "slider":
          description = `Set ${block.label} to ${value}`;
          widgetStateRef.current[block.label] = value;
          break;
        case "toggle":
          description = `Toggled ${block.label} ${value ? "on" : "off"}`;
          widgetStateRef.current[block.label] = value;
          break;
        case "text_input":
          description = `Entered "${value}" for ${block.label}`;
          widgetStateRef.current[block.label] = value;
          break;
        default:
          description = `Interacted with ${block.type}`;
      }

      // Add to conversation history only — NOT to displayItems
      conversationHistoryRef.current.push({ role: "user", content: description });
      sendToBackend();
    },
    [sendToBackend]
  );

  return {
    displayItems,
    widgets,
    isLoading,
    streamingWidgets,
    toolStatus,
    sendMessage,
    handleWidgetInteraction,
  };
}
