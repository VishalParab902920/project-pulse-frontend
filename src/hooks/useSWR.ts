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
 * Instant Cache Fallback on Key Transition:
 * When the cacheKey changes (date switch), the hook synchronously reads
 * from useCacheStore for the NEW key. If cached data exists, it's served
 * immediately in the same render frame — zero visual hiccups.
 * Only shows loading state for completely un-cached dates.
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
  // Render-Phase Key Synchronization with Instant Cache Fallback
  // When cacheKey changes (date switch), synchronously read the
  // cache store for the NEW key. Serve cached data instantly if
  // available — only show loading for completely un-cached keys.
  // =============================================================
  if (cacheKey !== prevKey) {
    setPrevKey(cacheKey);
    setError(null);

    // Attempt instant cache read for the new key
    const newCached = useCacheStore.getState().getCache(cacheKey) as T | null;
    if (newCached) {
      // Instant 0ms transition — serve cached data immediately
      setData(newCached);
      setIsLoading(false);
    } else {
      // No cache for this key — show loading skeleton
      setData(null);
      setIsLoading(true);
    }
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
        const currentCached = useCacheStore.getState().getCache(cacheKey) as T | null;
        if (currentCached && mountedRef.current) {
          setData(currentCached);
          setIsLoading(false);
        }
        return;
      }

      // Read token fresh each call
      const token = useUserStore.getState().accessToken || getAccessToken();
      if (!token) return;

      if (!isBackground) {
        const currentCached = useCacheStore.getState().getCache(cacheKey) as T | null;
        if (!currentCached) setIsLoading(true);
      }
      setIsRevalidating(true);
      setError(null);

      try {
        const res = await apiFetch(buildEndpoint());

        if (!mountedRef.current) return;

        if (res.ok) {
          const freshData = (await res.json()) as T;
          setData(freshData);
          useCacheStore.getState().setCache(cacheKey, freshData);
          setIsLoading(false);
        } else if (res.status !== 401) {
          setError(`API error: ${res.status}`);
          setIsLoading(false);
        }
      } catch {
        if (!mountedRef.current) return;
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

  // Background revalidation on key change — no artificial delay
  useEffect(() => {
    mountedRef.current = true;

    // Trigger background fetch immediately for fresh data.
    // If cache was already served in render-phase, this is a background revalidation.
    // If no cache exists, this is the primary fetch.
    const hasCached = useCacheStore.getState().getCache(cacheKey) !== null;
    fetchData(hasCached);

    return () => {
      mountedRef.current = false;
    };
  }, [cacheKey, fetchData]);

  // Listen for external cache updates (e.g., from sync reconciliation)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleCacheUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.cacheKey === cacheKey) {
        if (detail?.revalidate) {
           fetchData(false); // Force network refetch
        } else {
           const freshCached = useCacheStore.getState().getCache(cacheKey) as T | null;
           if (freshCached) {
             setData(freshCached);
             setIsLoading(false);
           }
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

/** Global utility to force revalidation for all mounted useSWR hooks listening to this key */
export function globalMutate(cacheKey: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("pulse:cache-update", {
        detail: { cacheKey, revalidate: true },
      })
    );
  }
}
