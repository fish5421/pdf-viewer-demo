/**
 * HybridLoader - Dual-state PDF loading for Visual + LLM Context
 *
 * This service provides:
 * 1. Visual Layer: EmbedPDF handles rendering (unchanged)
 * 2. Context Layer: Base64/Binary for Multimodal LLM
 * 3. Text Map: Extracted text with coordinates for scroll-page sync
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker - use unpkg for reliable CDN hosting
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface TextItem {
  text: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageTextMap {
  pageNumber: number;
  textItems: TextItem[];
  fullText: string;
}

export interface DocumentContext {
  /** Base64 encoded PDF for LLM API calls */
  base64: string;
  /** Total number of pages */
  pageCount: number;
  /** Text items with coordinates per page */
  textMap: PageTextMap[];
  /** Document metadata */
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
  };
  /** Whether context is fully loaded */
  isReady: boolean;
}

export interface HybridLoaderState {
  isLoading: boolean;
  error: string | null;
  context: DocumentContext | null;
}

class HybridLoaderService {
  private state: HybridLoaderState = {
    isLoading: false,
    error: null,
    context: null,
  };

  private listeners: Set<(state: HybridLoaderState) => void> = new Set();

  /**
   * Load PDF from URL and prepare both visual and context layers
   */
  async loadFromUrl(url: string): Promise<DocumentContext> {
    this.setState({ isLoading: true, error: null });

    try {
      // Fetch the PDF as ArrayBuffer
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();

      // Process the PDF
      return await this.processArrayBuffer(arrayBuffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error loading PDF';
      this.setState({ isLoading: false, error: message });
      throw error;
    }
  }

  /**
   * Load PDF from File object (for drag-drop or file picker)
   */
  async loadFromFile(file: File): Promise<DocumentContext> {
    this.setState({ isLoading: true, error: null });

    try {
      const arrayBuffer = await file.arrayBuffer();
      return await this.processArrayBuffer(arrayBuffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error loading PDF';
      this.setState({ isLoading: false, error: message });
      throw error;
    }
  }

  /**
   * Process ArrayBuffer to extract Base64, text map, and metadata
   */
  private async processArrayBuffer(arrayBuffer: ArrayBuffer): Promise<DocumentContext> {
    // Convert to Base64 for LLM context
    const base64 = this.arrayBufferToBase64(arrayBuffer);

    // Load with PDF.js for text extraction
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageCount = pdf.numPages;

    // Extract metadata
    const metadata = await this.extractMetadata(pdf);

    // Extract text from all pages with coordinates
    const textMap = await this.extractTextMap(pdf);

    const context: DocumentContext = {
      base64,
      pageCount,
      textMap,
      metadata,
      isReady: true,
    };

    this.setState({
      isLoading: false,
      error: null,
      context,
    });

    return context;
  }

  /**
   * Convert ArrayBuffer to Base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Extract document metadata
   */
  private async extractMetadata(pdf: pdfjsLib.PDFDocumentProxy): Promise<DocumentContext['metadata']> {
    try {
      const metadata = await pdf.getMetadata();
      const info = metadata.info as Record<string, unknown>;
      return {
        title: typeof info?.Title === 'string' ? info.Title : undefined,
        author: typeof info?.Author === 'string' ? info.Author : undefined,
        subject: typeof info?.Subject === 'string' ? info.Subject : undefined,
      };
    } catch {
      return {};
    }
  }

  /**
   * Extract text items with coordinates from all pages
   */
  private async extractTextMap(pdf: pdfjsLib.PDFDocumentProxy): Promise<PageTextMap[]> {
    const textMap: PageTextMap[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });

      const textItems: TextItem[] = [];
      let fullText = '';

      for (const item of textContent.items) {
        // Type guard for TextItem (has 'str' property)
        if ('str' in item && typeof item.str === 'string') {
          const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);

          textItems.push({
            text: item.str,
            pageNumber: pageNum,
            x: tx[4],
            y: tx[5],
            width: item.width,
            height: item.height,
          });

          fullText += item.str + ' ';
        }
      }

      textMap.push({
        pageNumber: pageNum,
        textItems,
        fullText: fullText.trim(),
      });
    }

    return textMap;
  }

  /**
   * Get current state
   */
  getState(): HybridLoaderState {
    return { ...this.state };
  }

  /**
   * Get document context (null if not loaded)
   */
  getContext(): DocumentContext | null {
    return this.state.context;
  }

  /**
   * Check if context is ready for LLM calls
   */
  isReady(): boolean {
    return this.state.context?.isReady ?? false;
  }

  /**
   * Get text for a specific page
   */
  getPageText(pageNumber: number): string | null {
    const page = this.state.context?.textMap.find(p => p.pageNumber === pageNumber);
    return page?.fullText ?? null;
  }

  /**
   * Find page number containing specific text
   */
  findTextPage(searchText: string): number | null {
    if (!this.state.context) return null;

    const lowerSearch = searchText.toLowerCase();
    for (const page of this.state.context.textMap) {
      if (page.fullText.toLowerCase().includes(lowerSearch)) {
        return page.pageNumber;
      }
    }
    return null;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: HybridLoaderState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(partial: Partial<HybridLoaderState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(listener => listener(this.state));
  }
}

// Singleton instance
export const hybridLoader = new HybridLoaderService();

// Expose on window.Engram for debugging and integration
declare global {
  interface Window {
    Engram: {
      hybridLoader: HybridLoaderService;
      documentContext: DocumentContext | null;
    };
  }
}

if (typeof window !== 'undefined') {
  window.Engram = window.Engram || {} as Window['Engram'];
  window.Engram.hybridLoader = hybridLoader;

  // Keep documentContext in sync
  hybridLoader.subscribe((state) => {
    window.Engram.documentContext = state.context;
  });
}

export default hybridLoader;
