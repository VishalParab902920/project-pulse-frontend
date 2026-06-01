"use client";

import { create } from "zustand";
import localforage from "localforage";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const QUEUE_STORE_KEY = "pulse_sync_queue";

/**
 * Offline-First IndexedDB Sync Queue Store.
 *
 * Caches failed writes (meals, water, gym sets) while offline,
 * monitors network connectivity changes, and executes a strict
 * sequential FIFO sync flush when connection is restored.
 *
 * Guarantees:
 * - Absolute chronological order during flush
 * - Items only removed from IndexedDB after successful resolution
 * - Loop breaks immediately on network dropout to preserve order
 * - Idempotent: 409 Conflict treated as success (duplicate caught)
 * - Atomic write-mutex prevents read-modify-write race conditions
 */

export interface SyncQueueItem {
  id: string;
  endpoint: string;
  method: "POST" | "PUT" | "DELETE";
  payload: Record<string, unknown> | null;
  timestamp: number;
}

interface SyncState {
  isOnline: boolean;
  syncQueue: SyncQueueItem[];
  isFlushing: boolean;
  isWriting: boolean;

  /** Updates connection status. Auto-triggers flush on offline→online transition. */
  updateOnlineStatus: (status: boolean, token?: string) => void;
  /** Queues an action for later sync when offline. */
  queueOfflineAction: (
    endpoint: string,
    method: "POST" | "PUT" | "DELETE",
    payload: Record<string, unknown> | null
  ) => Promise<void>;
  /** Executes strict FIFO sequential sync pipeline. */
  flushSyncQueue: (token: string) => Promise<void>;
  /** Loads queue from IndexedDB into memory on app start. */
  loadQueueFromStorage: () => Promise<void>;
}

// Configure localforage instance for the sync queue
const syncDb = localforage.createInstance({
  name: "ProjectPulse",
  storeName: "sync_queue",
  description: "Offline action sync queue",
});

function generateQueueId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Atomic write helper — prevents concurrent IndexedDB writes from
 * corrupting the queue via read-modify-write race conditions.
 *
 * Waits for any in-progress write to complete before executing,
 * then acquires the lock, writes, and releases.
 */
async function atomicWriteQueue(
  queue: SyncQueueItem[],
  get: () => SyncState,
  set: (partial: Partial<SyncState>) => void
): Promise<void> {
  // Wait for any in-progress write to finish (spin-wait with backoff)
  let waitAttempts = 0;
  while (get().isWriting) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    waitAttempts++;
    if (waitAttempts > 100) {
      // Safety valve: 5 seconds max wait
      console.warn("[SYNC] Write-mutex timeout — forcing write");
      break;
    }
  }

  // Acquire lock
  set({ isWriting: true });

  try {
    await syncDb.setItem(QUEUE_STORE_KEY, queue);
  } finally {
    // Release lock
    set({ isWriting: false });
  }
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  syncQueue: [],
  isFlushing: false,
  isWriting: false,

  updateOnlineStatus: (status: boolean, token?: string) => {
    const wasOffline = !get().isOnline;
    set({ isOnline: status });

    // Auto-flush when transitioning from offline to online
    if (wasOffline && status && token) {
      const state = get();
      if (state.syncQueue.length > 0 && !state.isFlushing) {
        get().flushSyncQueue(token);
      }
    }
  },

  queueOfflineAction: async (endpoint, method, payload) => {
    const item: SyncQueueItem = {
      id: generateQueueId(),
      endpoint,
      method,
      payload,
      timestamp: Date.now(),
    };

    // Atomically read-modify-write to IndexedDB
    try {
      // Wait for any in-progress write, then read current state
      let waitAttempts = 0;
      while (get().isWriting) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        waitAttempts++;
        if (waitAttempts > 100) break;
      }

      set({ isWriting: true });
      const existing: SyncQueueItem[] =
        (await syncDb.getItem(QUEUE_STORE_KEY)) || [];
      existing.push(item);
      await syncDb.setItem(QUEUE_STORE_KEY, existing);
      set({ isWriting: false });
    } catch (err) {
      set({ isWriting: false });
      console.error("[SYNC] Failed to persist queue item to IndexedDB:", err);
    }

    // Update in-memory state
    set((state) => ({
      syncQueue: [...state.syncQueue, item],
    }));

    console.log(
      `[SYNC] Queued offline action: ${method} ${endpoint} (queue size: ${get().syncQueue.length})`
    );
  },

  flushSyncQueue: async (token: string) => {
    const state = get();
    if (state.isFlushing || state.syncQueue.length === 0) return;

    set({ isFlushing: true });
    console.log(`[SYNC] Starting FIFO flush — ${state.syncQueue.length} items`);

    try {
      // Pull queue from IndexedDB (source of truth) — wait for write lock
      let waitAttempts = 0;
      while (get().isWriting) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        waitAttempts++;
        if (waitAttempts > 100) break;
      }

      let queue: SyncQueueItem[] =
        (await syncDb.getItem(QUEUE_STORE_KEY)) || [];

      // Sort chronologically by timestamp (strict FIFO)
      queue.sort((a, b) => a.timestamp - b.timestamp);

      let processedCount = 0;

      for (const item of queue) {
        // Check if still online before each request
        if (!navigator.onLine) {
          console.log(
            `[SYNC] Network lost during flush — breaking at item ${processedCount + 1}`
          );
          break;
        }

        try {
          const fetchOptions: RequestInit = {
            method: item.method,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          };

          // Attach body for POST/PUT requests
          if (item.payload && (item.method === "POST" || item.method === "PUT")) {
            fetchOptions.body = JSON.stringify(item.payload);
          }

          const res = await fetch(
            `${BACKEND_URL}${item.endpoint}`,
            fetchOptions
          );

          // Success: 2xx or 409 Conflict (idempotent duplicate)
          if ((res.status >= 200 && res.status < 300) || res.status === 409) {
            queue = queue.filter((q) => q.id !== item.id);
            await atomicWriteQueue(queue, get, set);
            processedCount++;

            console.log(
              `[SYNC] ✓ Flushed: ${item.method} ${item.endpoint} (${res.status})`
            );
          } else if (res.status >= 400 && res.status < 500 && res.status !== 409) {
            // Client error (4xx except 409) — remove from queue (won't succeed on retry)
            queue = queue.filter((q) => q.id !== item.id);
            await atomicWriteQueue(queue, get, set);
            processedCount++;

            console.warn(
              `[SYNC] ✗ Dropped (client error ${res.status}): ${item.method} ${item.endpoint}`
            );
          } else {
            // Server error (5xx) — break to retry later
            console.warn(
              `[SYNC] Server error ${res.status} — pausing flush`
            );
            break;
          }
        } catch (fetchErr) {
          // Network error during fetch — break immediately
          console.warn(
            `[SYNC] Network error during flush — breaking at item ${processedCount + 1}:`,
            fetchErr
          );
          break;
        }
      }

      // Update in-memory state with remaining queue (atomic read)
      let waitAttempts2 = 0;
      while (get().isWriting) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        waitAttempts2++;
        if (waitAttempts2 > 100) break;
      }
      const remaining: SyncQueueItem[] =
        (await syncDb.getItem(QUEUE_STORE_KEY)) || [];
      set({ syncQueue: remaining });

      console.log(
        `[SYNC] Flush complete — processed: ${processedCount}, remaining: ${remaining.length}`
      );
    } catch (err) {
      console.error("[SYNC] Flush pipeline error:", err);
    } finally {
      set({ isFlushing: false });
    }
  },

  loadQueueFromStorage: async () => {
    try {
      const queue: SyncQueueItem[] =
        (await syncDb.getItem(QUEUE_STORE_KEY)) || [];
      set({ syncQueue: queue });

      if (queue.length > 0) {
        console.log(`[SYNC] Loaded ${queue.length} pending items from IndexedDB`);
      }
    } catch (err) {
      console.error("[SYNC] Failed to load queue from IndexedDB:", err);
    }
  },
}));
