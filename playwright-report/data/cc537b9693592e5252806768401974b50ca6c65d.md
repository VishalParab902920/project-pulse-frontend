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
    - complementary [ref=e13]:
      - navigation [ref=e14]:
        - link [ref=e15] [cursor=pointer]:
          - /url: /app
          - img [ref=e17]
        - link [ref=e22] [cursor=pointer]:
          - /url: /app/diary
          - img [ref=e24]
        - link [ref=e27] [cursor=pointer]:
          - /url: /app/capture
          - img [ref=e29]
        - link [ref=e33] [cursor=pointer]:
          - /url: /app/analytics
          - img [ref=e35]
        - link [ref=e38] [cursor=pointer]:
          - /url: /app/profile
          - img [ref=e40]
    - generic [ref=e43]:
      - banner [ref=e44]:
        - generic [ref=e45]:
          - button "Previous day" [ref=e46]:
            - img [ref=e47]
          - generic [ref=e49]:
            - button "Wed 27" [ref=e50]:
              - generic [ref=e51]: Wed
              - generic [ref=e52]: "27"
            - button "Thu 28" [ref=e53]:
              - generic [ref=e54]: Thu
              - generic [ref=e55]: "28"
            - button "Fri 29" [ref=e56]:
              - generic [ref=e57]: Fri
              - generic [ref=e58]: "29"
            - button "Sat 30" [ref=e59]:
              - generic [ref=e60]: Sat
              - generic [ref=e61]: "30"
            - button "Sun 31" [ref=e62]:
              - generic [ref=e63]: Sun
              - generic [ref=e64]: "31"
            - button "Mon 1" [ref=e65]:
              - generic [ref=e66]: Mon
              - generic [ref=e67]: "1"
            - button "Tue 2" [ref=e69]:
              - generic [ref=e70]: Tue
              - generic [ref=e71]: "2"
          - button "Next day" [ref=e72]:
            - img [ref=e73]
          - button "Reset to today" [disabled] [ref=e75]:
            - img [ref=e76]
      - main [ref=e78]:
        - generic [ref=e80]:
          - generic [ref=e81]:
            - generic [ref=e82]:
              - generic [ref=e83]:
                - img [ref=e84]
                - generic [ref=e87]:
                  - generic [ref=e88]: "2530"
                  - generic [ref=e89]: left
              - generic [ref=e90]:
                - generic [ref=e91]:
                  - generic [ref=e92]: Target
                  - generic [ref=e93]: "2530"
                - generic [ref=e94]:
                  - generic [ref=e95]: Eaten
                  - generic [ref=e96]: "0"
                - generic [ref=e97]:
                  - generic [ref=e98]: Burned
                  - generic [ref=e99]: "+0"
            - generic [ref=e100]:
              - generic [ref=e102]:
                - generic [ref=e103]: Protein
                - generic [ref=e104]: 0/190g
              - generic [ref=e107]:
                - generic [ref=e108]: Carbs
                - generic [ref=e109]: 0/253g
              - generic [ref=e112]:
                - generic [ref=e113]: Fat
                - generic [ref=e114]: 0/84g
          - generic [ref=e116]:
            - img [ref=e119]
            - paragraph [ref=e123]:
              - text: "Water:"
              - generic [ref=e124]: 0ml
              - generic [ref=e125]: / 2500ml
            - button "250ml" [ref=e126]:
              - img [ref=e127]
              - text: 250ml
          - generic [ref=e128]:
            - generic [ref=e129]:
              - generic [ref=e130]:
                - img [ref=e131]
                - generic [ref=e133]: Breakfast
              - button "Add" [ref=e134]:
                - img [ref=e135]
                - text: Add
            - paragraph [ref=e137]: No entries yet
          - generic [ref=e138]:
            - generic [ref=e139]:
              - generic [ref=e140]:
                - img [ref=e141]
                - generic [ref=e147]: Lunch
              - button "Add" [ref=e148]:
                - img [ref=e149]
                - text: Add
            - paragraph [ref=e151]: No entries yet
          - generic [ref=e152]:
            - generic [ref=e153]:
              - generic [ref=e154]:
                - img [ref=e155]
                - generic [ref=e157]: Dinner
              - button "Add" [ref=e158]:
                - img [ref=e159]
                - text: Add
            - paragraph [ref=e161]: No entries yet
          - generic [ref=e162]:
            - generic [ref=e163]:
              - generic [ref=e164]:
                - img [ref=e165]
                - generic [ref=e167]: Snacks
              - button "Add" [ref=e168]:
                - img [ref=e169]
                - text: Add
            - paragraph [ref=e171]: No entries yet
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