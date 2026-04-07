Create or update the product presentation for Interactive Chat.

Input: $ARGUMENTS

## Context

The presentation lives at `presentation.md` in the project root as a **Marp slide deck** (markdown with slide separators). It targets a technical audience (engineers, PMs, tech leads) but stays at the product/architecture level — no code snippets, no implementation details. It should convey *what* the product does, *why* it's designed this way, and *what it looks like* via demo screenshots.

**Viewing the slides:**
- `pnpm slides` — opens in browser with live preview
- `pnpm slides:pdf` — exports to `presentation.pdf`
- `pnpm slides:html` — exports to `presentation.html`

## Workflow

### Step 1: Gather context

- Read `product.md` for the product vision and design philosophy.
- Read `spec.md` for the current feature set.
- List all demo directories under `demos/` and note what scenarios they cover.
- If `presentation.md` already exists, read it to understand what's already written.
- If the user provided input (e.g. "add the tool calls feature" or "refresh the demos section"), focus the update on that area.

### Step 2: Write or update the presentation

The file must start with Marp frontmatter and use `---` as slide separators. Each `## heading` or `---` starts a new slide.

**Marp frontmatter (keep at top of file):**
```
---
marp: true
theme: default
paginate: true
style: |
  section {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  img {
    max-height: 400px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  table {
    font-size: 0.85em;
  }
---
```

**Slide structure (derive content from spec.md and demos/):**

1. **Title slide** — product name + one-line pitch
2. **The Problem** — why text-only chat UIs are limiting
3. **The Idea** — LLM returns widget JSON, client renders, every interaction re-queries
4. **How It Works** — architecture diagram (text-based) + step-by-step flow
5. **Widget Types** — table of all block types from spec.md
6. **Feature slides** — one slide per major feature from spec.md. Include a screenshot where available.
7. **Demo slides** — for each demo in `demos/`, 2-3 slides with screenshots and brief captions
8. **Architecture** — layer table with technologies and roles
9. **What's Next** — future directions

**Slide guidelines:**
- One idea per slide — don't overcrowd
- Prefer bullet points over paragraphs
- Each demo screenshot gets its own slide (images need space)
- Use relative image paths: `![alt](demos/folder/file.png)`
- Keep text minimal — the screenshots tell the story

### Step 3: Review

- Verify all image paths exist (check against `demos/` directory listing).
- Ensure the presentation reflects the CURRENT state of the product (check spec.md).
- If updating, only change slides affected by new/modified features. Don't rewrite unchanged slides.
- After writing, tell the user they can run `pnpm slides` to view it.
