// UI block types matching the JSON spec from the LLM

export type Block =
  | TextBlock
  | SelectBlock
  | TableBlock
  | ButtonBlock
  | SliderBlock
  | ToggleBlock
  | TextInputBlock
  | ImageBlock
  | CardBlock;

export interface TextBlock {
  type: "text";
  content: string;
}

export interface SelectBlock {
  type: "select";
  label: string;
  value: string;
  options: string[];
}

export interface TableBlock {
  type: "table";
  columns: string[];
  rows: unknown[][];
}

export interface ButtonBlock {
  type: "button";
  label: string;
}

export interface SliderBlock {
  type: "slider";
  label: string;
  min: number;
  max: number;
  value: number;
}

export interface ToggleBlock {
  type: "toggle";
  label: string;
  value: boolean;
}

export interface TextInputBlock {
  type: "text_input";
  label: string;
  value: string;
  placeholder?: string;
}

export interface ImageBlock {
  type: "image";
  url: string;
  alt?: string;
}

export interface CardBlock {
  type: "card";
  title: string;
  blocks: Block[];
}

export interface Widget {
  id: string;
  blocks: Block[];
}

export interface ChatResponse {
  widgets: Widget[];
}
