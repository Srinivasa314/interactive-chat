import { describe, it, expect } from "vitest";
import { createEmptyToolset } from "../services/toolset.js";

describe("Toolset", () => {
  describe("createEmptyToolset", () => {
    it("has no tool definitions", () => {
      const toolset = createEmptyToolset();
      expect(toolset.definitions).toHaveLength(0);
    });

    it("throws on any execute call", async () => {
      const toolset = createEmptyToolset();
      await expect(toolset.execute("anything", {})).rejects.toThrow(
        "No tools available"
      );
    });
  });

  // Note: createWebSearchToolset requires BRAVE_SEARCH_API_KEY env var
  // and makes real HTTP calls, so it is not unit tested here.
  // Integration coverage happens in e2e tests with the real LLM.
});
