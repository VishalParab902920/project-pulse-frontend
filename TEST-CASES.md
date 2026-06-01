# Project Pulse V2 — Master Test Cases Blueprint

This catalog defines the integration and end-to-end test coverage for the Project Pulse V2 PWA.
Each case lists the **Precondition**, **Steps**, and **Expected Result**. Automated coverage
references live in `tests/personas.spec.ts`.

**Legend:** 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low

---

## 1. Authentication & Security

### AUTH-01 — Envelope Encryption DEK Auto-Generation 🔴
- **Precondition:** A valid Supabase JWT for a brand-new user with no `profiles` row.
- **Steps:**
  1. Call any authenticated V2 endpoint (e.g. `GET /api/v2/profile/biometrics`) with the Bearer token.
  2. Inspect the `profiles` table for the user's UUID.
- **Expected Result:** A profile row is auto-provisioned. `encrypted_dek`, `dek_salt`, and `dek_iv` are all populated and non-null. The raw DEK is never returned in any API response.

### AUTH-02 — 401 JWT Rejection (Missing / Malformed) 🔴
- **Precondition:** None.
- **Steps:**
  1. Call `GET /api/v2/nutrition/diary` with no `Authorization` header.
  2. Repeat with `Authorization: Bearer not-a-real-token`.
  3. Repeat with an expired token.
- **Expected Result:** All three return `401 Unauthorized`. The body contains a generic detail (no stack trace, no secret leakage). `WWW-Authenticate: Bearer` header present.

### AUTH-03 — ES256 / JWKS Verification Path 🟠
- **Precondition:** Real Supabase user access token (ES256, `kid` in header).
- **Steps:**
  1. Issue an authenticated request.
  2. Confirm JWKS is fetched once and cached (subsequent requests do not re-fetch).
- **Expected Result:** Token verifies against the cached EC public key. No "alg not allowed" error.

### AUTH-04 — BYOK Key Encryption Round-Trip 🔴
- **Precondition:** Authenticated user with a provisioned DEK.
- **Steps:**
  1. `PUT /api/v2/profile/byok` with `{ gemini_api_key: "AIza-test-key" }`.
  2. Read the stored `encrypted_byok` ciphertext directly from the DB.
  3. Server-side decrypt with the user DEK.
- **Expected Result:** Stored value is ciphertext (never plaintext). Decryption returns the exact original key. A fresh 12-byte IV is generated per save (no reuse across two saves).

### AUTH-05 — Strict Session Guard 🟠
- **Precondition:** No `sb-access-token` cookie.
- **Steps:** Navigate directly to `/app/diary`.
- **Expected Result:** Middleware hard-redirects to `/login?redirect=/app/diary`.

---

## 2. Nutrition Workspace

### NUT-01 — Barcode Scanner Camera Permission Block → Manual Fallback 🔴
- **Precondition:** Diary open, Food Search modal on the "Barcode" tab.
- **Steps:**
  1. Deny camera permission (or run in a context with no camera).
  2. Observe the scanner initialization `try/catch`.
- **Expected Result:** Camera init fails gracefully. UI shows "Camera unavailable. Type barcode manually:" with a numeric input and lookup button. No uncaught exception.

### NUT-02 — Manual Barcode Lookup 🟠
- **Precondition:** Manual barcode fallback visible.
- **Steps:** Enter `3017620422003`, click lookup.
- **Expected Result:** Backend Open Food Facts proxy returns product data; the serving-size selector view opens with the resolved food name and per-100g macros.

### NUT-03 — Catalog Search Autocomplete 🟡
- **Precondition:** Food Search modal, "Search" tab.
- **Steps:** Type "egg" (≥2 chars), wait for debounce (300ms).
- **Expected Result:** Results render from `GET /api/v2/nutrition/food/search`. Selecting one opens the serving slider (default 100g) with live macro recalculation.

### NUT-04 — Water Tracking Optimistic Increment 🔴
- **Precondition:** Diary loaded for the selected date.
- **Steps:**
  1. Note current water total.
  2. Click `+250ml`.
  3. Observe UI immediately, then the network call.
- **Expected Result:** UI increments by 250ml instantly (optimistic). `POST /api/v2/nutrition/water` fires with `{date, amount_ml: 250}`. On API failure, UI rolls back to the prior value. Haptic `vibrate(10)` triggered.

### NUT-05 — Daily Macro Summation Lookup 🟠
- **Precondition:** ≥2 logged foods on the selected date.
- **Steps:** Load the diary; read the Net Calories header and macro mini-bars.
- **Expected Result:** `total_calories/protein/carbs/fat` equal the sum of `(per_100g × serving_size_g / 100)` across all logs. `daily_nutrition_summaries` reflects the same aggregate.

### NUT-06 — Optimistic Log Delete + Rollback 🟡
- **Precondition:** ≥1 food log present.
- **Steps:** Click the trash icon on a log; simulate API failure.
- **Expected Result:** Item removed from UI instantly; restored on failure.

### NUT-07 — Reactive Date Re-fetch 🟡
- **Precondition:** Diary open.
- **Steps:** Change the global `selectedDate` via the Date Switcher.
- **Expected Result:** Diary and water state re-fetch automatically for the new date.

---

## 3. Lifting Workout Workspace

### GYM-01 — Chronometer Accuracy 🟠
- **Precondition:** Active workout session started.
- **Steps:** Observe the elapsed timer over 10 real seconds.
- **Expected Result:** Elapsed display is derived from `Date.now() - startedAt` (wall-clock), formatted `M:SS`. Drift ≤ 1s over the observation window.

### GYM-02 — Set Completion State Transition 🔴
- **Precondition:** An exercise added; weight + reps entered for a set.
- **Steps:** Click the set's completion checkbox.
- **Expected Result:** Inputs lock (disabled), row gets the purple "completed" styling, `POST /api/v2/training/set/log` fires with `completed: true`, and the rest timer starts.

### GYM-03 — Completion Disabled Without Weight/Reps ⚪
- **Precondition:** Empty set row.
- **Steps:** Attempt to click the completion checkbox.
- **Expected Result:** Button is disabled until both weight and reps are non-empty.

### GYM-04 — Progressive Overload Historical Display 🟠
- **Precondition:** A prior completed session exists for the same exercise.
- **Steps:** Add that exercise to a new session.
- **Expected Result:** "Prev: 100kg×5, 100kg×5, 100kg×5" sub-header renders from `GET /api/v2/training/exercise/{id}/previous`; previous values appear as input placeholders.

### GYM-05 — Crash Recovery from localStorage 🔴
- **Precondition:** Active session with ≥2 logged sets.
- **Steps:** Hard reload the page (`page.reload()`).
- **Expected Result:** Session, exercises, and set data are restored from `localStorage` (`pulse_active_workout`). Session continues seamlessly without re-start.

### GYM-06 — Rest Timer Background-Suspension Immunity 🔴
- **Precondition:** Rest timer active (e.g., 90s).
- **Steps:** Freeze/suspend the tab (simulate by advancing system clock or backgrounding), then resume.
- **Expected Result:** Remaining time is computed as `restTimerExpiration - Date.now()`, NOT a decrementing counter. On resume, the displayed time reflects true elapsed wall-clock. Expiry fires `vibrate([100,50,100])` + notification tone.

### GYM-07 — Session Completion Volume Calculation 🟠
- **Precondition:** Session with completed sets.
- **Steps:** Click "Complete".
- **Expected Result:** `POST /api/v2/training/session/{id}/complete` calculates `total_volume_kg = Σ(weight × reps)` for completed sets; `localStorage` cache is wiped; navigation returns to dashboard.

---

## 4. PWA Offline Sync Queue

### SYNC-01 — Offline Indicator Visibility 🟠
- **Precondition:** App loaded, online.
- **Steps:** Toggle offline (`context.setOffline(true)`).
- **Expected Result:** Floating amber "Working Offline" pill appears with pending count.

### SYNC-02 — FIFO Chronological Ordering 🔴
- **Precondition:** Offline.
- **Steps:** Queue 3 actions in order: water +250ml, food log, completed set.
- **Expected Result:** IndexedDB `pulse_sync_queue` contains exactly 3 items with strictly increasing `timestamp`. On reconnect, they flush in that exact order.

### SYNC-03 — Connection Drop Mid-Sync 🔴
- **Precondition:** Queue has multiple pending items; online.
- **Steps:** Begin flush, drop connection after the first item resolves.
- **Expected Result:** Loop breaks immediately. The successfully-synced item is removed from IndexedDB; remaining items persist in original order for the next flush. No partial/corrupt state.

### SYNC-04 — Idempotency / Duplicate Prevention 🔴
- **Precondition:** An item that was actually persisted server-side but whose response was lost.
- **Steps:** Re-flush the same queued item.
- **Expected Result:** Backend returns `409 Conflict` (or 2xx); the client treats both as success and removes the item. No duplicate DB row created.

### SYNC-05 — Items Removed Only After Success 🟠
- **Precondition:** Queue with items; server returns 5xx for one.
- **Steps:** Flush.
- **Expected Result:** Items returning 5xx remain in the queue (retry later); only 2xx/409/4xx-terminal items are removed.

### SYNC-06 — Queue Hydration on App Start 🟡
- **Precondition:** Pending items in IndexedDB; app closed and reopened.
- **Steps:** Reload the app.
- **Expected Result:** `loadQueueFromStorage` rehydrates the in-memory queue; pending count is accurate.

---

## 5. Performance & PWA Health

### PERF-01 — Long Task Detection 🟠
- **Steps:** Run any persona flow with the `PerformanceMonitor` mounted.
- **Expected Result:** Any task blocking the main thread > 50ms is logged with a `[PERF][longtask]` warning including duration and attribution.

### PERF-02 — Layout Shift (CLS) Detection 🟠
- **Steps:** Navigate between tabs while charts/cards animate in.
- **Expected Result:** Unexpected layout shifts log `[PERF][layout-shift]` with the shift value. Cumulative score stays below 0.1 for a pass.

### PERF-03 — GPU Acceleration Coverage 🟡
- **Steps:** Audit scroll containers and chart wrappers.
- **Expected Result:** Heavy scroll/animated regions carry `transform-gpu`; chart wrappers carry `min-h-[1px]` so `ResponsiveContainer` resolves dimensions.

---

## Automated Coverage Map

| Persona Script | Cases Covered |
|---|---|
| Persona 1 — Hardcore Lifter | GYM-01, GYM-02, GYM-05, GYM-06 |
| Persona 2 — Busy Calorie-Tracker | NUT-01, NUT-02, NUT-04, NUT-05 |
| Persona 3 — Offline Athlete | SYNC-01, SYNC-02, SYNC-03, SYNC-04 |
| PerformanceMonitor (all flows) | PERF-01, PERF-02 |
