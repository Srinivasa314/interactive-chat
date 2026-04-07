import { Hono } from "hono";
import { cors } from "hono/cors";
import type { LLMProvider } from "./services/llm.js";
import type { Toolset } from "./services/toolset.js";
import { createChatRoute } from "./routes/chat.js";

export type AppEnv = {
  Variables: {
    llm: LLMProvider;
    toolset?: Toolset;
  };
};

export function createApp(llm: LLMProvider, toolset?: Toolset) {
  const app = new Hono<AppEnv>();

  app.use("/*", cors());
  app.use("/*", async (c, next) => {
    c.set("llm", llm);
    if (toolset) c.set("toolset", toolset);
    await next();
  });
  app.route("/api", createChatRoute());

  return app;
}
