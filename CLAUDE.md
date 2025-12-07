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

3. **Run fundamental integration test**
   - Open http://localhost:5173 in browser (use Playwright MCP if available)
   - Verify PDF loads and basic interaction works
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
- **Test thoroughly** - Use browser automation (Playwright MCP) for end-to-end verification
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
- For UI features: Use browser automation to verify visual and interactive behavior
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
