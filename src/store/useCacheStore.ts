"use client";

import { create } from "zustand";

/**
 * SWR Cache Store — Global in-memory response cache.
 *
 * Stores API response payloads keyed by a composite `url_date` string.
 * Enables instant sub-10ms page loads by serving stale data immediately
 * while background revalidation fetches fresh data.
 */

interface CacheState {
  cache: Record<string, unknown>;
  cacheTimestamps: Record<string, number>;

  /** Saves response data and records the fetch timestamp. */
  setCache: (key: string, data: unknown) => void;
  /** Returns cached data if present, otherwise null. */
  getCache: (key: string) => unknown | null;
  /** Clears the entire cache. */
  clearCache: () => void;
}

export const useCacheStore = create<CacheState>((set, get) => ({
  cache: {},
  cacheTimestamps: {},

  setCache: (key: string, data: unknown) => {
    set((state) => ({
      cache: { ...state.cache, [key]: data },
      cacheTimestamps: { ...state.cacheTimestamps, [key]: Date.now() },
    }));
  },

  getCache: (key: string) => {
    return get().cache[key] ?? null;
  },

  clearCache: () => {
    set({ cache: {}, cacheTimestamps: {} });
  },
}));
