/**
 * PageObserver - IntersectionObserver wrapper for PDF page tracking
 *
 * Uses react-intersection-observer (battle-tested library with 1,344+ dependents)
 * to track page visibility and report to ScrollTrackerService.
 *
 * Key pattern from research:
 * - Use multiple thresholds [0, 0.25, 0.5, 0.75, 1] for granular tracking
 * - Report intersection ratio to central service
 * - Service finds page with highest ratio (not just which crossed threshold)
 *
 * Ultrawide screen fix:
 * - When multiple pages are fully visible (ratio = 1.0), we also report
 *   the distance from page center to viewport center
 * - Service uses this as a tiebreaker to pick the most centered page
 */

import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { scrollTracker } from '../services/ScrollTrackerService';

interface PageObserverProps {
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Child content to render */
  children: React.ReactNode;
  /** Additional styles for the wrapper div */
  style?: React.CSSProperties;
}

export const PageObserver = ({ pageNumber, children, style }: PageObserverProps) => {
  // Use react-intersection-observer with multiple thresholds
  // This gives us granular visibility tracking (0%, 25%, 50%, 75%, 100%)
  const { ref, entry } = useInView({
    threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
    // Don't need triggerOnce since we're tracking continuously
    triggerOnce: false,
  });

  // Report visibility changes to ScrollTrackerService
  useEffect(() => {
    if (entry) {
      // Calculate center distance for ultrawide screen tiebreaking
      // This is the distance from the page's center to the viewport's center
      const rect = entry.boundingClientRect;
      const viewportHeight = entry.rootBounds?.height ?? window.innerHeight;
      const viewportCenter = viewportHeight / 2;
      const pageCenter = rect.top + rect.height / 2;
      const centerDistance = Math.abs(pageCenter - viewportCenter);

      scrollTracker.reportPageVisibility(pageNumber, entry.intersectionRatio, centerDistance);
    }
  }, [pageNumber, entry?.intersectionRatio, entry?.boundingClientRect?.top]);

  // Cleanup when unmounted
  useEffect(() => {
    return () => {
      scrollTracker.unregisterPage(pageNumber);
    };
  }, [pageNumber]);

  return (
    <div ref={ref} data-page={pageNumber} style={style}>
      {children}
    </div>
  );
};

export default PageObserver;
