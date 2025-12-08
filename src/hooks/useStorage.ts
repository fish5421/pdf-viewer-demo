/**
 * useStorage - React hook for IndexedDB persistence
 *
 * Provides:
 * - Auto-initialization of IndexedDB
 * - Document registration with hash-based identification
 * - Page position tracking with debounced saves
 * - Progress restoration on mount
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import StorageService, {
  DocumentRecord,
  UserProgress,
  HighlightRecord,
  CornellNote,
} from '../services/StorageService';

export interface UseStorageOptions {
  /** Document source URL or filename */
  source: string;
  /** Document ArrayBuffer for hashing (optional - needed for new docs) */
  documentData?: ArrayBuffer;
  /** Page count from the loaded document */
  pageCount?: number;
  /** Document metadata */
  metadata?: {
    title?: string;
    author?: string;
  };
}

export interface UseStorageReturn {
  /** Whether storage is initialized and ready */
  isReady: boolean;
  /** Current document ID (hash) */
  documentId: string | null;
  /** Last saved progress */
  progress: UserProgress | null;
  /** All highlights for current document */
  highlights: HighlightRecord[];
  /** Update current page position (debounced) */
  updatePage: (page: number, scrollOffset?: number) => void;
  /** Save a highlight */
  saveHighlight: (highlight: Omit<HighlightRecord, 'documentId'>) => Promise<void>;
  /** Delete a highlight */
  deleteHighlight: (id: string) => Promise<void>;
  /** Save Cornell note */
  saveCornellNote: (note: Omit<CornellNote, 'documentId'>) => Promise<void>;
  /** Get all Cornell notes */
  getCornellNotes: () => Promise<CornellNote[]>;
  /** Error if initialization failed */
  error: string | null;
}

// Debounce delay for page position saves (ms)
const SAVE_DEBOUNCE_MS = 500;

export function useStorage(options: UseStorageOptions): UseStorageReturn {
  const { source, documentData, pageCount, metadata } = options;

  const [isReady, setIsReady] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [highlights, setHighlights] = useState<HighlightRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedPageRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  // Initialize storage and register/lookup document - only run once per source
  useEffect(() => {
    // Prevent re-initialization
    if (initializedRef.current) return;

    let cancelled = false;

    async function initialize() {
      try {
        await StorageService.init();

        // First, check if we already have this document by source
        let doc = await StorageService.getDocumentBySource(source);
        let docId: string;

        if (doc) {
          // Document exists - update last opened time
          docId = doc.id;
          doc.lastOpenedAt = Date.now();
          await StorageService.saveDocument(doc);
          console.log('[useStorage] Found existing document:', docId.slice(0, 8));
        } else if (documentData) {
          // New document - compute hash and create record
          docId = await StorageService.hashDocument(documentData);

          // Check if this hash already exists (same doc, different URL)
          doc = await StorageService.getDocument(docId);

          if (doc) {
            // Same content, different source - update source
            doc.source = source;
            doc.lastOpenedAt = Date.now();
            await StorageService.saveDocument(doc);
          } else {
            // Brand new document
            const newDoc: DocumentRecord = {
              id: docId,
              source,
              title: metadata?.title,
              author: metadata?.author,
              pageCount: pageCount ?? 0,
              createdAt: Date.now(),
              lastOpenedAt: Date.now(),
            };
            await StorageService.saveDocument(newDoc);
          }
          console.log('[useStorage] Registered document:', docId.slice(0, 8));
        } else {
          // No existing doc and no data to hash - create temporary ID from source
          docId = await hashString(source);
          const newDoc: DocumentRecord = {
            id: docId,
            source,
            title: metadata?.title,
            author: metadata?.author,
            pageCount: pageCount ?? 0,
            createdAt: Date.now(),
            lastOpenedAt: Date.now(),
          };
          await StorageService.saveDocument(newDoc);
          console.log('[useStorage] Created doc from source hash:', docId.slice(0, 8));
        }

        if (cancelled) return;

        initializedRef.current = true;
        setDocumentId(docId);

        // Load existing progress
        const existingProgress = await StorageService.getProgress(docId);
        if (existingProgress) {
          setProgress(existingProgress);
          console.log('[useStorage] Restored progress: page', existingProgress.currentPage);
        }

        // Load existing highlights
        const existingHighlights = await StorageService.getHighlights(docId);
        setHighlights(existingHighlights);

        setIsReady(true);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Storage initialization failed';
          console.error('[useStorage] Error:', message);
          setError(message);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [source]); // Only re-run if source changes

  // Subscribe to storage events for real-time updates
  useEffect(() => {
    if (!documentId) return;

    const unsubscribe = StorageService.subscribe(async (event) => {
      if (event.type === 'highlight-saved' && event.documentId === documentId) {
        const updated = await StorageService.getHighlights(documentId);
        setHighlights(updated);
      }
      if (event.type === 'highlight-deleted') {
        const updated = await StorageService.getHighlights(documentId);
        setHighlights(updated);
      }
    });

    return unsubscribe;
  }, [documentId]);

  // Debounced page position update
  const updatePage = useCallback(
    (page: number, scrollOffset: number = 0) => {
      if (!documentId) return;

      // Skip if same page was just saved
      if (lastSavedPageRef.current === page) return;

      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce the save
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await StorageService.updatePagePosition(documentId, page, scrollOffset);
          lastSavedPageRef.current = page;

          // Update local state
          const updated = await StorageService.getProgress(documentId);
          setProgress(updated);
        } catch (err) {
          console.error('[useStorage] Failed to save page position:', err);
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [documentId]
  );

  // Save highlight
  const saveHighlight = useCallback(
    async (highlight: Omit<HighlightRecord, 'documentId'>) => {
      if (!documentId) throw new Error('Document not initialized');

      await StorageService.saveHighlight({
        ...highlight,
        documentId,
      });
    },
    [documentId]
  );

  // Delete highlight
  const deleteHighlight = useCallback(async (id: string) => {
    await StorageService.deleteHighlight(id);
  }, []);

  // Save Cornell note
  const saveCornellNote = useCallback(
    async (note: Omit<CornellNote, 'documentId'>) => {
      if (!documentId) throw new Error('Document not initialized');

      await StorageService.saveCornellNote({
        ...note,
        documentId,
      });
    },
    [documentId]
  );

  // Get Cornell notes
  const getCornellNotes = useCallback(async () => {
    if (!documentId) return [];
    return StorageService.getCornellNotes(documentId);
  }, [documentId]);

  return {
    isReady,
    documentId,
    progress,
    highlights,
    updatePage,
    saveHighlight,
    deleteHighlight,
    saveCornellNote,
    getCornellNotes,
    error,
  };
}

// Helper to hash a string (for source-only document IDs)
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default useStorage;
