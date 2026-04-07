import { useState, useRef, useCallback, useEffect } from "react";
import type { Block } from "../types/blocks";

interface BlockRendererProps {
  block: Block;
  onInteraction: (block: Block, value: unknown) => void;
}

export default function BlockRenderer({ block, onInteraction }: BlockRendererProps) {
  switch (block.type) {
    case "text":
      return <p className="block-text">{block.content}</p>;

    case "select":
      return <SelectBlock block={block} onInteraction={onInteraction} />;

    case "table":
      return (
        <div className="block-table-wrapper">
          <table className="block-table">
            <thead>
              <tr>
                {block.columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{String(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "button":
      return (
        <button
          className="block-button"
          onClick={() => onInteraction(block, true)}
        >
          {block.label}
        </button>
      );

    case "slider":
      return <SliderBlock block={block} onInteraction={onInteraction} />;

    case "toggle":
      return <ToggleBlock block={block} onInteraction={onInteraction} />;

    case "text_input":
      return <TextInputBlock block={block} onInteraction={onInteraction} />;

    case "image":
      return (
        <img
          className="block-image"
          src={block.url}
          alt={block.alt ?? ""}
        />
      );

    case "card":
      return (
        <div className="block-card">
          <h3 className="block-card-title">{block.title}</h3>
          <div className="block-card-body">
            {block.blocks.map((child, i) => (
              <BlockRenderer
                key={i}
                block={child}
                onInteraction={onInteraction}
              />
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
}

function SliderBlock({
  block,
  onInteraction,
}: {
  block: Extract<Block, { type: "slider" }>;
  onInteraction: (block: Block, value: unknown) => void;
}) {
  const [localValue, setLocalValue] = useState(block.value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(block.value);
  }, [block.value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      setLocalValue(val);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onInteraction(block, val);
      }, 500);
    },
    [block, onInteraction]
  );

  return (
    <div className="block-slider">
      <label>
        {block.label}: {localValue}
      </label>
      <input
        type="range"
        min={block.min}
        max={block.max}
        value={localValue}
        onChange={handleChange}
      />
    </div>
  );
}

function SelectBlock({
  block,
  onInteraction,
}: {
  block: Extract<Block, { type: "select" }>;
  onInteraction: (block: Block, value: unknown) => void;
}) {
  const [localValue, setLocalValue] = useState(block.value);

  useEffect(() => {
    setLocalValue(block.value);
  }, [block.value]);

  return (
    <div className="block-select">
      <label>{block.label}</label>
      <select
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
          onInteraction(block, e.target.value);
        }}
      >
        {block.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleBlock({
  block,
  onInteraction,
}: {
  block: Extract<Block, { type: "toggle" }>;
  onInteraction: (block: Block, value: unknown) => void;
}) {
  const [localValue, setLocalValue] = useState(block.value);

  useEffect(() => {
    setLocalValue(block.value);
  }, [block.value]);

  return (
    <label className="block-toggle">
      <input
        type="checkbox"
        checked={localValue}
        onChange={(e) => {
          setLocalValue(e.target.checked);
          onInteraction(block, e.target.checked);
        }}
      />
      <span>{block.label}</span>
    </label>
  );
}

function TextInputBlock({
  block,
  onInteraction,
}: {
  block: Extract<Block, { type: "text_input" }>;
  onInteraction: (block: Block, value: unknown) => void;
}) {
  const [localValue, setLocalValue] = useState(block.value);

  useEffect(() => {
    setLocalValue(block.value);
  }, [block.value]);

  return (
    <div className="block-text-input">
      <label>{block.label}</label>
      <input
        type="text"
        value={localValue}
        placeholder={block.placeholder ?? ""}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onInteraction(block, localValue);
          }
        }}
      />
    </div>
  );
}
