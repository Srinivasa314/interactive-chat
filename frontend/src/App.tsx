import { useState, useRef, useEffect } from "react";
import { useChat } from "./hooks/useChat";
import BlockRenderer from "./components/BlockRenderer";

export default function App() {
  const { displayItems, widgets, isLoading, streamingWidgets, toolStatus, sendMessage, handleWidgetInteraction } =
    useChat();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const userMessageCount = displayItems.filter((d) => d.type === "user-message").length;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [userMessageCount]);

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage(text);
  };

  return (
    <div className="chat-container">
      <div className="chat-header">Interactive Chat</div>

      <div className="chat-messages">
        {displayItems.map((item, i) => {
          if (item.type === "user-message") {
            return (
              <div key={i} className="message message-user">
                <div className="message-bubble">{item.text}</div>
              </div>
            );
          }

          const widget = widgets[item.id];
          if (!widget) return null;

          return (
            <div key={item.id} className={`widget${isLoading ? " widget-dimmed" : ""}`} data-widget-id={item.id}>
              {widget.blocks.map((block, j) => (
                <BlockRenderer
                  key={j}
                  block={block}
                  onInteraction={handleWidgetInteraction}
                />
              ))}
            </div>
          );
        })}

        {isLoading && streamingWidgets && (
          <div className="widget widget-streaming">
            {streamingWidgets.map((w) => (
              <div key={w.id}>
                {w.blocks.map((block, j) => (
                  <BlockRenderer
                    key={j}
                    block={block}
                    onInteraction={handleWidgetInteraction}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {isLoading && !streamingWidgets && (
          <div className="loading-indicator">
            {toolStatus ? `Using ${toolStatus}` : "Thinking"}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="chat-input-bar">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Type a message..."
          disabled={isLoading}
        />
        <button onClick={handleSubmit} disabled={isLoading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
