import { useEffect, useState } from 'react';
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
import { PageObserver } from './PageObserver';
import { useHybridLoader } from '../hooks/useHybridLoader';
import { scrollTracker } from '../services/ScrollTrackerService';
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

  // Initialize storage for persistence - simplified inline version
  const [storageReady, setStorageReady] = useState(false);
  const [storedPage, setStoredPage] = useState<number | null>(null);
  const [initialPage, setInitialPage] = useState<number | null>(null);
  const [currentView, setCurrentView] = useState<{
    pageNumber: number;
    viewportProgress: number;
    documentProgress: number;
    totalPages: number;
  }>({ pageNumber: 1, viewportProgress: 0, documentProgress: 0, totalPages: 4 });
  const storageError = null;
  const progress = storedPage ? { currentPage: storedPage } : null;

  // Subscribe to ScrollTracker updates for UI display
  useEffect(() => {
    const unsubscribe = scrollTracker.subscribe((view) => {
      setCurrentView(view);
    });
    return () => unsubscribe();
  }, []);

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

  // Set total pages and sync currentView changes to localStorage
  useEffect(() => {
    const maxPages = 4; // We know this PDF has 4 pages
    scrollTracker.setTotalPages(maxPages);

    // Subscribe to view changes to persist page to localStorage
    const unsubscribePersist = scrollTracker.subscribe((view) => {
      if (storageReady && view.pageNumber !== storedPage) {
        localStorage.setItem('engram-pdf-page', String(view.pageNumber));
        setStoredPage(view.pageNumber);
      }
    });

    return () => unsubscribePersist();
  }, [storageReady, storedPage]);

  // Restore scroll position from localStorage (legacy scroll-based restore)
  useEffect(() => {
    if (!storageReady || !initialPage || initialPage <= 1) return;

    // Find scroll container and restore position
    const restoreScrollPosition = () => {
      const allElements = Array.from(document.querySelectorAll('*')) as HTMLDivElement[];
      const scrollContainer = allElements.find(el => el.scrollHeight > el.clientHeight + 100);

      if (!scrollContainer) {
        setTimeout(restoreScrollPosition, 500);
        return;
      }

      const canvases = scrollContainer.querySelectorAll('canvas');
      if (canvases.length > 0) {
        const firstCanvas = canvases[0] as HTMLCanvasElement;
        const pageHeight = firstCanvas.offsetHeight + 20;
        const scrollTarget = (initialPage - 1) * pageHeight;

        console.log('[Storage] Restoring scroll to page', initialPage, 'position:', scrollTarget);
        scrollContainer.scrollTo({ top: scrollTarget, behavior: 'instant' });
        setInitialPage(null);
      }
    };

    const timer = setTimeout(restoreScrollPosition, 2500);
    return () => clearTimeout(timer);
  }, [storageReady, initialPage]);

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
        {/* Current View Status (ScrollTracker) */}
        <div style={{
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontFamily: 'monospace',
          backgroundColor: '#e7f1ff',
          color: '#004085',
          border: '1px solid #b8daff',
        }}>
          {`📍 Page ${currentView.pageNumber} of ${currentView.totalPages} (${Math.round(currentView.documentProgress * 100)}%)`}
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
              <PageObserver
                pageNumber={pageIndex + 1}
                style={{
                  width,
                  height,
                  margin: 'auto',
                  marginBottom: '1rem',
                  position: 'relative',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
              >
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
              </PageObserver>
            )}
          />
        </Viewport>
      </EmbedPDF>
    </div>
  );
};
