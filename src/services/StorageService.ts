/**
 * StorageService - IndexedDB persistence layer for Engram PDF Viewer
 *
 * Manages persistent storage for:
 * - documents: Document metadata and identification (hash-based)
 * - highlights: User highlight annotations
 * - user_progress: Reading progress (page, scroll position, timestamps)
 * - cornell_notes: Cornell note-taking data
 */

export interface DocumentRecord {
  /** SHA-256 hash of the document (primary key) */
  id: string;
  /** Original URL or filename */
  source: string;
  /** Document title from metadata */
  title?: string;
  /** Document author from metadata */
  author?: string;
  /** Number of pages */
  pageCount: number;
  /** When first opened */
  createdAt: number;
  /** When last opened */
  lastOpenedAt: number;
}

export interface UserProgress {
  /** Document hash (foreign key to documents) */
  documentId: string;
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Scroll offset within the page (0-1 normalized) */
  scrollOffset: number;
  /** Total reading time in seconds */
  totalReadingTime: number;
  /** Last session timestamp */
  lastSessionAt: number;
  /** Reading sessions count */
  sessionsCount: number;
}

export interface HighlightRecord {
  /** Unique highlight ID */
  id: string;
  /** Document hash (foreign key) */
  documentId: string;
  /** Page number where highlight exists */
  pageNumber: number;
  /** Highlight color */
  color: string;
  /** Selected text content */
  text: string;
  /** Bounding rectangle coordinates */
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Creation timestamp */
  createdAt: number;
  /** Optional user note attached to highlight */
  note?: string;
}

export interface CornellNote {
  /** Unique note ID */
  id: string;
  /** Document hash (foreign key) */
  documentId: string;
  /** Associated page number (optional) */
  pageNumber?: number;
  /** Main notes content (right column) */
  notes: string;
  /** Cue/keywords content (left column) */
  cues: string;
  /** Summary content (bottom section) */
  summary: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last modified timestamp */
  updatedAt: number;
}

const DB_NAME = 'engram-pdf-viewer';
const DB_VERSION = 1;

const STORES = {
  DOCUMENTS: 'documents',
  HIGHLIGHTS: 'highlights',
  USER_PROGRESS: 'user_progress',
  CORNELL_NOTES: 'cornell_notes',
} as const;

// Type for storage events (defined before class to avoid forward reference)
export type EngramStorageEvent =
  | { type: 'document-saved'; documentId: string }
  | { type: 'progress-saved'; documentId: string; page: number }
  | { type: 'highlight-saved'; documentId: string; highlightId: string }
  | { type: 'highlight-deleted'; highlightId: string }
  | { type: 'note-saved'; documentId: string; noteId: string }
  | { type: 'note-deleted'; noteId: string };

class StorageServiceClass {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private listeners: Set<(event: EngramStorageEvent) => void> = new Set();

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[StorageService] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[StorageService] Database initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('[StorageService] Upgrading database schema...');

        // Documents store - keyed by hash
        if (!db.objectStoreNames.contains(STORES.DOCUMENTS)) {
          const docStore = db.createObjectStore(STORES.DOCUMENTS, { keyPath: 'id' });
          docStore.createIndex('source', 'source', { unique: false });
          docStore.createIndex('lastOpenedAt', 'lastOpenedAt', { unique: false });
        }

        // Highlights store - keyed by ID, indexed by document
        if (!db.objectStoreNames.contains(STORES.HIGHLIGHTS)) {
          const highlightStore = db.createObjectStore(STORES.HIGHLIGHTS, { keyPath: 'id' });
          highlightStore.createIndex('documentId', 'documentId', { unique: false });
          highlightStore.createIndex('pageNumber', 'pageNumber', { unique: false });
        }

        // User progress store - keyed by document ID (one progress per document)
        if (!db.objectStoreNames.contains(STORES.USER_PROGRESS)) {
          const progressStore = db.createObjectStore(STORES.USER_PROGRESS, { keyPath: 'documentId' });
          progressStore.createIndex('lastSessionAt', 'lastSessionAt', { unique: false });
        }

        // Cornell notes store - keyed by ID, indexed by document
        if (!db.objectStoreNames.contains(STORES.CORNELL_NOTES)) {
          const notesStore = db.createObjectStore(STORES.CORNELL_NOTES, { keyPath: 'id' });
          notesStore.createIndex('documentId', 'documentId', { unique: false });
          notesStore.createIndex('pageNumber', 'pageNumber', { unique: false });
        }

        console.log('[StorageService] Database schema created');
      };
    });

    return this.initPromise;
  }

  /**
   * Ensure database is initialized before operations
   */
  private async ensureDb(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  /**
   * Generate SHA-256 hash of ArrayBuffer for document identification
   */
  async hashDocument(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ========== Documents ==========

  /**
   * Save or update a document record
   */
  async saveDocument(doc: DocumentRecord): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.DOCUMENTS, 'readwrite');
      const store = tx.objectStore(STORES.DOCUMENTS);
      const request = store.put(doc);

      request.onsuccess = () => {
        this.emit({ type: 'document-saved', documentId: doc.id });
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a document by ID (hash)
   */
  async getDocument(id: string): Promise<DocumentRecord | null> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.DOCUMENTS, 'readonly');
      const store = tx.objectStore(STORES.DOCUMENTS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get document by source URL/filename
   */
  async getDocumentBySource(source: string): Promise<DocumentRecord | null> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.DOCUMENTS, 'readonly');
      const store = tx.objectStore(STORES.DOCUMENTS);
      const index = store.index('source');
      const request = index.get(source);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all documents ordered by last opened
   */
  async getAllDocuments(): Promise<DocumentRecord[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.DOCUMENTS, 'readonly');
      const store = tx.objectStore(STORES.DOCUMENTS);
      const index = store.index('lastOpenedAt');
      const request = index.getAll();

      request.onsuccess = () => resolve(request.result.reverse());
      request.onerror = () => reject(request.error);
    });
  }

  // ========== User Progress ==========

  /**
   * Save reading progress for a document
   */
  async saveProgress(progress: UserProgress): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.USER_PROGRESS, 'readwrite');
      const store = tx.objectStore(STORES.USER_PROGRESS);
      const request = store.put(progress);

      request.onsuccess = () => {
        this.emit({ type: 'progress-saved', documentId: progress.documentId, page: progress.currentPage });
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get reading progress for a document
   */
  async getProgress(documentId: string): Promise<UserProgress | null> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.USER_PROGRESS, 'readonly');
      const store = tx.objectStore(STORES.USER_PROGRESS);
      const request = store.get(documentId);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update just the page/scroll position (optimized for frequent updates)
   */
  async updatePagePosition(documentId: string, page: number, scrollOffset: number = 0): Promise<void> {
    const existing = await this.getProgress(documentId);
    const now = Date.now();

    const progress: UserProgress = existing ?? {
      documentId,
      currentPage: page,
      scrollOffset,
      totalReadingTime: 0,
      lastSessionAt: now,
      sessionsCount: 1,
    };

    progress.currentPage = page;
    progress.scrollOffset = scrollOffset;
    progress.lastSessionAt = now;

    await this.saveProgress(progress);
  }

  // ========== Highlights ==========

  /**
   * Save a highlight
   */
  async saveHighlight(highlight: HighlightRecord): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.HIGHLIGHTS, 'readwrite');
      const store = tx.objectStore(STORES.HIGHLIGHTS);
      const request = store.put(highlight);

      request.onsuccess = () => {
        this.emit({ type: 'highlight-saved', documentId: highlight.documentId, highlightId: highlight.id });
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a highlight
   */
  async deleteHighlight(id: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.HIGHLIGHTS, 'readwrite');
      const store = tx.objectStore(STORES.HIGHLIGHTS);
      const request = store.delete(id);

      request.onsuccess = () => {
        this.emit({ type: 'highlight-deleted', highlightId: id });
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all highlights for a document
   */
  async getHighlights(documentId: string): Promise<HighlightRecord[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.HIGHLIGHTS, 'readonly');
      const store = tx.objectStore(STORES.HIGHLIGHTS);
      const index = store.index('documentId');
      const request = index.getAll(documentId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get highlights for a specific page
   */
  async getPageHighlights(documentId: string, pageNumber: number): Promise<HighlightRecord[]> {
    const highlights = await this.getHighlights(documentId);
    return highlights.filter(h => h.pageNumber === pageNumber);
  }

  // ========== Cornell Notes ==========

  /**
   * Save a Cornell note
   */
  async saveCornellNote(note: CornellNote): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CORNELL_NOTES, 'readwrite');
      const store = tx.objectStore(STORES.CORNELL_NOTES);
      note.updatedAt = Date.now();
      const request = store.put(note);

      request.onsuccess = () => {
        this.emit({ type: 'note-saved', documentId: note.documentId, noteId: note.id });
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all Cornell notes for a document
   */
  async getCornellNotes(documentId: string): Promise<CornellNote[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CORNELL_NOTES, 'readonly');
      const store = tx.objectStore(STORES.CORNELL_NOTES);
      const index = store.index('documentId');
      const request = index.getAll(documentId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a Cornell note
   */
  async deleteCornellNote(id: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CORNELL_NOTES, 'readwrite');
      const store = tx.objectStore(STORES.CORNELL_NOTES);
      const request = store.delete(id);

      request.onsuccess = () => {
        this.emit({ type: 'note-deleted', noteId: id });
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ========== Event System ==========

  /**
   * Subscribe to storage events
   */
  subscribe(listener: (event: EngramStorageEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: EngramStorageEvent): void {
    this.listeners.forEach(listener => listener(event));
  }

  // ========== Utilities ==========

  /**
   * Clear all data (for testing/reset)
   */
  async clearAll(): Promise<void> {
    const db = await this.ensureDb();
    const stores = [STORES.DOCUMENTS, STORES.HIGHLIGHTS, STORES.USER_PROGRESS, STORES.CORNELL_NOTES];

    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    console.log('[StorageService] All data cleared');
  }

  /**
   * Get database stats
   */
  async getStats(): Promise<{ documents: number; highlights: number; notes: number }> {
    const db = await this.ensureDb();
    const counts = { documents: 0, highlights: 0, notes: 0 };

    const countStore = (storeName: string): Promise<number> => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    };

    counts.documents = await countStore(STORES.DOCUMENTS);
    counts.highlights = await countStore(STORES.HIGHLIGHTS);
    counts.notes = await countStore(STORES.CORNELL_NOTES);

    return counts;
  }
}

// Singleton instance
export const StorageService = new StorageServiceClass();

// Note: Window.Engram interface is declared in HybridLoader.ts
// We just add the storage property here

if (typeof window !== 'undefined') {
  window.Engram = window.Engram || ({} as Window['Engram']);
  window.Engram.storage = StorageService;
}

export default StorageService;
