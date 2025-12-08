import { useEffect } from 'react';
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
import { useHybridLoader } from '../hooks/useHybridLoader';

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
      {/* Context Layer Status Indicator */}
      <div style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        padding: '0.5rem 1rem',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontFamily: 'monospace',
        zIndex: 1000,
        backgroundColor: contextReady ? '#d4edda' : contextLoading ? '#fff3cd' : contextError ? '#f8d7da' : '#e2e3e5',
        color: contextReady ? '#155724' : contextLoading ? '#856404' : contextError ? '#721c24' : '#383d41',
        border: `1px solid ${contextReady ? '#c3e6cb' : contextLoading ? '#ffeeba' : contextError ? '#f5c6cb' : '#d6d8db'}`,
      }}>
        {contextLoading && '⏳ Loading LLM Context...'}
        {contextReady && `✅ Context Ready (${context?.pageCount} pages)`}
        {contextError && `❌ Context Error`}
        {!contextLoading && !contextReady && !contextError && '⏸️ Context Pending'}
      </div>
      <EmbedPDF engine={engine} plugins={plugins}>
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
