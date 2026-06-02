"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useCacheStore } from "@/store/useCacheStore";
import { useUserStore } from "@/store/useUserStore";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

/**
 * Custom SWR (Stale-While-Revalidate) data fetching hook.
 *
 * Returns cached data instantly (zero blocking latency) while triggering
 * a background revalidation fetch. Supports optional polling intervals
 * for silent periodic refresh.
 *
 * Uses the unified apiFetch interceptor for automatic JWT injection,
 * 401 detection, token refresh, and force-logout handling.
 *
 * Render-Phase Key Synchronization:
 * When the cacheKey changes (e.g., date transition), the hook immediately
 * swaps local state to the new key's cached data (or null) in the same
 * render frame — eliminating stale-data visual flickering.
 *
 * @param url - The API endpoint path (e.g., '/api/v2/nutrition/diary')
 * @param dateDependency - Optional date string appended to the URL as a query param and used as cache key suffix
 * @param pollIntervalMs - Optional interval (ms) for background polling revalidation
 */

interface SWRResult<T> {
  data: T | null;
  isLoading: boolean;
  isRevalidating: boolean;
  error: string | null;
  mutate: () => Promise<void>;
}

export function useSWR<T = unknown>(
  url: string,
  dateDependency?: string,
  pollIntervalMs?: number
): SWRResult<T> {
  const cacheKey = dateDependency ? `${url}_${dateDependency}` : url;

  // Read initial cached data synchronously
  const initialCached = useCacheStore.getState().getCache(cacheKey) as T | null;

  const [data, setData] = useState<T | null>(initialCached);
  const [isLoading, setIsLoading] = useState(initialCached === null);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prevKey, setPrevKey] = useState(cacheKey);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // =============================================================
  // Render-Phase Key Synchronization
  // When cacheKey changes (date/page transition), reset local state
  // to null immediately. This forces all visual components to render
  // from zero/empty defaults, then animate up when data arrives.
  // =============================================================
  if (cacheKey !== prevKey) {
    setPrevKey(cacheKey);
    setData(null);
    setIsLoading(true);
    setError(null);
  }

  // Build the endpoint path with date dependency as query param
  const buildEndpoint = useCallback(() => {
    if (!dateDependency) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}target_date=${dateDependency}`;
  }, [url, dateDependency]);

  const fetchData = useCallback(
    async (isBackground = false) => {
      // Skip network fetch if offline
      const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      if (!isOnline) {
        // Just serve from cache if available
        const currentCached = useCacheStore.getState().getCache(cacheKey) as T | null;
        if (currentCached && mountedRef.current) {
          setData(currentCached);
          setIsLoading(false);
        }
        return;
      }

      // Read token fresh each call — not a dependency to avoid re-render loops
      const token = useUserStore.getState().accessToken || getAccessToken();
      if (!token) return;

      if (!isBackground) {
        const currentCached = useCacheStore.getState().getCache(cacheKey) as T | null;
        if (!currentCached) setIsLoading(true);
      }
      setIsRevalidating(true);
      setError(null);

      try {
        // Use apiFetch for automatic 401 handling and token refresh
        const res = await apiFetch(buildEndpoint());

        if (!mountedRef.current) return;

        if (res.ok) {
          const freshData = (await res.json()) as T;
          setData(freshData);
          useCacheStore.getState().setCache(cacheKey, freshData);
          setIsLoading(false);
        } else if (res.status !== 401) {
          // 401 is handled by apiFetch (refresh + redirect) — only surface other errors
          setError(`API error: ${res.status}`);
          setIsLoading(false);
        }
      } catch {
        if (!mountedRef.current) return;
        // Network error — serve from cache silently if available
        const fallback = useCacheStore.getState().getCache(cacheKey) as T | null;
        if (fallback) {
          setData(fallback);
        } else {
          setError("Network error");
        }
        setIsLoading(false);
      } finally {
        if (mountedRef.current) {
          setIsRevalidating(false);
        }
      }
    },
    [buildEndpoint, cacheKey]
  );

  // Background revalidation on key change
  useEffect(() => {
    mountedRef.current = true;

    // Add a small delay before populating data so page entrance
    // animations complete before fill animations begin
    const animationDelay = 350; // ms — matches page transition duration

    const timer = setTimeout(() => {
      if (!mountedRef.current) return;

      // Check cache first
      const currentCached = useCacheStore.getState().getCache(cacheKey) as T | null;
      if (currentCached) {
        setData(currentCached);
        setIsLoading(false);
      }

      // Then trigger background fetch for fresh data
      fetchData(currentCached !== null);
    }, animationDelay);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, [cacheKey, fetchData]);

  // Listen for external cache updates (e.g., from sync reconciliation)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleCacheUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.cacheKey === cacheKey) {
        const freshCached = useCacheStore.getState().getCache(cacheKey) as T | null;
        if (freshCached) {
          setData(freshCached);
          setIsLoading(false);
        }
      }
    };

    window.addEventListener("pulse:cache-update", handleCacheUpdate);
    return () => {
      window.removeEventListener("pulse:cache-update", handleCacheUpdate);
    };
  }, [cacheKey]);

  // Polling interval for silent revalidation
  useEffect(() => {
    if (!pollIntervalMs || pollIntervalMs <= 0) return;

    intervalRef.current = setInterval(() => {
      fetchData(true);
    }, pollIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [pollIntervalMs, fetchData]);

  // Manual mutate (force revalidation — gracefully handles offline)
  const mutate = useCallback(async () => {
    // If offline, just re-read from cache store (optimistic data is already there)
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!isOnline) {
      const currentCached = useCacheStore.getState().getCache(cacheKey) as T | null;
      if (currentCached) {
        setData(currentCached);
        setIsLoading(false);
      }
      return;
    }
    await fetchData(false);
  }, [fetchData, cacheKey]);

  return { data, isLoading, isRevalidating, error, mutate };
}
