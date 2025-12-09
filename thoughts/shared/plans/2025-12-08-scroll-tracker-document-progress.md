# Scroll Tracker: Replace Page % with Document Progress

## Overview

Replace the misleading `viewportProgress` (intersection ratio) with meaningful `documentProgress` (overall reading progress through the PDF). This fixes the UX issue on ultrawide screens where page % always shows ~100% because entire pages are visible.

## Current State Analysis

### What exists now:
- `ScrollTrackerService.ts:16-21` - `CurrentView` interface with `{ pageNumber, viewportProgress }`
- `viewportProgress` = intersection ratio (how much of page is visible in viewport)
- On ultrawide: Always shows 90-100% because full pages are visible
- UI displays: `"Page 3 (90%)"` - confusing because user sees 100% of the page

### Key discoveries:
- **No downstream features use `viewportProgress`** - All AI features only use `pageNumber`
- The intersection ratio was designed for narrow screens (scroll through page)
- On ultrawide, intersection ratio is meaningless (whole page visible = 1.0)

### Files involved:
- `src/services/ScrollTrackerService.ts` - Core service
- `src/components/PageObserver.tsx` - Reports visibility
- `src/components/PDFViewer.tsx` - Displays status indicator

## Desired End State

After implementation:
- `window.Engram.currentView` exposes `{ pageNumber, documentProgress, totalPages }`
- `documentProgress` = `(pageNumber - 1) / totalPages` (0.0 at page 1, 1.0 at last page)
- UI displays: `"Page 3 of 4 (75%)"` - showing overall reading progress
- Works correctly on both ultrawide and narrow screens

### Verification:
- On page 1 of 4: Shows "Page 1 of 4 (0%)"
- On page 2 of 4: Shows "Page 2 of 4 (25%)"
- On page 3 of 4: Shows "Page 3 of 4 (50%)"
- On page 4 of 4: Shows "Page 4 of 4 (75%)" or "Page 4 of 4 (100%)" at bottom

## What We're NOT Doing

- NOT removing `viewportProgress` from the interface (backwards compatibility)
- NOT changing PageObserver intersection tracking (still needed for page detection)
- NOT adding page-level scroll tracking (no features need it)
- NOT making this configurable (document progress is universally better)

## Implementation Approach

Simple refactor: Calculate document progress from page number, update UI display.

---

## Phase 1: Extend CurrentView Interface

### Overview
Add `documentProgress` and `totalPages` to the CurrentView interface while keeping backwards compatibility.

### Changes Required:

#### 1. ScrollTrackerService.ts - Interface Update
**File**: `src/services/ScrollTrackerService.ts`
**Changes**: Extend CurrentView interface

```typescript
export interface CurrentView {
  /** Current page number (1-indexed) */
  pageNumber: number;
  /** @deprecated Use documentProgress instead. Intersection ratio of most visible page. */
  viewportProgress: number;
  /** Progress through entire document (0.0 = start, 1.0 = end) */
  documentProgress: number;
  /** Total pages in document */
  totalPages: number;
}
```

#### 2. ScrollTrackerService.ts - Calculate documentProgress
**File**: `src/services/ScrollTrackerService.ts`
**Changes**: Update getCurrentView and internal state

```typescript
private currentView: CurrentView = {
  pageNumber: 1,
  viewportProgress: 0,
  documentProgress: 0,
  totalPages: 1
};

getCurrentView(): CurrentView {
  return { ...this.currentView };
}
```

#### 3. ScrollTrackerService.ts - Update on page change
**File**: `src/services/ScrollTrackerService.ts`
**Changes**: Calculate documentProgress in reportPageVisibility

In `reportPageVisibility()`, after determining `bestPage`:
```typescript
// Calculate document progress: 0.0 at page 1, approaching 1.0 at last page
// Formula: (currentPage - 1) / (totalPages - 1) for even distribution
// Or simpler: (currentPage - 1) / totalPages for "pages completed"
const documentProgress = this.totalPages > 1
  ? Math.round(((bestPage - 1) / (this.totalPages - 1)) * 100) / 100
  : 0;

// Update state
this.currentView = {
  pageNumber: bestPage,
  viewportProgress,  // Keep for backwards compat
  documentProgress,
  totalPages: this.totalPages
};
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run build`
- [x] `window.Engram.currentView.documentProgress` is a number 0-1
- [x] `window.Engram.currentView.totalPages` equals 4

#### Manual Verification:
- [x] Scroll through PDF, verify documentProgress increases monotonically

---

## Phase 2: Update UI Display

### Overview
Change the status indicator to show document progress instead of page visibility.

### Changes Required:

#### 1. PDFViewer.tsx - Update status display
**File**: `src/components/PDFViewer.tsx`
**Changes**: Update the status indicator JSX (around line 251)

From:
```tsx
{`Page ${currentView.pageNumber} (${Math.round(currentView.viewportProgress * 100)}%)`}
```

To:
```tsx
{`Page ${currentView.pageNumber} of ${currentView.totalPages} (${Math.round(currentView.documentProgress * 100)}%)`}
```

#### 2. PDFViewer.tsx - Update state type
**File**: `src/components/PDFViewer.tsx`
**Changes**: Update the useState type (around line 74)

From:
```tsx
const [currentView, setCurrentView] = useState<{ pageNumber: number; viewportProgress: number }>({ pageNumber: 1, viewportProgress: 0 });
```

To:
```tsx
const [currentView, setCurrentView] = useState<{
  pageNumber: number;
  viewportProgress: number;
  documentProgress: number;
  totalPages: number;
}>({ pageNumber: 1, viewportProgress: 0, documentProgress: 0, totalPages: 4 });
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run build`
- [x] No console errors in browser

#### Manual Verification:
- [x] Page 1: Shows "Page 1 of 4 (0%)"
- [x] Page 2: Shows "Page 2 of 4 (33%)"
- [x] Page 3: Shows "Page 3 of 4 (67%)"
- [x] Page 4: Shows "Page 4 of 4 (100%)"

---

## Phase 3: Update Window Type Declaration

### Overview
Ensure TypeScript knows about the new CurrentView shape on window.Engram.

### Changes Required:

#### 1. HybridLoader.ts - Update Window interface
**File**: `src/services/HybridLoader.ts`
**Changes**: Update the Engram.currentView type in Window interface

Find the Window interface declaration and update currentView:
```typescript
currentView: {
  pageNumber: number;
  viewportProgress: number;
  documentProgress: number;
  totalPages: number;
};
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles with no errors: `npm run build`
- [x] `window.Engram.currentView.documentProgress` has proper type hints (via CurrentView import)

---

## Testing Strategy

### Automated Tests:
- Build passes: `npm run build`
- Type checking: `npx tsc --noEmit`

### Manual Testing Steps:
1. Load PDF viewer at http://localhost:5173
2. Verify initial state: "Page 1 of 4 (0%)"
3. Scroll to page 2, verify: "Page 2 of 4 (33%)"
4. Scroll to page 3, verify: "Page 3 of 4 (67%)"
5. Scroll to page 4, verify: "Page 4 of 4 (100%)"
6. Open console, run: `window.Engram.currentView`
7. Verify output includes `documentProgress` and `totalPages`

## Performance Considerations

None - this is a simple calculation on existing data.

## Migration Notes

- `viewportProgress` is kept but deprecated
- Existing code using `window.Engram.currentView.pageNumber` continues to work
- New code should use `documentProgress` for reading progress

## References

- Original issue: Ultrawide screen shows misleading page %
- Fix applied: Center-distance tiebreaking for page detection
- This plan: Semantic improvement to progress display
