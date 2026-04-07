export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: object;
}

export interface Toolset {
  definitions: ToolDefinition[];
  execute(name: string, input: Record<string, unknown>): Promise<string>;
}

export function createEmptyToolset(): Toolset {
  return {
    definitions: [],
    async execute() {
      throw new Error("No tools available");
    },
  };
}

export function createWebSearchToolset(): Toolset {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    throw new Error("BRAVE_SEARCH_API_KEY is required for web search toolset");
  }

  return {
    definitions: [
      {
        name: "web_search",
        description:
          "Search the web for current information. Returns top results with title, URL, and snippet.",
        input_schema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "The search query (e.g. 'best laptops for video editing 2025')",
            },
          },
          required: ["query"],
        },
      },
    ],

    async execute(name, input) {
      if (name !== "web_search") {
        throw new Error(`Unknown tool: ${name}`);
      }

      const query = input.query as string;

      const res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
        {
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": apiKey,
          },
        }
      );

      if (!res.ok) {
        return JSON.stringify({
          error: `Search failed: ${res.status} ${res.statusText}`,
        });
      }

      const data = (await res.json()) as {
        web?: {
          results?: {
            title: string;
            url: string;
            description: string;
          }[];
        };
      };

      const results = (data.web?.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
      }));

      return JSON.stringify({ query, results });
    },
  };
}
