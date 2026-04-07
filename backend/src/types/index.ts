// Shared types for the backend

export interface ChatRequest {
  messages: ConversationMessage[];
  widgetState?: Record<string, unknown>;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}
