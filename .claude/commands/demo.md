Create a demo of the Interactive Chat app by capturing a sequence of screenshots.

Input: $ARGUMENTS

## Workflow

### Step 1: Scenario

- If the user provided a vague idea (e.g. "recipe planning", "quiz"), flesh it out into a concrete step-by-step scenario with specific messages and interactions.
- If no input was provided, come up with an interesting scenario that showcases the app's interactive widget capabilities (dropdowns, buttons, tables, cards, sliders, toggles, etc.).
- Present the scenario to the user as a numbered list of steps, e.g.:
  1. Send: "Quiz me on world capitals, 3 questions"
  2. Select "Paris" for the first question
  3. Select "Tokyo" for the second question
  4. Click "Submit Quiz"
- **STOP and wait for user confirmation** before proceeding. The user may tweak the scenario.

### Step 2: Setup

- Ensure dev servers are running on localhost:5173 (frontend) and localhost:3000 (backend) with a **real LLM** (no MOCK_LLM). Start them with `pnpm dev` if not already running.
- Create a `demos/` directory if it doesn't exist.
- Choose a short kebab-case name for this demo (e.g. `capital-quiz`, `dinner-planner`).

### Step 3: Capture

- Use Playwright MCP tools to execute the scenario step by step.
- Navigate to `http://localhost:5173`.
- Set viewport to 780x750 for consistent screenshot sizing.
- Before each action, take a snapshot to understand the current page state.
- After each significant step (sending a message, receiving a response, interacting with a widget), take a screenshot and save it as `demos/<demo-name>/<step-number>-<description>.png` (e.g. `demos/capital-quiz/01-initial-message.png`, `demos/capital-quiz/02-quiz-rendered.png`).
- Wait for LLM responses to fully load before capturing (use `browser_wait_for` or check that widgets are visible).
- Scroll the `.chat-messages` container to top before each screenshot so the user prompt is visible.
- Use viewport screenshots (not `fullPage: true`) since the chat scrolls internally.
- For interactive controls (dropdowns, toggles), capture a screenshot immediately after interaction (before LLM responds) to show the selected value in the dimmed/loading state.

### Step 4: Fix & Improve

- During capture, if you notice issues (wrong UI behavior, cluttered responses, missing interactivity, ugly layout), fix them immediately:
  - **Code bugs**: Fix in the source, rebuild, and re-run the step.
  - **System prompt issues**: If the LLM's responses are too verbose, cluttered, or miss the mark, tweak the system prompt in `backend/src/routes/chat.ts` and restart the backend.
  - **CSS issues**: Fix in `frontend/src/index.css`, the dev server will hot-reload.
- After fixing, re-capture the affected step(s). Don't ship a demo with known issues.

### Step 5: QA

- After capturing, review ALL demo screenshots (including other existing demos in `demos/`):
  - Read each screenshot image file using the Read tool.
  - **Visual checks**: user prompt visible, text readable, UI centered, no clipped content, controls show correct state, no layout glitches, no empty/broken widgets.
  - **Content checks**: LLM responses make sense, data is consistent with controls (e.g. if "Prefer Windows" is checked, no Mac recommendations), no hallucinated or nonsensical text, tables have reasonable data, labels match what was asked.
  - **Flow checks**: screenshots tell a coherent story in sequence — each step logically follows from the previous one.
  - If any screenshot has issues, re-capture it.
- Report any issues found and whether they were fixed.

### Step 6: Summary

- After all steps are captured, list the screenshots with a one-line description of each.
- Report the total number of screenshots and the demo directory path.
