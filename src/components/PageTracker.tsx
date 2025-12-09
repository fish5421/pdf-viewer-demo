/**
 * PageTracker - Internal component for tracking page changes
 *
 * Must be rendered inside EmbedPDF context to access useScroll hook.
 * Handles:
 * - Saving current page to localStorage on change
 * - Restoring saved page position on mount
 */

import { useEffect, useRef, useState } from 'react';
import { useScrollCapability } from '@embedpdf/plugin-scroll/react';

interface PageTrackerProps {
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
  /** Initial page to restore (1-indexed) */
  initialPage?: number;
  /** Whether storage is ready */
  storageReady?: boolean;
}

export const PageTracker = ({ onPageChange, initialPage, storageReady }: PageTrackerProps) => {
  const { provides: scrollCapability, isLoading } = useScrollCapability();
  const [isReady, setIsReady] = useState(false);
  const hasRestoredRef = useRef(false);
  const lastReportedPageRef = useRef<number | null>(null);

  // Wait for scroll capability to be ready
  useEffect(() => {
    if (!isLoading && scrollCapability) {
      setIsReady(true);
      console.log('[PageTracker] Scroll capability ready');
    }
  }, [isLoading, scrollCapability]);

  // Subscribe to page changes
  useEffect(() => {
    if (!isReady || !scrollCapability?.onPageChange) return;

    // Note: onPageChange is a direct function in newer EmbedPDF versions
    const unsubscribe = scrollCapability.onPageChange((payload: { pageNumber: number; totalPages: number }) => {
      const page = payload.pageNumber;

      // Avoid reporting duplicate page changes
      if (lastReportedPageRef.current === page) return;
      lastReportedPageRef.current = page;

      console.log(`[PageTracker] Page changed to ${page}/${payload.totalPages}`);
      onPageChange?.(page);
    });

    return () => {
      unsubscribe();
    };
  }, [isReady, scrollCapability, onPageChange]);

  // Restore saved page position once storage is ready and scroll is available
  useEffect(() => {
    if (
      !storageReady ||
      !isReady ||
      !scrollCapability?.scrollToPage ||
      hasRestoredRef.current ||
      !initialPage ||
      initialPage <= 1
    ) {
      return;
    }

    const totalPages = scrollCapability.getTotalPages?.() ?? 0;

    // Only restore if the initial page is valid
    if (totalPages > 0 && initialPage > totalPages) {
      console.log(`[PageTracker] Initial page ${initialPage} exceeds total ${totalPages}, skipping restore`);
      return;
    }

    // Small delay to ensure scroll layout is ready
    const timer = setTimeout(() => {
      console.log(`[PageTracker] Restoring to page ${initialPage}`);
      scrollCapability.scrollToPage({ pageNumber: initialPage, behavior: 'instant' });
      hasRestoredRef.current = true;
    }, 200);

    return () => clearTimeout(timer);
  }, [storageReady, isReady, scrollCapability, initialPage]);

  // Also report the initial page once loaded
  useEffect(() => {
    if (!isReady || !scrollCapability?.getCurrentPage) return;

    const currentPage = scrollCapability.getCurrentPage();
    if (currentPage > 0 && lastReportedPageRef.current !== currentPage) {
      lastReportedPageRef.current = currentPage;
      onPageChange?.(currentPage);
    }
  }, [isReady, scrollCapability, onPageChange]);

  // This component doesn't render anything - it's just for tracking
  return null;
};

export default PageTracker;
