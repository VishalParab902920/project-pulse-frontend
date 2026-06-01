import { Page, BrowserContext, expect } from "@playwright/test";

/**
 * Shared test helpers for Project Pulse V2 persona E2E tests.
 */

export const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

/**
 * A fake but structurally-valid JWT for seeding the session cookie.
 * The middleware only checks for cookie *presence*; the backend verifies
 * signature. For pure frontend/state E2E flows we stub network where needed.
 */
export const TEST_TOKEN =
  process.env.E2E_TEST_TOKEN ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MjRkZGYxMS1kM2UxLTRkMGUtODM4MS0xY2YzZGYyODY4ODAiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjo5OTk5OTk5OTk5fQ.test-signature";

/**
 * Seed the auth cookie so middleware allows access to /app routes
 * and pages can read the token via getAccessToken().
 */
export async function seedAuth(context: BrowserContext): Promise<void> {
  await context.addCookies([
    {
      name: "sb-access-token",
      value: TEST_TOKEN,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

/**
 * Prime the Zustand user store in localStorage-independent memory by
 * injecting the token into a window global the app can read on boot.
 * Also seeds biometrics into sessionStorage-free flow via route stubs.
 */
export async function seedUserState(page: Page): Promise<void> {
  await page.addInitScript((token) => {
    // Expose token for any client code that falls back to window
    (window as unknown as { __E2E_TOKEN__: string }).__E2E_TOKEN__ = token;
  }, TEST_TOKEN);
}

/**
 * Stub the biometrics endpoint so the onboarding guard passes and
 * pages receive valid targets without a live backend.
 */
export async function stubBiometrics(page: Page): Promise<void> {
  await page.route("**/api/v2/profile/biometrics", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "bio-1",
          user_id: "524ddf11-d3e1-4d0e-8381-1cf3df286880",
          gender: "male",
          dob: "1998-11-06",
          height_cm: 170,
          activity_level: "moderate",
          fitness_goal: "maintain",
          calculated_bmr: 1633,
          calculated_tdee: 2530,
          target_calories: 2530,
          target_protein_g: 190,
          target_carbs_g: 253,
          target_fat_g: 84,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    } else {
      await route.continue();
    }
  });
}

/** Wait helper for a short, deterministic delay. */
export async function settle(page: Page, ms = 400): Promise<void> {
  await page.waitForTimeout(ms);
}

/** Read the IndexedDB sync queue array from the page context. */
export async function readSyncQueue(page: Page): Promise<unknown[]> {
  return page.evaluate(async () => {
    return new Promise<unknown[]>((resolve) => {
      const req = indexedDB.open("ProjectPulse");
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("sync_queue")) {
          resolve([]);
          return;
        }
        const tx = db.transaction("sync_queue", "readonly");
        const store = tx.objectStore("sync_queue");
        const getReq = store.get("pulse_sync_queue");
        getReq.onsuccess = () => resolve((getReq.result as unknown[]) || []);
        getReq.onerror = () => resolve([]);
      };
      req.onerror = () => resolve([]);
    });
  });
}

export { expect };
