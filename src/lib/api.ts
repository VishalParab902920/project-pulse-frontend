"use client";

import { useSyncStore } from "@/store/useSyncStore";
import { useUserStore } from "@/store/useUserStore";
import { getAccessToken } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// ============================================================
// In-flight refresh lock — ensures only one token refresh
// happens at a time across all concurrent requests.
// ============================================================
let refreshPromise: Promise<string | null> | null = null;

/**
 * Attempts to refresh the Supabase session and returns the new access token.
 * Uses a shared promise lock to prevent multiple concurrent refresh attempts.
 */
async function refreshSession(): Promise<string | null> {
  // If a refresh is already in-flight, await that single shared promise
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        return null;
      }

      const newToken = data.session.access_token;

      // Write the new token to the cookie
      if (typeof document !== "undefined") {
        document.cookie = `sb-access-token=${newToken}; path=/; max-age=3600; SameSite=Lax`;
      }

      // Update the Zustand store — preserve existing profile
      const currentProfile = useUserStore.getState().userProfile;
      if (currentProfile) {
        useUserStore.getState().setAuth(newToken, currentProfile);
      }

      return newToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Force-logout: clears auth state, removes cookie, redirects to /login.
 */
function forceLogout(): void {
  useUserStore.getState().clearAuth();

  if (typeof document !== "undefined") {
    document.cookie =
      "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  }

  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

// ============================================================
// apiFetch — Unified Auth-Aware Fetch Interceptor
// ============================================================

/**
 * Production-grade fetch wrapper with automatic JWT injection,
 * 401 detection, single-flight token refresh, and force-logout.
 *
 * @param endpoint - API path (e.g., '/api/v2/nutrition/diary') or absolute URL
 * @param options - Standard RequestInit options
 * @param _isRetry - Internal flag to prevent infinite retry loops
 * @returns The fetch Response object
 */
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
  _isRetry = false
): Promise<Response> {
  // Build the full URL — prepend backend base if not already absolute
  const url = endpoint.startsWith("http") ? endpoint : `${BACKEND_URL}${endpoint}`;

  // Read the current access token
  const token = useUserStore.getState().accessToken || getAccessToken();

  // Merge headers — inject Authorization if we have a token
  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Execute the fetch
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 — attempt token refresh (once only)
  if (response.status === 401 && !_isRetry) {
    const newToken = await refreshSession();

    if (newToken) {
      // Retry the original request with the fresh token
      const retryHeaders = new Headers(options.headers || {});
      retryHeaders.set("Authorization", `Bearer ${newToken}`);

      return fetch(url, {
        ...options,
        headers: retryHeaders,
      });
    } else {
      // Refresh failed — force logout
      forceLogout();
      return response;
    }
  }

  return response;
}

// ============================================================
// Offline-Aware Fetch (preserved for mutation operations)
// ============================================================

export interface OfflineAwareResult {
  ok: boolean;
  queued: boolean;
  status: number;
  data: unknown;
}

/**
 * Offline-aware API request utility for mutations (POST/PUT/DELETE).
 *
 * Before making a network request, checks connection status.
 * If offline, returns a synthetic queued response for optimistic UI updates.
 *
 * Note: For diary-specific offline logging, use useSyncStore.createOfflineLog()
 * which provides full Render-Phase Merging support.
 */
export async function offlineAwareFetch(
  endpoint: string,
  method: "POST" | "PUT" | "DELETE",
  payload: Record<string, unknown> | null = null
): Promise<OfflineAwareResult> {
  const { isOnline } = useSyncStore.getState();

  // If offline, return synthetic queued response
  if (!isOnline) {
    return {
      ok: true,
      queued: true,
      status: 202,
      data: { message: "Queued for sync", offline: true },
    };
  }

  // Online — make the actual request via apiFetch
  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (payload && (method === "POST" || method === "PUT")) {
      fetchOptions.body = JSON.stringify(payload);
    }

    const res = await apiFetch(endpoint, fetchOptions);

    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // Response may not be JSON (e.g., 204 No Content)
    }

    return {
      ok: res.ok,
      queued: false,
      status: res.status,
      data,
    };
  } catch {
    // Network error during fetch
    console.warn(`[API] Network error on ${method} ${endpoint}`);

    return {
      ok: false,
      queued: false,
      status: 0,
      data: { message: "Network error", offline: true },
    };
  }
}
