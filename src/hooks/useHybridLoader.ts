/**
 * React hook for the HybridLoader service
 */

import { useState, useEffect, useCallback } from 'react';
import hybridLoader from '../services/HybridLoader';
import type { HybridLoaderState, DocumentContext } from '../services/HybridLoader';

export interface UseHybridLoaderResult {
  /** Whether PDF is currently loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Document context (Base64, text map, metadata) */
  context: DocumentContext | null;
  /** Whether context is ready for LLM calls */
  isReady: boolean;
  /** Load PDF from URL */
  loadFromUrl: (url: string) => Promise<void>;
  /** Load PDF from File */
  loadFromFile: (file: File) => Promise<void>;
  /** Get text for a specific page */
  getPageText: (pageNumber: number) => string | null;
  /** Find page containing text */
  findTextPage: (searchText: string) => number | null;
}

export function useHybridLoader(): UseHybridLoaderResult {
  const [state, setState] = useState<HybridLoaderState>(hybridLoader.getState());

  useEffect(() => {
    // Subscribe to state changes
    const unsubscribe = hybridLoader.subscribe(setState);
    return unsubscribe;
  }, []);

  const loadFromUrl = useCallback(async (url: string) => {
    await hybridLoader.loadFromUrl(url);
  }, []);

  const loadFromFile = useCallback(async (file: File) => {
    await hybridLoader.loadFromFile(file);
  }, []);

  const getPageText = useCallback((pageNumber: number) => {
    return hybridLoader.getPageText(pageNumber);
  }, []);

  const findTextPage = useCallback((searchText: string) => {
    return hybridLoader.findTextPage(searchText);
  }, []);

  return {
    isLoading: state.isLoading,
    error: state.error,
    context: state.context,
    isReady: state.context?.isReady ?? false,
    loadFromUrl,
    loadFromFile,
    getPageText,
    findTextPage,
  };
}

export default useHybridLoader;
