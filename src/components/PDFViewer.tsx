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

// Register all plugins
const plugins = [
  createPluginRegistration(LoaderPluginPackage, {
    loadingOptions: {
      type: 'url',
      pdfFile: {
        id: 'example-pdf',
        url: 'https://snippet.embedpdf.com/ebook.pdf',
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
  // Initialize the PDFium engine
  const { engine, isLoading } = usePdfiumEngine();

  if (isLoading || !engine) {
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
    <div style={{ height: '100vh' }}>
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
