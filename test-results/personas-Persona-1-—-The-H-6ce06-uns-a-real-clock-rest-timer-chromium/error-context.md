# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: personas.spec.ts >> Persona 1 — The Hardcore Lifter >> starts session, recovers from crash, and runs a real-clock rest timer
- Location: tests\personas.spec.ts:88:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Add Exercise' })

```

# Page snapshot

```yaml
- generic [ref=e1]:
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
        - link [ref=e26] [cursor=pointer]:
          - /url: /app/capture
          - img [ref=e28]
        - link [ref=e32] [cursor=pointer]:
          - /url: /app/analytics
          - img [ref=e34]
        - link [ref=e37] [cursor=pointer]:
          - /url: /app/profile
          - img [ref=e39]
    - generic [ref=e42]:
      - banner [ref=e43]:
        - generic [ref=e44]:
          - button "Previous day" [ref=e45]:
            - img [ref=e46]
          - generic [ref=e48]:
            - button "Wed 27" [ref=e49]:
              - generic [ref=e50]: Wed
              - generic [ref=e51]: "27"
            - button "Thu 28" [ref=e52]:
              - generic [ref=e53]: Thu
              - generic [ref=e54]: "28"
            - button "Fri 29" [ref=e55]:
              - generic [ref=e56]: Fri
              - generic [ref=e57]: "29"
            - button "Sat 30" [ref=e58]:
              - generic [ref=e59]: Sat
              - generic [ref=e60]: "30"
            - button "Sun 31" [ref=e61]:
              - generic [ref=e62]: Sun
              - generic [ref=e63]: "31"
            - button "Mon 1" [ref=e64]:
              - generic [ref=e65]: Mon
              - generic [ref=e66]: "1"
            - button "Tue 2" [ref=e68]:
              - generic [ref=e69]: Tue
              - generic [ref=e70]: "2"
          - button "Next day" [ref=e71]:
            - img [ref=e72]
          - button "Reset to today" [disabled] [ref=e74]:
            - img [ref=e75]
      - main [ref=e77]:
        - generic [ref=e80]:
          - img [ref=e82]
          - generic [ref=e88]:
            - heading "Ready to Train?" [level=1] [ref=e89]
            - paragraph [ref=e90]: Start a new workout session to begin tracking
          - button "Start Workout" [active] [ref=e91]:
            - img [ref=e92]
            - text: Start Workout
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import {
  3   |   seedAuth,
  4   |   seedUserState,
  5   |   stubBiometrics,
  6   |   settle,
  7   |   readSyncQueue,
  8   | } from "./helpers";
  9   | 
  10  | /**
  11  |  * Project Pulse V2 — Persona-Driven E2E Test Suite
  12  |  *
  13  |  * These scripts simulate three real-world user personas and assert on
  14  |  * crash recovery, optimistic UI, background-suspension-immune timers,
  15  |  * and the strict FIFO offline sync queue.
  16  |  *
  17  |  * NOTE: Network calls to the live backend are stubbed via page.route so
  18  |  * the suite is deterministic and runs without a running FastAPI server.
  19  |  */
  20  | 
  21  | // =============================================================
  22  | // Persona 1 — "The Hardcore Lifter" (Active State & Crash Recovery)
  23  | // =============================================================
  24  | 
  25  | test.describe("Persona 1 — The Hardcore Lifter", () => {
  26  |   test.beforeEach(async ({ context, page }) => {
  27  |     await seedAuth(context);
  28  |     await seedUserState(page);
  29  |     await stubBiometrics(page);
  30  | 
  31  |     // Stub workout session start
  32  |     await page.route("**/api/v2/training/session/start**", async (route) => {
  33  |       await route.fulfill({
  34  |         status: 201,
  35  |         contentType: "application/json",
  36  |         body: JSON.stringify({
  37  |           id: "session-e2e-1",
  38  |           user_id: "524ddf11-d3e1-4d0e-8381-1cf3df286880",
  39  |           name: "Workout Session",
  40  |           template_id: null,
  41  |           started_at: new Date().toISOString(),
  42  |           completed_at: null,
  43  |           total_volume_kg: null,
  44  |           sets: [],
  45  |           created_at: new Date().toISOString(),
  46  |           updated_at: new Date().toISOString(),
  47  |         }),
  48  |       });
  49  |     });
  50  | 
  51  |     // Stub exercise search
  52  |     await page.route("**/api/v2/training/exercises/search**", async (route) => {
  53  |       await route.fulfill({
  54  |         status: 200,
  55  |         contentType: "application/json",
  56  |         body: JSON.stringify([
  57  |           { id: "ex-squat", name: "Back Squat", category: "strength" },
  58  |         ]),
  59  |       });
  60  |     });
  61  | 
  62  |     // Stub set logging
  63  |     await page.route("**/api/v2/training/set/log**", async (route) => {
  64  |       await route.fulfill({
  65  |         status: 201,
  66  |         contentType: "application/json",
  67  |         body: JSON.stringify({
  68  |           id: "set-" + Date.now(),
  69  |           session_id: "session-e2e-1",
  70  |           exercise_id: "ex-squat",
  71  |           set_number: 1,
  72  |           weight_kg: 100,
  73  |           reps: 5,
  74  |           rpe: null,
  75  |           completed: true,
  76  |           created_at: new Date().toISOString(),
  77  |           updated_at: new Date().toISOString(),
  78  |         }),
  79  |       });
  80  |     });
  81  | 
  82  |     // Stub previous-sets history (empty)
  83  |     await page.route("**/api/v2/training/exercise/*/previous", async (route) => {
  84  |       await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  85  |     });
  86  |   });
  87  | 
  88  |   test("starts session, recovers from crash, and runs a real-clock rest timer", async ({
  89  |     page,
  90  |   }) => {
  91  |     // 1. Navigate to the workout page and start a session
  92  |     await page.goto("/app/workout");
  93  |     await page.getByRole("button", { name: "Start Workout" }).click();
  94  | 
  95  |     // Session header should appear
  96  |     await expect(page.getByText("Workout Session")).toBeVisible();
  97  | 
  98  |     // 2. Add an exercise
> 99  |     await page.getByRole("button", { name: "Add Exercise" }).click();
      |                                                              ^ Error: locator.click: Test timeout of 30000ms exceeded.
  100 |     await page.getByPlaceholder("Search exercises...").fill("squat");
  101 |     await settle(page, 400); // debounce
  102 |     await page.getByText("Back Squat").click();
  103 |     await expect(page.getByRole("heading", { name: "Back Squat" })).toBeVisible();
  104 | 
  105 |     // 3. Log 2 sets (weight + reps + complete)
  106 |     const weightInputs = page.locator('input[inputmode="decimal"]');
  107 |     const repInputs = page.locator('input[inputmode="numeric"]');
  108 | 
  109 |     // Set 1
  110 |     await weightInputs.nth(0).fill("100");
  111 |     await repInputs.nth(0).fill("5");
  112 |     await page.getByRole("button", { name: "Mark set 1 complete" }).click();
  113 | 
  114 |     // Set 2
  115 |     await weightInputs.nth(1).fill("100");
  116 |     await repInputs.nth(1).fill("5");
  117 |     await page.getByRole("button", { name: "Mark set 2 complete" }).click();
  118 | 
  119 |     // Verify localStorage holds the active session before crash
  120 |     const beforeCrash = await page.evaluate(() =>
  121 |       localStorage.getItem("pulse_active_workout")
  122 |     );
  123 |     expect(beforeCrash).toContain("session-e2e-1");
  124 |     expect(beforeCrash).toContain("Back Squat");
  125 | 
  126 |     // 4. Simulate a sudden tab crash / hard reload
  127 |     await page.reload();
  128 | 
  129 |     // 5. Verify the active gym session is restored from localStorage
  130 |     await expect(page.getByText("Workout Session")).toBeVisible();
  131 |     await expect(page.getByRole("heading", { name: "Back Squat" })).toBeVisible();
  132 | 
  133 |     // 6. Log a 3rd set and trigger the rest timer
  134 |     await weightInputs.nth(2).fill("102.5");
  135 |     await repInputs.nth(2).fill("4");
  136 | 
  137 |     const timeBeforeComplete = Date.now();
  138 |     await page.getByRole("button", { name: "Mark set 3 complete" }).click();
  139 | 
  140 |     // 7. Assert restTimerExpiration uses real system timestamps
  141 |     const restExpiration = await page.evaluate(() => {
  142 |       const raw = localStorage.getItem("pulse_active_workout");
  143 |       if (!raw) return null;
  144 |       const parsed = JSON.parse(raw);
  145 |       return parsed.restTimerExpiration as number | null;
  146 |     });
  147 | 
  148 |     expect(restExpiration).not.toBeNull();
  149 |     // Default rest duration is 90s; expiration must be ~now + 90_000ms (wall clock)
  150 |     const expectedMin = timeBeforeComplete + 80_000;
  151 |     const expectedMax = timeBeforeComplete + 100_000;
  152 |     expect(restExpiration!).toBeGreaterThan(expectedMin);
  153 |     expect(restExpiration!).toBeLessThan(expectedMax);
  154 | 
  155 |     // The floating rest timer widget should be visible
  156 |     await expect(page.getByText("Rest timer")).toBeVisible();
  157 |   });
  158 | });
  159 | 
  160 | // =============================================================
  161 | // Persona 2 — "The Busy Calorie-Tracker" (Frictionless Logging & Scans)
  162 | // =============================================================
  163 | 
  164 | test.describe("Persona 2 — The Busy Calorie-Tracker", () => {
  165 |   test.beforeEach(async ({ context, page }) => {
  166 |     await seedAuth(context);
  167 |     await seedUserState(page);
  168 |     await stubBiometrics(page);
  169 | 
  170 |     // Diary starts empty, then returns the logged egg after POST
  171 |     let diaryHasEgg = false;
  172 | 
  173 |     await page.route("**/api/v2/nutrition/diary**", async (route) => {
  174 |       const body = diaryHasEgg
  175 |         ? {
  176 |             breakfast: [
  177 |               {
  178 |                 id: "log-egg-1",
  179 |                 user_id: "524ddf11-d3e1-4d0e-8381-1cf3df286880",
  180 |                 logged_at: new Date().toISOString(),
  181 |                 meal_type: "breakfast",
  182 |                 food_id: "food-egg",
  183 |                 recipe_id: null,
  184 |                 serving_size_g: 150,
  185 |                 food: {
  186 |                   id: "food-egg",
  187 |                   name: "Egg",
  188 |                   brand: null,
  189 |                   calories_per_100g: 155,
  190 |                   protein_per_100g: 13,
  191 |                   carbs_per_100g: 1.1,
  192 |                   fat_per_100g: 11,
  193 |                 },
  194 |                 created_at: new Date().toISOString(),
  195 |                 updated_at: new Date().toISOString(),
  196 |               },
  197 |             ],
  198 |             lunch: [],
  199 |             dinner: [],
```