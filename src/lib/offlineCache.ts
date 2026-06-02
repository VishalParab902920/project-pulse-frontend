/**
 * Project Pulse V2.5 — Dual-Layer Hybrid Search Engine: Local Mirror Cache
 *
 * Maintains a local IndexedDB-backed food dictionary for offline search fallback.
 * Uses localforage for ergonomic async key-value storage.
 *
 * Cache Strategy:
 * - Maximum 200 items in the sliding-window LRU cache (non-custom foods)
 * - Custom foods (is_custom: true) are NEVER pruned — they persist indefinitely
 * - Items are timestamped on insert for LRU eviction ordering
 *
 * Usage:
 * - cacheFoods(foods) — bulk-upsert food items after a successful online search
 * - getCachedFoods() — retrieve all locally cached foods for offline search
 */

import localforage from "localforage";
import type { Food } from "@/lib/types/nutrition";

const MAX_CACHE_SIZE = 200;

interface CachedFoodEntry {
  food: Food;
  cachedAt: number;
  isCustom: boolean;
}

// Dedicated localforage instance for food dictionary
const foodDictionary = localforage.createInstance({
  name: "ProjectPulse",
  storeName: "offline_food_dictionary",
  description: "Offline food search dictionary with LRU eviction",
});

/**
 * Bulk-upsert food items into the local cache.
 * Maintains a maximum of MAX_CACHE_SIZE non-custom items using sliding-window LRU.
 * Custom foods (is_custom: true) are always retained and never count toward the limit.
 *
 * @param foods - Array of Food objects to cache (from search results or custom creation)
 */
export async function cacheFoods(foods: Food[]): Promise<void> {
  if (!foods || foods.length === 0) return;

  try {
    // Load existing entries
    const existingEntries: CachedFoodEntry[] =
      (await foodDictionary.getItem<CachedFoodEntry[]>("entries")) || [];

    // Build a map for O(1) lookups by food ID
    const entryMap = new Map<string, CachedFoodEntry>();
    for (const entry of existingEntries) {
      entryMap.set(entry.food.id, entry);
    }

    // Upsert incoming foods
    const now = Date.now();
    for (const food of foods) {
      entryMap.set(food.id, {
        food,
        cachedAt: now,
        isCustom: food.is_custom,
      });
    }

    // Separate custom vs non-custom entries
    const allEntries = Array.from(entryMap.values());
    const customEntries = allEntries.filter((e) => e.isCustom);
    let nonCustomEntries = allEntries.filter((e) => !e.isCustom);

    // Apply LRU eviction to non-custom entries if over limit
    if (nonCustomEntries.length > MAX_CACHE_SIZE) {
      // Sort by cachedAt ascending (oldest first) → keep the newest MAX_CACHE_SIZE
      nonCustomEntries.sort((a, b) => a.cachedAt - b.cachedAt);
      nonCustomEntries = nonCustomEntries.slice(nonCustomEntries.length - MAX_CACHE_SIZE);
    }

    // Merge and persist
    const finalEntries = [...customEntries, ...nonCustomEntries];
    await foodDictionary.setItem("entries", finalEntries);
  } catch (err) {
    console.error("[OfflineCache] Failed to cache foods:", err);
  }
}

/**
 * Retrieve all locally cached foods.
 * Returns the full Food objects (custom + non-custom) for client-side filtering.
 */
export async function getCachedFoods(): Promise<Food[]> {
  try {
    const entries: CachedFoodEntry[] =
      (await foodDictionary.getItem<CachedFoodEntry[]>("entries")) || [];
    return entries.map((e) => e.food);
  } catch (err) {
    console.error("[OfflineCache] Failed to retrieve cached foods:", err);
    return [];
  }
}

/**
 * Clear the entire food dictionary cache.
 * Useful for debugging or manual cache invalidation.
 */
export async function clearFoodCache(): Promise<void> {
  try {
    await foodDictionary.removeItem("entries");
  } catch (err) {
    console.error("[OfflineCache] Failed to clear cache:", err);
  }
}
