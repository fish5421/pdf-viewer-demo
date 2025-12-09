/**
 * ScrollTrackerService - Real-time tracking of user's current view position
 *
 * Uses IntersectionObserver pattern (industry standard) to track page visibility.
 * Based on react-intersection-observer best practices.
 *
 * Exposes window.Engram.currentView for AI integration:
 * - pageNumber: Current page being viewed (1-indexed)
 * - viewportProgress: How far through the page (0.0 = top, 1.0 = bottom)
 *
 * Key insight from research: Track intersection ratios for ALL pages,
 * then find the one with highest visibility - don't just track which
 * page crossed a threshold.
 */

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

export interface PageVisibility {
  pageNumber: number;
  ratio: number; // 0 to 1 intersection ratio
  /** Distance from page center to viewport center (pixels). Lower = more centered. */
  centerDistance?: number;
}

type ViewChangeListener = (view: CurrentView) => void;

class ScrollTrackerServiceClass {
  private currentView: CurrentView = { pageNumber: 1, viewportProgress: 0, documentProgress: 0, totalPages: 1 };
  private listeners: Set<ViewChangeListener> = new Set();
  private initialized = false;
  private totalPages = 4;

  // Track visibility for ALL pages: { ratio, centerDistance }
  // Key insight: When multiple pages are fully visible (ultrawide screens),
  // we use centerDistance to pick the most centered page.
  private pageVisibilities: Map<number, { ratio: number; centerDistance: number }> = new Map();

  /**
   * Report page visibility from IntersectionObserver
   * Called by PageObserver component when intersection ratio changes
   *
   * @param pageNumber - 1-indexed page number
   * @param intersectionRatio - 0 to 1, how much of the page is visible
   * @param centerDistance - Distance from page center to viewport center (pixels)
   */
  reportPageVisibility(pageNumber: number, intersectionRatio: number, centerDistance: number = Infinity): void {
    // Store both ratio and centerDistance for this page
    this.pageVisibilities.set(pageNumber, { ratio: intersectionRatio, centerDistance });

    // Find the best page using a two-tier approach:
    // 1. Primary: Highest visibility ratio
    // 2. Tiebreaker: Smallest center distance (most centered in viewport)
    let bestPage = 1;
    let bestRatio = 0;
    let bestCenterDistance = Infinity;

    this.pageVisibilities.forEach((vis, page) => {
      // If this page has a higher ratio, it wins
      if (vis.ratio > bestRatio) {
        bestRatio = vis.ratio;
        bestCenterDistance = vis.centerDistance;
        bestPage = page;
      }
      // If same ratio (e.g., both 100% visible on ultrawide), use center distance
      else if (vis.ratio === bestRatio && vis.centerDistance < bestCenterDistance) {
        bestCenterDistance = vis.centerDistance;
        bestPage = page;
      }
    });

    // Convert ratio to progress (0.0 to 1.0)
    // Round to 1 decimal place for display (10% steps)
    const viewportProgress = Math.round(bestRatio * 10) / 10;

    // Calculate document progress: 0.0 at page 1, 1.0 at last page
    // Formula: (currentPage - 1) / (totalPages - 1) for even distribution
    const documentProgress = this.totalPages > 1
      ? Math.round(((bestPage - 1) / (this.totalPages - 1)) * 100) / 100
      : 0;

    // Only update if changed
    if (
      this.currentView.pageNumber !== bestPage ||
      this.currentView.viewportProgress !== viewportProgress ||
      this.currentView.documentProgress !== documentProgress
    ) {
      this.currentView = {
        pageNumber: bestPage,
        viewportProgress,
        documentProgress,
        totalPages: this.totalPages
      };
      this.notifyListeners();
      this.syncToWindow();
    }
  }

  /**
   * Remove page from tracking (when unmounted)
   */
  unregisterPage(pageNumber: number): void {
    this.pageVisibilities.delete(pageNumber);
  }

  /**
   * Clear all page visibilities (on document change)
   */
  reset(): void {
    this.pageVisibilities.clear();
    this.currentView = { pageNumber: 1, viewportProgress: 0, documentProgress: 0, totalPages: this.totalPages };
    this.syncToWindow();
  }

  /**
   * Set view directly (e.g., from navigation)
   */
  setView(pageNumber: number, viewportProgress: number = 0): void {
    const clampedPage = Math.max(1, Math.min(pageNumber, this.totalPages));
    const clampedProgress = Math.max(0, Math.min(Math.round(viewportProgress * 10) / 10, 1));
    const documentProgress = this.totalPages > 1
      ? Math.round(((clampedPage - 1) / (this.totalPages - 1)) * 100) / 100
      : 0;

    this.currentView = {
      pageNumber: clampedPage,
      viewportProgress: clampedProgress,
      documentProgress,
      totalPages: this.totalPages
    };
    this.notifyListeners();
    this.syncToWindow();
  }

  /**
   * Set total pages (called when document loads)
   */
  setTotalPages(total: number): void {
    this.totalPages = total;
  }

  /**
   * Get current view state
   */
  getCurrentView(): CurrentView {
    return { ...this.currentView };
  }

  /**
   * Get total pages
   */
  getTotalPages(): number {
    return this.totalPages;
  }

  /**
   * Get all page visibilities (for debugging)
   */
  getPageVisibilities(): Map<number, { ratio: number; centerDistance: number }> {
    return new Map(this.pageVisibilities);
  }

  /**
   * Subscribe to view changes
   */
  subscribe(listener: ViewChangeListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(this.getCurrentView());
    return () => this.listeners.delete(listener);
  }

  /**
   * Initialize and expose on window.Engram
   */
  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.syncToWindow();
    console.log('[ScrollTracker] Initialized with IntersectionObserver - access via window.Engram.currentView');
  }

  private notifyListeners(): void {
    const view = this.getCurrentView();
    this.listeners.forEach(listener => listener(view));
  }

  private syncToWindow(): void {
    if (typeof window !== 'undefined') {
      window.Engram = window.Engram || {} as Window['Engram'];
      window.Engram.currentView = this.getCurrentView();
    }
  }

  // ============================================
  // LEGACY: Scroll-based fallback (deprecated)
  // Kept for backwards compatibility
  // ============================================

  /**
   * @deprecated Use reportPageVisibility instead
   * Legacy scroll-based update - kept for backwards compatibility
   */
  updateFromScroll(scrollTop: number, pageHeight: number, totalPages: number): void {
    if (pageHeight <= 0 || totalPages <= 0) return;

    this.totalPages = totalPages;

    // Simple calculation for fallback
    const rawPage = Math.floor(scrollTop / pageHeight) + 1;
    const pageNumber = Math.max(1, Math.min(rawPage, totalPages));

    const pageStartOffset = (pageNumber - 1) * pageHeight;
    const positionInPage = scrollTop - pageStartOffset;
    const rawProgress = positionInPage / pageHeight;
    const viewportProgress = Math.round(Math.max(0, Math.min(rawProgress, 1)) * 10) / 10;
    const documentProgress = totalPages > 1
      ? Math.round(((pageNumber - 1) / (totalPages - 1)) * 100) / 100
      : 0;

    if (
      this.currentView.pageNumber !== pageNumber ||
      this.currentView.viewportProgress !== viewportProgress ||
      this.currentView.documentProgress !== documentProgress
    ) {
      this.currentView = {
        pageNumber,
        viewportProgress,
        documentProgress,
        totalPages
      };
      this.notifyListeners();
      this.syncToWindow();
    }
  }
}

// Singleton instance
export const scrollTracker = new ScrollTrackerServiceClass();

// Auto-initialize when module loads
if (typeof window !== 'undefined') {
  scrollTracker.initialize();
}

export default scrollTracker;
