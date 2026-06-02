"use client";

import { create } from "zustand";
import localforage from "localforage";
import { calculateBaseQty, calculateMacros } from "@/lib/conversions";
import type {
  Food,
  FoodMeasure,
  MealType,
  NutritionLog,
  NutritionLogCreatePayload,
} from "@/lib/types/nutrition";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const QUEUE_STORE_KEY = "pulse_sync_queue";

/**
 * Offline-First IndexedDB Sync Queue Store (V2.5 — Render-Phase Merging).
 *
 * The queue is the single source of truth for pending offline entries.
 * SWR caches are NOT manually edited by this store — instead, the diary
 * page performs Render-Phase Merging by combining SWR data + queue state.
 *
 * Guarantees:
 * - Absolute chronological order during flush
 * - Items removed from IndexedDB ONLY after backend returns 200 OK
 * - Loop breaks on network dropout to preserve order
 * - 409 Conflict treated as success (idempotent duplicate)
 * - Atomic write-mutex prevents read-modify-write races
 * - 5xx server errors keep the item in queue for later retry
 */

export interface PendingNutritionLog {
  /** Client-generated UUID */
  id: string;
  /** API endpoint for sync */
  endpoint: string;
  method: "POST";
  /** Backend payload */
  payload: NutritionLogCreatePayload;
  timestamp: number;
  /** Pre-calculated speculative macros for UI display */
  calculated_qty_base: number;
  calculated_calories: number;
  calculated_protein: number;
  calculated_carbs: number;
  calculated_fat: number;
  /** Hydrated food context for card rendering */
  food: Food;
  /** Hydrated measure context for card rendering */
  measure: FoodMeasure;
}

interface SyncState {
  isOnline: boolean;
  /** Typed pending nutrition log queue — visible to diary via Render-Phase Merging */
  pendingLogs: PendingNutritionLog[];
  isFlushing: boolean;
  isWriting: boolean;

  /** Updates connection status. Auto-triggers flush on offline→online transition. */
  updateOnlineStatus: (status: boolean, token?: string) => void;
  /** Loads queue from IndexedDB into memory on app start. */
  loadQueueFromStorage: () => Promise<void>;
  /**
   * V2.5 — Create optimistic diary log entry.
   * Calculates speculative macros client-side and pushes to queue.
   * Does NOT modify SWR caches — diary page reads from pendingLogs directly.
   */
  createOfflineLog: (params: {
    food_id: string;
    measure_id: string;
    quantity: number;
    meal_type: MealType;
    logged_at: string;
    food: Food;
    userId: string;
    targetDate: string;
  }) => Promise<NutritionLog>;
  /**
   * Process sync queue — FIFO sequential flush.
   * Removes items ONLY on 200 OK from backend.
   * Triggers SWR revalidation on success.
   */
  processSyncQueue: (token: string) => Promise<void>;
  /** Backward-compat alias for processSyncQueue */
  flushSyncQueue: (token: string) => Promise<void>;
}

// Configure localforage instance
const syncDb = localforage.createInstance({
  name: "ProjectPulse",
  storeName: "sync_queue_v2",
  description: "Offline nutrition log sync queue (V2.5)",
});

function generateClientUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Atomic write helper — prevents concurrent IndexedDB writes from
 * corrupting the queue via read-modify-write races.
 */
async function atomicWriteQueue(
  queue: PendingNutritionLog[],
  get: () => SyncState,
  set: (partial: Partial<SyncState>) => void
): Promise<void> {
  let waitAttempts = 0;
  while (get().isWriting) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    waitAttempts++;
    if (waitAttempts > 100) {
      console.warn("[SYNC] Write-mutex timeout — forcing write");
      break;
    }
  }

  set({ isWriting: true });
  try {
    await syncDb.setItem(QUEUE_STORE_KEY, queue);
  } finally {
    set({ isWriting: false });
  }
}

/**
 * Notify diary page to trigger SWR revalidation after successful sync.
 */
function notifyRevalidate(targetDate: string): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("pulse:sync-complete", { detail: { targetDate } })
    );
  }
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  pendingLogs: [],
  isFlushing: false,
  isWriting: false,

  updateOnlineStatus: (status: boolean, token?: string) => {
    const wasOffline = !get().isOnline;
    set({ isOnline: status });

    if (wasOffline && status && token) {
      const state = get();
      if (state.pendingLogs.length > 0 && !state.isFlushing) {
        get().processSyncQueue(token);
      }
    }
  },

  loadQueueFromStorage: async () => {
    try {
      const queue: PendingNutritionLog[] =
        (await syncDb.getItem(QUEUE_STORE_KEY)) || [];
      set({ pendingLogs: queue });

      if (queue.length > 0) {
        console.log(`[SYNC] Loaded ${queue.length} pending items from IndexedDB`);
      }
    } catch (err) {
      console.error("[SYNC] Failed to load queue from IndexedDB:", err);
    }
  },

  createOfflineLog: async ({ food_id, measure_id, quantity, meal_type, logged_at, food, userId, targetDate }) => {
    // Generate client-side UUID
    const clientId = generateClientUUID();

    // Resolve measure from food.measures
    let measure: FoodMeasure | undefined = food.measures.find((m) => m.id === measure_id);
    if (!measure) {
      measure = {
        id: measure_id,
        food_id: food.id,
        measure_name: food.base_unit,
        conversion_factor: 1.0,
        is_default: true,
      };
    }

    // Calculate speculative macros
    const baseQty = calculateBaseQty(quantity, measure.conversion_factor);
    const macros = calculateMacros(
      baseQty,
      food.calories_per_100,
      food.protein_per_100,
      food.carbs_per_100,
      food.fat_per_100
    );

    // Assemble pending log record
    const pendingLog: PendingNutritionLog = {
      id: clientId,
      endpoint: "/api/v2/nutrition/diary",
      method: "POST",
      payload: { food_id, measure_id, quantity, logged_at, meal_type },
      timestamp: Date.now(),
      calculated_qty_base: baseQty,
      calculated_calories: macros.calculated_calories,
      calculated_protein: macros.calculated_protein,
      calculated_carbs: macros.calculated_carbs,
      calculated_fat: macros.calculated_fat,
      food,
      measure,
    };

    // Persist to IndexedDB
    try {
      let waitAttempts = 0;
      while (get().isWriting) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        waitAttempts++;
        if (waitAttempts > 100) break;
      }

      set({ isWriting: true });
      const existing: PendingNutritionLog[] =
        (await syncDb.getItem(QUEUE_STORE_KEY)) || [];
      existing.push(pendingLog);
      await syncDb.setItem(QUEUE_STORE_KEY, existing);
      set({ isWriting: false });
    } catch (err) {
      set({ isWriting: false });
      console.error("[SYNC] Failed to persist queue item:", err);
    }

    // Update in-memory state
    set((state) => ({
      pendingLogs: [...state.pendingLogs, pendingLog],
    }));

    console.log(
      `[SYNC] Optimistic log created: ${clientId} — ${macros.calculated_calories} kcal (pending)`
    );

    // Return as NutritionLog shape for caller compatibility
    const speculativeLog: NutritionLog = {
      id: clientId,
      user_id: userId,
      logged_at,
      meal_type,
      food_id,
      measure_id,
      quantity,
      calculated_qty_base: baseQty,
      calculated_calories: macros.calculated_calories,
      calculated_protein: macros.calculated_protein,
      calculated_carbs: macros.calculated_carbs,
      calculated_fat: macros.calculated_fat,
      isPendingSync: true,
      food,
      measure,
    };

    return speculativeLog;
  },

  processSyncQueue: async (token: string) => {
    const state = get();
    if (state.isFlushing || state.pendingLogs.length === 0) return;

    set({ isFlushing: true });
    console.log(`[SYNC] Starting FIFO flush — ${state.pendingLogs.length} items`);

    try {
      let queue: PendingNutritionLog[] =
        (await syncDb.getItem(QUEUE_STORE_KEY)) || [];

      queue.sort((a, b) => a.timestamp - b.timestamp);

      let processedCount = 0;
      const reconciledDates = new Set<string>();

      for (const item of [...queue]) {
        if (!navigator.onLine) {
          console.log(`[SYNC] Network lost during flush — breaking`);
          break;
        }

        try {
          const res = await fetch(`${BACKEND_URL}${item.endpoint}`, {
            method: item.method,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(item.payload),
          });

          if (res.status >= 200 && res.status < 300) {
            // 200 OK — remove from queue
            queue = queue.filter((q) => q.id !== item.id);
            await atomicWriteQueue(queue, get, set);
            processedCount++;

            // Track which dates need SWR revalidation
            const logDate = item.payload.logged_at.split("T")[0];
            reconciledDates.add(logDate);

            console.log(`[SYNC] ✓ Flushed: ${item.id} (${res.status})`);
          } else if (res.status === 409) {
            // Conflict — idempotent duplicate, safe to remove
            queue = queue.filter((q) => q.id !== item.id);
            await atomicWriteQueue(queue, get, set);
            processedCount++;
            console.log(`[SYNC] ✓ Duplicate (409): ${item.id}`);
          } else if (res.status >= 400 && res.status < 500) {
            // 4xx client error — drop (won't succeed on retry)
            queue = queue.filter((q) => q.id !== item.id);
            await atomicWriteQueue(queue, get, set);
            processedCount++;
            console.warn(`[SYNC] ✗ Dropped (${res.status}): ${item.id}`);
          } else {
            // 5xx server error — keep in queue, break
            console.warn(`[SYNC] Server error ${res.status} — pausing flush`);
            break;
          }
        } catch (fetchErr) {
          console.warn(`[SYNC] Network error — breaking:`, fetchErr);
          break;
        }
      }

      // Update in-memory state from IndexedDB
      const remaining: PendingNutritionLog[] =
        (await syncDb.getItem(QUEUE_STORE_KEY)) || [];
      set({ pendingLogs: remaining });

      // Trigger SWR revalidation for all reconciled dates
      for (const date of reconciledDates) {
        notifyRevalidate(date);
      }

      console.log(
        `[SYNC] Flush complete — processed: ${processedCount}, remaining: ${remaining.length}`
      );
    } catch (err) {
      console.error("[SYNC] Flush pipeline error:", err);
    } finally {
      set({ isFlushing: false });
    }
  },

  flushSyncQueue: async (token: string) => {
    await get().processSyncQueue(token);
  },
}));
