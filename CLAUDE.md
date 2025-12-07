# PDF Viewer Demo - Long-Running Agent Instructions

## Session Startup Protocol

**CRITICAL: Execute this EVERY session before ANY other work:**

1. Run `pwd` to confirm working directory
2. Check if `feature_list.json` exists:
   - **If NO** → This is the FIRST SESSION. Execute [Initialization Protocol](#initialization-protocol)
   - **If YES** → Execute [Coding Agent Protocol](#coding-agent-protocol)

---

## Initialization Protocol (First Session Only)

If `feature_list.json` does NOT exist, you are the **Initializer Agent**. Your job is to set up the harness for all future sessions.

### Required Steps:

1. **Initialize git repository**
   ```bash
   git init
   git add -A
   git commit -m "Initial state before agent work"
   ```

2. **Create `init.sh`** - Script to start development environment
   ```bash
   #!/bin/bash
   npm install
   npm run dev &
   echo "Dev server running at http://localhost:5173"
   ```

3. **Create `claude-progress.txt`** - Freeform progress notes for session handoff

4. **Create `feature_list.json`** - Structured test specifications
   - Analyze README.md and existing code
   - Generate comprehensive, granular, testable features
   - Each feature must have:
     - `id`: Unique string identifier (e.g., "core.pdf-loads")
     - `category`: "core" | "annotation" | "ui" | "integration"
     - `description`: What the feature does (user-facing behavior)
     - `steps`: Array of natural language verification steps
     - `passes`: `false` (ALL start as false)
   - Use JSON format (not Markdown) - this prevents accidental edits

5. **Run basic verification**
   - Start dev server with `./init.sh`
   - Verify app loads without errors
   - Update `claude-progress.txt` with results

6. **Commit the harness**
   ```bash
   git add init.sh claude-progress.txt feature_list.json CLAUDE.md
   git commit -m "Add long-running agent harness infrastructure"
   ```

---

## Coding Agent Protocol (All Subsequent Sessions)

If `feature_list.json` EXISTS, you are a **Coding Agent**. Your job is to make incremental progress.

### Session Startup (MANDATORY):

1. **Get bearings**
   ```bash
   pwd
   cat claude-progress.txt
   git log --oneline -10
   ```

2. **Start development environment**
   ```bash
   ./init.sh
   ```

3. **Start browser and run fundamental integration test**
   ```bash
   browser start
   browser nav http://localhost:5173
   sleep 3
   browser screenshot
   ```
   - View the screenshot to verify PDF loads and basic UI works
   - **If broken: FIX THIS FIRST** before any new work

4. **Read feature list and select work**
   ```bash
   cat feature_list.json | jq '.features[] | select(.passes == false) | {id, description}' | head -10
   ```
   - Choose ONE feature with `"passes": false`
   - Pick the highest-priority incomplete feature
   - Features should generally be completed in order (core → ui → annotation → integration)

### Work Protocol:

- **ONE FEATURE AT A TIME** - Do not attempt multiple features in a single session
- **Test using natural language interpretation** - See [Feature Testing Workflow](#feature-testing-workflow)
- **Only mark `passes: true`** after careful testing confirms the feature works
- **Commit after each completed feature**

### Session Cleanup (MANDATORY):

Before ending ANY session:

1. **Commit progress**
   ```bash
   git add -A
   git commit -m "Descriptive message of what was done"
   ```

2. **Update `claude-progress.txt`**
   - What was worked on this session
   - What was completed (feature IDs)
   - What the next session should do
   - Any blockers, issues, or notes for future sessions

3. **Leave code in clean state**
   - No half-implemented features
   - No broken builds
   - No undocumented changes

---

## Feature Testing Workflow

Features have natural language steps. You interpret each step and use the `browser` CLI to verify.

### Example: Testing "core.pdf-loads"

**Feature definition:**
```json
{
  "id": "core.pdf-loads",
  "description": "PDF loads and displays from remote URL",
  "steps": [
    "Navigate to http://localhost:5173",
    "Wait for the PDF engine to finish loading",
    "Verify PDF content is visible on screen",
    "Verify at least one page of the PDF is rendered"
  ]
}
```

**How to test (interpret each step):**

**Step 1: "Navigate to http://localhost:5173"**
```bash
browser nav http://localhost:5173
```

**Step 2: "Wait for the PDF engine to finish loading"**
```bash
# Check if loading message is gone
browser eval "document.body.innerText.includes('Loading')"
# If true, wait and check again. If false, loading is complete.
```

**Step 3: "Verify PDF content is visible on screen"**
```bash
browser screenshot
# View the screenshot - is PDF content visible?
```

**Step 4: "Verify at least one page of the PDF is rendered"**
```bash
browser eval "document.querySelectorAll('canvas').length"
# Should return >= 1
```

**If all steps pass:** Update feature_list.json to set `"passes": true`

### Browser CLI Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `browser start` | Launch Chrome | `browser start` |
| `browser nav <url>` | Navigate | `browser nav http://localhost:5173` |
| `browser screenshot` | Capture viewport | `browser screenshot` |
| `browser eval <code>` | Run JavaScript | `browser eval "document.title"` |
| `browser content` | Extract page text | `browser content` |

### Interpreting Steps - Guidelines

- **"Load the PDF viewer"** → `browser nav http://localhost:5173`
- **"Click the X button"** → `browser eval "document.querySelector('button:contains(X)').click()"` or find the right selector
- **"Verify X is visible"** → `browser screenshot` then visually confirm, or `browser eval` to check DOM
- **"Verify button is selected"** → Check for CSS class or style change via `browser eval`
- **"Wait for X"** → Poll with `browser eval` until condition is true

### When Steps Fail

If a step doesn't work as expected:
1. **Investigate** - Use `browser eval` to explore the DOM
2. **Take screenshots** - Understand current visual state
3. **Try alternatives** - Different selectors, different approaches
4. **Document blockers** - If truly stuck, note in `claude-progress.txt`

This is the power of natural language steps - you can adapt and problem-solve rather than failing on a rigid script.

---

## Critical Rules

### Feature List Protection

> **"It is unacceptable to remove or edit tests because this could lead to missing or buggy functionality."**

When editing `feature_list.json`:
- You may ONLY change `"passes": false` → `"passes": true`
- You may NOT remove features
- You may NOT edit feature descriptions or steps
- You may NOT reduce the scope of any feature

### Testing Requirements

- Every feature must be tested end-to-end as a user would experience it
- Use `browser` CLI to verify - don't just read the code
- Take screenshots to confirm visual state
- If a feature cannot be tested, document why in progress notes

### Git Discipline

- Commit early and often
- Use descriptive commit messages
- Never leave uncommitted work at end of session

---

## Project Context

### Tech Stack
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **PDF Engine**: EmbedPDF with PDFium renderer
- **Dev Server**: `npm run dev` → http://localhost:5173

### Architecture
```
src/
├── App.tsx              # Root component
├── main.tsx             # Entry point
├── components/
│   ├── PDFViewer.tsx    # PDF viewer with plugins
│   └── AnnotationToolbar.tsx  # Tool buttons
```

### Toolbar Buttons
- Highlight, Pen, Square, Circle, Text, Delete

---

## Useful Commands

```bash
# Dev server
npm run dev

# Check feature progress
cat feature_list.json | jq '{total: .total_features, completed: .completed}'

# List failing features
cat feature_list.json | jq '.features[] | select(.passes == false) | .id'
```
