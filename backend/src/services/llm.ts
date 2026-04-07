import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ContentBlockParam, ToolUseBlock, TextBlock } from "@anthropic-ai/sdk/resources/messages";
import type { ConversationMessage } from "../types/index.js";
import type { Toolset } from "./toolset.js";

export interface LLMProvider {
  streamChat(
    messages: ConversationMessage[],
    systemPrompt: string,
    toolset?: Toolset
  ): AsyncIterable<string>;
}

export function createProvider(): LLMProvider {
  const client = new Anthropic();

  return {
    async *streamChat(messages, systemPrompt, toolset) {
      const apiMessages: MessageParam[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const tools =
        toolset && toolset.definitions.length > 0
          ? toolset.definitions.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.input_schema as Anthropic.Tool["input_schema"],
            }))
          : undefined;

      // Tool call loop (non-streaming)
      let loopMessages = [...apiMessages];
      while (true) {
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: systemPrompt,
          messages: loopMessages,
          ...(tools ? { tools } : {}),
        });

        if (response.stop_reason === "tool_use" && toolset) {
          // Execute tool calls
          const toolUseBlocks = response.content.filter(
            (b): b is ToolUseBlock => b.type === "tool_use"
          );

          const toolResults: ContentBlockParam[] = [];
          for (const toolUse of toolUseBlocks) {
            yield `[TOOL:${toolUse.name}]`;
            const result = await toolset.execute(
              toolUse.name,
              toolUse.input as Record<string, unknown>
            );
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: result,
            });
          }

          // Append assistant response + tool results, continue loop
          loopMessages = [
            ...loopMessages,
            { role: "assistant", content: response.content },
            { role: "user", content: toolResults },
          ];
          continue;
        }

        // Final response — stream it
        // Extract text from the final non-streaming response
        const textBlocks = response.content.filter(
          (b): b is TextBlock => b.type === "text"
        );
        const fullText = textBlocks.map((b) => b.text).join("");

        // Yield in chunks to simulate streaming
        const chunkSize = 50;
        for (let i = 0; i < fullText.length; i += chunkSize) {
          yield fullText.slice(i, i + chunkSize);
        }
        break;
      }
    },
  };
}

export interface MockEntry {
  messages: ConversationMessage[];
  response: object;
}

export function createMockProvider(
  entries: MockEntry[],
  fallback: object
): LLMProvider {
  return {
    async *streamChat(messages) {
      const inputKey = JSON.stringify(
        messages.map((m) => ({ role: m.role, content: m.content }))
      );
      const matched = entries.find(
        (e) => JSON.stringify(e.messages) === inputKey
      );
      const response = matched?.response ?? fallback;
      const json = JSON.stringify(response);
      const chunkSize = 20;
      for (let i = 0; i < json.length; i += chunkSize) {
        yield json.slice(i, i + chunkSize);
      }
    },
  };
}
