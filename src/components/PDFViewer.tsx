import { useEffect, useCallback, useState, useRef } from 'react';
import { createPluginRegistration } from '@embedpdf/core';
import { EmbedPDF } from '@embedpdf/core/react';
import { usePdfiumEngine } from '@embedpdf/engines/react';

// Import essential plugins
import { Viewport, ViewportPluginPackage } from '@embedpdf/plugin-viewport/react';
import { Scroller, ScrollPluginPackage } from '@embedpdf/plugin-scroll/react';
import { LoaderPluginPackage } from '@embedpdf/plugin-loader/react';
import { RenderLayer, RenderPluginPackage } from '@embedpdf/plugin-render/react';

// Import annotation plugins
import { InteractionManagerPluginPackage } from '@embedpdf/plugin-interaction-manager/react';
import { SelectionPluginPackage } from '@embedpdf/plugin-selection/react';
import { HistoryPluginPackage } from '@embedpdf/plugin-history/react';
import { AnnotationPluginPackage } from '@embedpdf/plugin-annotation/react';
import { PagePointerProvider } from '@embedpdf/plugin-interaction-manager/react';
import { AnnotationLayer } from '@embedpdf/plugin-annotation/react';
import { SelectionLayer } from '@embedpdf/plugin-selection/react';

import { AnnotationToolbar } from './AnnotationToolbar';
// PageTracker disabled - using simpler approach without EmbedPDF scroll hooks
// import { PageTracker } from './PageTracker';
import { useHybridLoader } from '../hooks/useHybridLoader';
// Simplified storage - IndexedDB implementation commented out for debugging
// import { useStorage } from '../hooks/useStorage';

// PDF URL - used by both EmbedPDF visual layer and HybridLoader context layer
const PDF_URL = 'https://snippet.embedpdf.com/ebook.pdf';

// Register all plugins
const plugins = [
  createPluginRegistration(LoaderPluginPackage, {
    loadingOptions: {
      type: 'url',
      pdfFile: {
        id: 'example-pdf',
        url: PDF_URL,
      },
    },
  }),
  createPluginRegistration(ViewportPluginPackage),
  createPluginRegistration(ScrollPluginPackage),
  createPluginRegistration(RenderPluginPackage),

  // Register annotation dependencies first
  createPluginRegistration(InteractionManagerPluginPackage),
  createPluginRegistration(SelectionPluginPackage),
  createPluginRegistration(HistoryPluginPackage),

  // Register and configure the annotation plugin
  createPluginRegistration(AnnotationPluginPackage, {
    annotationAuthor: 'Manus AI User',
  }),
];

export const PDFViewer = () => {
  // Initialize the PDFium engine (Visual Layer)
  const { engine, isLoading: engineLoading } = usePdfiumEngine();

  // Initialize the HybridLoader (Context Layer for LLM)
  const {
    loadFromUrl,
    isLoading: contextLoading,
    isReady: contextReady,
    context,
    error: contextError,
  } = useHybridLoader();

  // Initialize IndexedDB storage for persistence - simplified inline version
  const [storageReady, setStorageReady] = useState(false);
  const [storedPage, setStoredPage] = useState<number | null>(null);
  const [initialPage, setInitialPage] = useState<number | null>(null);
  const storageError = null;
  const progress = storedPage ? { currentPage: storedPage } : null;
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageHeightEstimate = useRef(800); // Will be updated on scroll

  // Initialize storage on mount and restore scroll position
  useEffect(() => {
    const initStorage = async () => {
      try {
        // Use localStorage as a simple fallback for now
        const stored = localStorage.getItem('engram-pdf-page');
        if (stored) {
          const page = parseInt(stored, 10);
          setStoredPage(page);
          setInitialPage(page);
          console.log('[Storage] Restored page:', page);
        }
        setStorageReady(true);
        console.log('[Storage] Ready');
      } catch (err) {
        console.error('[Storage] Init failed:', err);
        setStorageReady(true); // Still mark as ready to not block the UI
      }
    };
    initStorage();
  }, []);

  // Handle page change - save to localStorage
  const handlePageChange = useCallback((page: number) => {
    if (storageReady && page !== storedPage) {
      localStorage.setItem('engram-pdf-page', String(page));
      setStoredPage(page);
      console.log('[Storage] Saved page:', page);
    }
  }, [storageReady, storedPage]);

  // Track scroll position to detect page changes
  useEffect(() => {
    if (!storageReady) return;

    let scrollContainer: HTMLDivElement | null = null;
    let scrollHandler: (() => void) | null = null;

    // Find the scrollable viewport container after PDF loads
    const setupScrollTracking = () => {
      // Find element with significant scrollable content
      const allElements = Array.from(document.querySelectorAll('*')) as HTMLDivElement[];
      scrollContainer = allElements.find(el => el.scrollHeight > el.clientHeight + 100) || null;
      if (!scrollContainer) {
        console.log('[Storage] No scroll container found, retrying...');
        setTimeout(setupScrollTracking, 500);
        return;
      }
      console.log('[Storage] Found scroll container:', scrollContainer.tagName, 'scrollHeight:', scrollContainer.scrollHeight);

      scrollContainerRef.current = scrollContainer;

      // Get page height estimate from canvas elements (each page is a canvas)
      const canvases = scrollContainer.querySelectorAll('canvas');
      if (canvases.length > 0) {
        const firstCanvas = canvases[0] as HTMLCanvasElement;
        pageHeightEstimate.current = firstCanvas.offsetHeight + 20; // Include margin
        console.log('[Storage] Page height estimate:', pageHeightEstimate.current);
      }

      // Track scroll changes
      let hasRestoredPage = false;
      scrollHandler = () => {
        if (!scrollContainer) return;
        const scrollTop = scrollContainer.scrollTop;

        // Calculate current page based on scroll position
        const currentPage = Math.floor(scrollTop / pageHeightEstimate.current) + 1;
        const maxPages = 4; // We know this PDF has 4 pages
        const clampedPage = Math.max(1, Math.min(currentPage, maxPages));

        // Don't save during initial restore
        if (!hasRestoredPage && initialPage && initialPage > 1) {
          return;
        }
        handlePageChange(clampedPage);
      };

      scrollContainer.addEventListener('scroll', scrollHandler, { passive: true });

      // Restore scroll position if we have a saved page
      if (initialPage && initialPage > 1) {
        const scrollTarget = (initialPage - 1) * pageHeightEstimate.current;
        console.log('[Storage] Restoring scroll to page', initialPage, 'position:', scrollTarget);
        scrollContainer.scrollTo({ top: scrollTarget, behavior: 'instant' });

        // Mark as restored after a short delay to allow scroll to complete
        setTimeout(() => {
          hasRestoredPage = true;
          setInitialPage(null);
          // Update indicator to show restored page
          handlePageChange(initialPage);
        }, 100);
      } else {
        hasRestoredPage = true;
        // Report initial page
        scrollHandler();
      }
    };

    // Wait longer for PDF to fully render before setting up scroll tracking
    const timer = setTimeout(setupScrollTracking, 2500);

    return () => {
      clearTimeout(timer);
      if (scrollContainer && scrollHandler) {
        scrollContainer.removeEventListener('scroll', scrollHandler);
      }
    };
  }, [storageReady, initialPage, handlePageChange]);

  // Load the context layer when component mounts
  useEffect(() => {
    loadFromUrl(PDF_URL).catch(err => {
      console.error('[HybridLoader] Failed to load context:', err);
    });
  }, [loadFromUrl]);

  // Log context status for debugging
  useEffect(() => {
    if (contextReady && context) {
      console.log('[HybridLoader] Context ready:', {
        pageCount: context.pageCount,
        base64Length: context.base64.length,
        textMapPages: context.textMap.length,
        metadata: context.metadata,
      });
      console.log('[HybridLoader] Access via window.Engram.documentContext');
    }
    if (contextError) {
      console.error('[HybridLoader] Context error:', contextError);
    }
  }, [contextReady, context, contextError]);

  // Log storage status - simplified version
  // (logging already done in initStorage)

  if (engineLoading || !engine) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: '#666',
      }}>
        Loading PDF Engine...
      </div>
    );
  }

  // Render the viewer
  return (
    <div style={{ height: '100vh', position: 'relative' }}>
      {/* Status Indicators */}
      <div style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        zIndex: 1000,
      }}>
        {/* Context Layer Status */}
        <div style={{
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontFamily: 'monospace',
          backgroundColor: contextReady ? '#d4edda' : contextLoading ? '#fff3cd' : contextError ? '#f8d7da' : '#e2e3e5',
          color: contextReady ? '#155724' : contextLoading ? '#856404' : contextError ? '#721c24' : '#383d41',
          border: `1px solid ${contextReady ? '#c3e6cb' : contextLoading ? '#ffeeba' : contextError ? '#f5c6cb' : '#d6d8db'}`,
        }}>
          {contextLoading && '⏳ Loading LLM Context...'}
          {contextReady && `✅ Context Ready (${context?.pageCount} pages)`}
          {contextError && `❌ Context Error`}
          {!contextLoading && !contextReady && !contextError && '⏸️ Context Pending'}
        </div>
        {/* Storage Status */}
        <div style={{
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontFamily: 'monospace',
          backgroundColor: storageReady ? '#d4edda' : storageError ? '#f8d7da' : '#fff3cd',
          color: storageReady ? '#155724' : storageError ? '#721c24' : '#856404',
          border: `1px solid ${storageReady ? '#c3e6cb' : storageError ? '#f5c6cb' : '#ffeeba'}`,
        }}>
          {storageReady && progress?.currentPage
            ? `💾 Page ${progress.currentPage} saved`
            : storageReady
            ? '💾 Storage Ready'
            : storageError
            ? '❌ Storage Error'
            : '⏳ Initializing Storage...'}
        </div>
      </div>
      <EmbedPDF engine={engine} plugins={plugins}>
        {/* Page tracking disabled - using manual scroll observation instead */}
        <AnnotationToolbar />
        <Viewport
          style={{
            backgroundColor: '#f1f3f5',
          }}
        >
          <Scroller
            renderPage={({ width, height, pageIndex, scale, rotation }) => (
              <div style={{ 
                width, 
                height, 
                margin: 'auto', 
                marginBottom: '1rem', 
                position: 'relative',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}>
                <PagePointerProvider pageWidth={width} pageHeight={height} pageIndex={pageIndex} scale={scale} rotation={rotation}>
                  <RenderLayer pageIndex={pageIndex} scale={scale} />
                  <SelectionLayer pageIndex={pageIndex} scale={scale} />
                  <AnnotationLayer
                    pageIndex={pageIndex}
                    scale={scale}
                    pageWidth={width}
                    pageHeight={height}
                    rotation={rotation}
                  />
                </PagePointerProvider>
              </div>
            )}
          />
        </Viewport>
      </EmbedPDF>
    </div>
  );
};
