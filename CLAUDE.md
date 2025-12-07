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
     - `id`: Unique number
     - `category`: "core" | "annotation" | "ui" | "integration"
     - `description`: What the feature does (user-facing behavior)
     - `steps`: Array of verification steps (how to test it)
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
   # Start Chrome with remote debugging
   browser start

   # Navigate to app
   browser nav http://localhost:5173

   # Wait briefly for PDF engine to load, then take screenshot
   sleep 3
   browser screenshot
   ```
   - Verify PDF loads and basic interaction works (check screenshot)
   - **If broken: FIX THIS FIRST** before any new work

4. **Read feature list and select work**
   ```bash
   cat feature_list.json | jq '.features[] | select(.passes == false) | {id, category, description}' | head -20
   ```
   - Choose ONE feature with `"passes": false`
   - Pick the highest-priority incomplete feature
   - Features should generally be completed in order (core → annotation → ui → integration)

### Work Protocol:

- **ONE FEATURE AT A TIME** - Do not attempt multiple features in a single session
- **Test thoroughly** - Use `browser` CLI for end-to-end verification (see [Browser CLI Testing](#browser-cli-testing))
- **Only mark `passes: true`** after careful testing confirms the feature works as a user would experience it
- **Commit after each completed feature** - Small, atomic commits with descriptive messages

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
   - Code should be mergeable to main

---

## Critical Rules

### Feature List Protection

> **"It is unacceptable to remove or edit tests because this could lead to missing or buggy functionality."**

When editing `feature_list.json`:
- You may ONLY change `"passes": false` → `"passes": true`
- You may NOT remove features
- You may NOT edit feature descriptions
- You may NOT edit verification steps
- You may NOT reduce the scope of any feature

### Incremental Progress

- Complete ONE feature fully before starting another
- If a feature is too large, document the breakdown in `claude-progress.txt`
- Never declare the project "complete" - always check `feature_list.json` for remaining work
- If all features pass, document this clearly and ask user for next steps

### Testing Requirements

- Every feature must be tested end-to-end as a user would experience it
- For UI features: Use `browser` CLI to verify visual and interactive behavior
- Do not mark features as passing based on code inspection alone
- If a feature cannot be tested (e.g., missing tools), document in progress notes

### Git Discipline

- Commit early and often
- Use descriptive commit messages that explain the "why"
- Never leave uncommitted work at end of session
- Use git to recover from mistakes: `git diff`, `git stash`, `git checkout`

---

## Project Context

### Tech Stack
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **PDF Engine**: EmbedPDF with PDFium renderer
- **Dev Server**: `npm run dev` → http://localhost:5173

### Current Architecture
```
src/
├── App.tsx              # Root component, renders PDFViewer
├── main.tsx             # Entry point
├── components/
│   ├── PDFViewer.tsx    # Main PDF viewer with all plugins
│   └── AnnotationToolbar.tsx  # Tool selection UI
```

### Implemented Annotation Tools (in toolbar)
- Highlight (text highlighting)
- Pen/Ink (freehand drawing)
- Square (rectangle shapes)
- Circle (ellipse shapes)
- FreeText (text annotations)
- Delete (remove selected annotation)

### Available but NOT in toolbar
- underline, strikeout, squiggly (text markup)
- inkHighlighter (freehand highlighter)
- line, lineArrow (straight lines)
- polyline, polygon (multi-segment shapes)
- stamp (image stamps)

### Key APIs
- `useAnnotationCapability()` - Hook for annotation operations
- `annotationApi.setActiveTool(toolId)` - Activate a tool
- `annotationApi.deleteAnnotation(pageIndex, id)` - Delete annotation
- `annotationApi.onStateChange(callback)` - Listen for state changes
- `annotationApi.getSelectedAnnotation()` - Get current selection

---

## Browser CLI Testing

The `browser` CLI tool provides end-to-end testing capabilities via Chrome DevTools Protocol.

### Quick Start

```bash
# 1. Start Chrome with remote debugging
browser start

# 2. Navigate to URL
browser nav http://localhost:5173

# 3. Take screenshot (outputs filepath to /tmp/)
browser screenshot

# 4. Evaluate JavaScript on page
browser eval "document.title"
browser eval "document.querySelectorAll('button').length"
```

### Manual Testing Commands

| Command | Description | Example |
|---------|-------------|---------|
| `browser start` | Launch Chrome | `browser start --profile` (keep cookies) |
| `browser nav <url>` | Navigate to URL | `browser nav http://localhost:5173 --new` |
| `browser screenshot` | Capture viewport | `browser screenshot --element "#toolbar"` |
| `browser eval <code>` | Run JavaScript | `browser eval "document.title"` |
| `browser content` | Extract page markdown | `browser content` |
| `browser cookies` | Dump cookies | `browser cookies` |
| `browser pick <prompt>` | Interactive element picker | `browser pick "Select button"` |

### Screenshot Options

```bash
# Default: 1280x720 JPEG (~1229 tokens for Claude vision)
browser screenshot

# Crop to element (smaller, focused)
browser screenshot --element "#annotation-toolbar"

# Custom viewport
browser screenshot --viewport 1920x1080

# Full page scroll capture
browser screenshot --full

# PNG instead of JPEG
browser screenshot --png
```

### Scenario-Based Testing (Automated)

For repeatable tests, create scenario files in `./scenarios/`:

**scenarios/pdf-loads.json:**
```json
{
  "name": "pdf.loads",
  "steps": [
    {"action": "navigate", "url": "http://localhost:5173"},
    {"action": "waitFor", "selector": "canvas", "timeout": 10000},
    {"action": "assert", "type": "exists", "selector": ".annotation-toolbar"},
    {"action": "screenshot", "name": "pdf-loaded"}
  ]
}
```

**Run scenario:**
```bash
browser run pdf.loads --dev-server "npm run dev" --dev-port 5173
```

**Scenario actions:**
- `navigate` - Go to URL
- `type` - Enter text in input
- `click` - Click element
- `waitFor` - Wait for selector
- `assert` - Verify condition (text, url, exists, notExists)
- `screenshot` - Capture viewport
- `eval` - Run JavaScript

### Testing Workflow for Features

```bash
# 1. Ensure browser is started
browser start

# 2. Navigate to app
browser nav http://localhost:5173

# 3. For each feature verification step:

# Check element exists
browser eval "!!document.querySelector('#toolbar')"

# Check button text
browser eval "document.querySelector('button').textContent"

# Click button and verify state change
browser eval "document.querySelector('[data-tool=highlight]').click()"
browser screenshot  # Verify visual state

# Count elements
browser eval "document.querySelectorAll('.annotation').length"
```

### Interpreting Screenshots

Screenshots are saved to `/tmp/screenshot-<timestamp>.jpg`. To view:
- Use the Read tool: `Read /tmp/screenshot-2024-01-15T10-30-45-123Z.jpg`
- Claude can analyze the image to verify visual state

---

## Useful Commands

```bash
# Start development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Git status
git status

# Recent commits
git log --oneline -10

# Check feature progress
cat feature_list.json | jq '{total: .total_features, completed: .completed, remaining: (.total_features - .completed)}'
```
