# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: personas.spec.ts >> Persona 3 — The Offline Athlete >> queues 3 offline actions in FIFO order and flushes on reconnect
- Location: tests\personas.spec.ts:354:7

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 3
Received:    0
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
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
            - img [ref=e127]
            - paragraph [ref=e131]:
              - text: "Water:"
              - generic [ref=e132]: 0ml
              - generic [ref=e133]: / 2500ml
            - button "250ml" [ref=e134]:
              - img [ref=e135]
              - text: 250ml
          - generic [ref=e136]:
            - generic [ref=e137]:
              - generic [ref=e138]:
                - img [ref=e139]
                - generic [ref=e141]: Breakfast
              - button "Add" [ref=e142]:
                - img [ref=e143]
                - text: Add
            - paragraph [ref=e145]: No entries yet
          - generic [ref=e146]:
            - generic [ref=e147]:
              - generic [ref=e148]:
                - img [ref=e149]
                - generic [ref=e155]: Lunch
              - button "Add" [ref=e156]:
                - img [ref=e157]
                - text: Add
            - paragraph [ref=e159]: No entries yet
          - generic [ref=e160]:
            - generic [ref=e161]:
              - generic [ref=e162]:
                - img [ref=e163]
                - generic [ref=e165]: Dinner
              - button "Add" [ref=e166]:
                - img [ref=e167]
                - text: Add
            - paragraph [ref=e169]: No entries yet
          - generic [ref=e170]:
            - generic [ref=e171]:
              - generic [ref=e172]:
                - img [ref=e173]
                - generic [ref=e175]: Snacks
              - button "Add" [ref=e176]:
                - img [ref=e177]
                - text: Add
            - paragraph [ref=e179]: No entries yet
```

# Test source

```ts
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
  419 | 
  420 |     // Give the FIFO pipeline time to flush sequentially
  421 |     await page.waitForTimeout(1500);
  422 | 
  423 |     // Assert sequential, chronological flush order
> 424 |     expect(flushOrder.length).toBeGreaterThanOrEqual(3);
      |                               ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  425 |     expect(flushOrder[0]).toContain("water");
  426 |     expect(flushOrder[1]).toContain("nutrition/log");
  427 |     expect(flushOrder[2]).toContain("set/log");
  428 | 
  429 |     // Assert the queue is drained from IndexedDB after a successful flush
  430 |     const drained = await readSyncQueue(page);
  431 |     expect(drained.length).toBe(0);
  432 |   });
  433 | 
  434 |   test("shows the offline warning pill when connection drops", async ({
  435 |     page,
  436 |     context,
  437 |   }) => {
  438 |     await page.goto("/app/diary");
  439 |     await context.setOffline(true);
  440 |     await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  441 | 
  442 |     await expect(page.getByText("Working Offline")).toBeVisible();
  443 |   });
  444 | });
  445 | 
```