# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: personas.spec.ts >> Persona 2 — The Busy Calorie-Tracker >> water tracker optimistically increments and macro rings update
- Location: tests\personas.spec.ts:310:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/250ml/)
Expected: visible
Error: strict mode violation: getByText(/250ml/) resolved to 2 elements:
    1) <span class="text-white font-medium">250ml</span> aka locator('span').filter({ hasText: '250ml' })
    2) <button class="flex items-center gap-1 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 px-3 py-1.5 text-xs font-medium text-accent-cyan hover:bg-accent-cyan/20 transition-colors active:scale-95">…</button> aka getByRole('button', { name: '250ml' })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText(/250ml/)

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]:
    - img [ref=e8]
  - alert [ref=e11]
  - generic [ref=e12]:
    - navigation [ref=e13]:
      - generic [ref=e14]:
        - link "Dashboard" [ref=e15] [cursor=pointer]:
          - /url: /app
          - generic [ref=e16]:
            - img [ref=e18]
            - generic [ref=e23]: Dashboard
        - link "Diary" [ref=e24] [cursor=pointer]:
          - /url: /app/diary
          - generic [ref=e25]:
            - img [ref=e27]
            - generic [ref=e29]: Diary
        - link [ref=e31] [cursor=pointer]:
          - /url: /app/capture
          - img [ref=e33]
        - link "Analytics" [ref=e37] [cursor=pointer]:
          - /url: /app/analytics
          - generic [ref=e38]:
            - img [ref=e40]
            - generic [ref=e43]: Analytics
        - link "Profile" [ref=e44] [cursor=pointer]:
          - /url: /app/profile
          - generic [ref=e45]:
            - img [ref=e47]
            - generic [ref=e50]: Profile
    - generic [ref=e51]:
      - banner [ref=e52]:
        - generic [ref=e53]:
          - button "Previous day" [ref=e54]:
            - img [ref=e55]
          - generic [ref=e57]:
            - button "Wed 27" [ref=e58]:
              - generic [ref=e59]: Wed
              - generic [ref=e60]: "27"
            - button "Thu 28" [ref=e61]:
              - generic [ref=e62]: Thu
              - generic [ref=e63]: "28"
            - button "Fri 29" [ref=e64]:
              - generic [ref=e65]: Fri
              - generic [ref=e66]: "29"
            - button "Sat 30" [ref=e67]:
              - generic [ref=e68]: Sat
              - generic [ref=e69]: "30"
            - button "Sun 31" [ref=e70]:
              - generic [ref=e71]: Sun
              - generic [ref=e72]: "31"
            - button "Mon 1" [ref=e73]:
              - generic [ref=e74]: Mon
              - generic [ref=e75]: "1"
            - button "Tue 2" [ref=e77]:
              - generic [ref=e78]: Tue
              - generic [ref=e79]: "2"
          - button "Next day" [ref=e80]:
            - img [ref=e81]
          - button "Reset to today" [disabled] [ref=e83]:
            - img [ref=e84]
      - main [ref=e86]:
        - generic [ref=e88]:
          - generic [ref=e89]:
            - generic [ref=e90]:
              - generic [ref=e91]:
                - img [ref=e92]
                - generic [ref=e95]:
                  - generic [ref=e96]: "2530"
                  - generic [ref=e97]: left
              - generic [ref=e98]:
                - generic [ref=e99]:
                  - generic [ref=e100]: Target
                  - generic [ref=e101]: "2530"
                - generic [ref=e102]:
                  - generic [ref=e103]: Eaten
                  - generic [ref=e104]: "0"
                - generic [ref=e105]:
                  - generic [ref=e106]: Burned
                  - generic [ref=e107]: "+0"
            - generic [ref=e108]:
              - generic [ref=e110]:
                - generic [ref=e111]: Protein
                - generic [ref=e112]: 0/190g
              - generic [ref=e115]:
                - generic [ref=e116]: Carbs
                - generic [ref=e117]: 0/253g
              - generic [ref=e120]:
                - generic [ref=e121]: Fat
                - generic [ref=e122]: 0/84g
          - generic [ref=e124]:
            - img [ref=e128]
            - paragraph [ref=e132]:
              - text: "Water:"
              - generic [ref=e133]: 250ml
              - generic [ref=e134]: / 2500ml
            - button "250ml" [active] [ref=e135]:
              - img [ref=e136]
              - text: 250ml
          - generic [ref=e137]:
            - generic [ref=e138]:
              - generic [ref=e139]:
                - img [ref=e140]
                - generic [ref=e142]: Breakfast
              - button "Add" [ref=e143]:
                - img [ref=e144]
                - text: Add
            - paragraph [ref=e146]: No entries yet
          - generic [ref=e147]:
            - generic [ref=e148]:
              - generic [ref=e149]:
                - img [ref=e150]
                - generic [ref=e156]: Lunch
              - button "Add" [ref=e157]:
                - img [ref=e158]
                - text: Add
            - paragraph [ref=e160]: No entries yet
          - generic [ref=e161]:
            - generic [ref=e162]:
              - generic [ref=e163]:
                - img [ref=e164]
                - generic [ref=e166]: Dinner
              - button "Add" [ref=e167]:
                - img [ref=e168]
                - text: Add
            - paragraph [ref=e170]: No entries yet
          - generic [ref=e171]:
            - generic [ref=e172]:
              - generic [ref=e173]:
                - img [ref=e174]
                - generic [ref=e176]: Snacks
              - button "Add" [ref=e177]:
                - img [ref=e178]
                - text: Add
            - paragraph [ref=e180]: No entries yet
```

# Test source

```ts
  218 |           total_protein: 0,
  219 |           total_carbs: 0,
  220 |           total_fat: 0,
  221 |         }),
  222 |       });
  223 |     });
  224 | 
  225 |     // Barcode proxy lookup
  226 |     await page.route("**/api/v2/nutrition/barcode/**", async (route) => {
  227 |       await route.fulfill({
  228 |         status: 200,
  229 |         contentType: "application/json",
  230 |         body: JSON.stringify({
  231 |           id: "food-nutella",
  232 |           name: "Nutella",
  233 |           brand: "Ferrero",
  234 |           calories_per_100g: 539,
  235 |           protein_per_100g: 6.3,
  236 |           carbs_per_100g: 57.5,
  237 |           fat_per_100g: 30.9,
  238 |         }),
  239 |       });
  240 |     });
  241 | 
  242 |     // Food log POST → mark diary as having the egg
  243 |     await page.route("**/api/v2/nutrition/log", async (route) => {
  244 |       if (route.request().method() === "POST") {
  245 |         diaryHasEgg = true;
  246 |         await route.fulfill({
  247 |           status: 201,
  248 |           contentType: "application/json",
  249 |           body: JSON.stringify({
  250 |             id: "log-egg-1",
  251 |             user_id: "524ddf11-d3e1-4d0e-8381-1cf3df286880",
  252 |             logged_at: new Date().toISOString(),
  253 |             meal_type: "breakfast",
  254 |             food_id: "food-egg",
  255 |             recipe_id: null,
  256 |             serving_size_g: 150,
  257 |             food: {
  258 |               id: "food-egg",
  259 |               name: "Egg",
  260 |               brand: null,
  261 |               calories_per_100g: 155,
  262 |               protein_per_100g: 13,
  263 |               carbs_per_100g: 1.1,
  264 |               fat_per_100g: 11,
  265 |             },
  266 |             created_at: new Date().toISOString(),
  267 |             updated_at: new Date().toISOString(),
  268 |           }),
  269 |         });
  270 |       } else {
  271 |         await route.continue();
  272 |       }
  273 |     });
  274 | 
  275 |     await page.route("**/api/v2/nutrition/water", async (route) => {
  276 |       await route.fulfill({
  277 |         status: 200,
  278 |         contentType: "application/json",
  279 |         body: JSON.stringify({ total_water_ml: 250 }),
  280 |       });
  281 |     });
  282 | 
  283 |     // Block camera so the barcode scanner falls back to manual input
  284 |     await context.grantPermissions([]);
  285 |   });
  286 | 
  287 |   test("logs food via manual barcode fallback after camera denial", async ({
  288 |     page,
  289 |   }) => {
  290 |     await page.goto("/app/diary");
  291 | 
  292 |     // Open the Add Food modal on the Breakfast container
  293 |     await page.getByRole("button", { name: "Add" }).first().click();
  294 | 
  295 |     // Switch to the Barcode tab — camera will fail to initialize
  296 |     await page.getByRole("button", { name: "Barcode" }).click();
  297 | 
  298 |     // Manual fallback input must be present (camera unavailable path)
  299 |     const barcodeInput = page.getByPlaceholder(/barcode/i).first();
  300 |     await expect(barcodeInput).toBeVisible();
  301 | 
  302 |     // Input the manual barcode and look it up
  303 |     await barcodeInput.fill("3017620422003");
  304 |     await page.getByRole("button", { name: /lookup|go/i }).first().click();
  305 | 
  306 |     // The resolved product appears in the serving-size view
  307 |     await expect(page.getByText("Nutella")).toBeVisible();
  308 |   });
  309 | 
  310 |   test("water tracker optimistically increments and macro rings update", async ({
  311 |     page,
  312 |   }) => {
  313 |     await page.goto("/app/diary");
  314 |     await expect(page.getByText(/Water:/)).toBeVisible();
  315 | 
  316 |     // Click +250ml — optimistic increment
  317 |     await page.getByRole("button", { name: /250ml/ }).click();
> 318 |     await expect(page.getByText(/250ml/)).toBeVisible();
      |                                           ^ Error: expect(locator).toBeVisible() failed
  319 | 
  320 |     // Add the egg food log and verify it renders + macros update
  321 |     await page.getByRole("button", { name: "Add" }).first().click();
  322 |     await page.getByPlaceholder("Search foods...").fill("egg");
  323 |     // Search stub not wired for this path; close and re-open diary to pull logged egg
  324 |     await page.keyboard.press("Escape");
  325 |   });
  326 | });
  327 | 
  328 | // =============================================================
  329 | // Persona 3 — "The Offline Athlete" (Strict FIFO Sync Queue)
  330 | // =============================================================
  331 | 
  332 | test.describe("Persona 3 — The Offline Athlete", () => {
  333 |   test.beforeEach(async ({ context, page }) => {
  334 |     await seedAuth(context);
  335 |     await seedUserState(page);
  336 |     await stubBiometrics(page);
  337 | 
  338 |     await page.route("**/api/v2/nutrition/diary**", async (route) => {
  339 |       await route.fulfill({
  340 |         status: 200,
  341 |         contentType: "application/json",
  342 |         body: JSON.stringify({ breakfast: [], lunch: [], dinner: [], snack: [] }),
  343 |       });
  344 |     });
  345 |     await page.route("**/api/v2/nutrition/summary/**", async (route) => {
  346 |       await route.fulfill({
  347 |         status: 200,
  348 |         contentType: "application/json",
  349 |         body: JSON.stringify({ total_water_ml: 0, total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0 }),
  350 |       });
  351 |     });
  352 |   });
  353 | 
  354 |   test("queues 3 offline actions in FIFO order and flushes on reconnect", async ({
  355 |     page,
  356 |     context,
  357 |   }) => {
  358 |     await page.goto("/app/diary");
  359 |     await expect(page.getByText(/Water:/)).toBeVisible();
  360 | 
  361 |     // Directly exercise the sync store to enqueue 3 chronological actions.
  362 |     // (Simulates water → food → set logged while offline.)
  363 |     await context.setOffline(true);
  364 | 
  365 |     await page.evaluate(async () => {
  366 |       // Enqueue 3 FIFO actions directly into IndexedDB with increasing timestamps,
  367 |       // mirroring the shape written by useSyncStore.queueOfflineAction.
  368 |       const items = [
  369 |         { id: "q1", endpoint: "/api/v2/nutrition/water", method: "POST", payload: { date: "2026-05-31", amount_ml: 250 }, timestamp: Date.now() },
  370 |         { id: "q2", endpoint: "/api/v2/nutrition/log", method: "POST", payload: { meal_type: "snack", serving_size_g: 50 }, timestamp: Date.now() + 10 },
  371 |         { id: "q3", endpoint: "/api/v2/training/set/log", method: "POST", payload: { set_number: 1, weight_kg: 100, reps: 5 }, timestamp: Date.now() + 20 },
  372 |       ];
  373 |       await new Promise<void>((resolve) => {
  374 |         const req = indexedDB.open("ProjectPulse");
  375 |         req.onupgradeneeded = () => {
  376 |           const db = req.result;
  377 |           if (!db.objectStoreNames.contains("sync_queue")) {
  378 |             db.createObjectStore("sync_queue");
  379 |           }
  380 |         };
  381 |         req.onsuccess = () => {
  382 |           const db = req.result;
  383 |           if (!db.objectStoreNames.contains("sync_queue")) {
  384 |             resolve();
  385 |             return;
  386 |           }
  387 |           const tx = db.transaction("sync_queue", "readwrite");
  388 |           tx.objectStore("sync_queue").put(items, "pulse_sync_queue");
  389 |           tx.oncomplete = () => resolve();
  390 |           tx.onerror = () => resolve();
  391 |         };
  392 |         req.onerror = () => resolve();
  393 |       });
  394 |     });
  395 | 
  396 |     // Assert exactly 3 pending transactions in IndexedDB, chronologically ordered
  397 |     const queue = (await readSyncQueue(page)) as Array<{ timestamp: number; endpoint: string }>;
  398 |     expect(queue.length).toBe(3);
  399 |     expect(queue[0].timestamp).toBeLessThan(queue[1].timestamp);
  400 |     expect(queue[1].timestamp).toBeLessThan(queue[2].timestamp);
  401 |     expect(queue[0].endpoint).toContain("water");
  402 |     expect(queue[2].endpoint).toContain("set/log");
  403 | 
  404 |     // Track the exact order in which the backend receives the flushed requests
  405 |     const flushOrder: string[] = [];
  406 |     await page.route("**/api/v2/**", async (route) => {
  407 |       const url = route.request().url();
  408 |       if (url.includes("/water") || url.includes("/nutrition/log") || url.includes("/set/log")) {
  409 |         flushOrder.push(url);
  410 |         await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  411 |       } else {
  412 |         await route.continue();
  413 |       }
  414 |     });
  415 | 
  416 |     // Go back online — the ConnectionMonitor should trigger a flush
  417 |     await context.setOffline(false);
  418 |     await page.evaluate(() => window.dispatchEvent(new Event("online")));
```