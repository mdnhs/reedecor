# Admin Feature Flags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A saas admin can switch platform features on and off from a Features page; a switched-off feature disappears from the UI and is refused by the server, without deleting any data.

**Architecture:** A code-defined catalogue lists the flags. A `feature_flags` table stores only overrides (a missing row means enabled). A small server service reads the rows with a short cache and fails open. Public `GET /api/features` returns the flag map for the UI; admin-only endpoints list and change flags. A client provider and `useFeature(key)` hook gate the UI, and server routes call the service to enforce each flag.

**Tech Stack:** Next.js (App Router), Hono, Supabase, zod, vitest.

**Spec:** none (the user asked for admin on/off switches for features and left the design to the builder). Decisions are recorded under Global Constraints. This plan stacks on `feature/customer-scene-view` (Phases 1 to 4 of the room-assets work, already reviewed).

## Global Constraints

- Flags are platform-wide (one value for everyone), changed only by a saas_admin.
- The catalogue (`key`, label, description, group), all defaulting to enabled:
  - `model_generation`: "3D model generation" (Create 3D Model page, product creation, generate, retry).
  - `scene_editor`: "Room scene editor" (merchant asset rail, placing items, saving scenes, merchant asset list).
  - `room_builder`: "Room walls and floor" (the Room panel, rendering of rooms).
  - `customer_scene_view`: "Styled scenes for customers" (customers see the merchant's saved scene).
  - `capture_thumbnails`: "Screenshot capture and thumbnails" (Capture button, Use as thumbnail, automatic first-frame thumbnail).
  - `backdrop_menu`: "Backdrop menu" (the Backdrop control in the viewer).
  - `wishlist`: "Wishlist" (heart buttons and wishlist API).
  - `whatsapp_contact`: "WhatsApp contact buttons".
- Storage is a table `feature_flags (key text primary key, enabled boolean not null, updated_by text, updated_at timestamptz not null default now())`. A missing row, a missing table, or a failed read means enabled (fail open) and is logged; the Features page shows an error banner when it cannot save.
- Switching a flag off never deletes or edits stored data. Turning it back on restores everything.
- Enforcement is on the server as well as in the UI. A refused request returns 403 `{ success: false, error: "This feature is turned off by the administrator.", code: "feature_disabled" }`.
- Server rules: `model_generation` off refuses `POST /products`, `POST /products/:id/generate` and `POST /products/:id/retry` (cancel, read and delete stay allowed). `scene_editor` off refuses `PUT /products/:id/scene` and `GET /assets`. `room_builder` off makes `GET /products/:id/scene` omit `room`, and `PUT /products/:id/scene` keep the previously stored room and ignore any `room` in the body. `customer_scene_view` off makes `GET /products/:id/scene` return the empty scene (backdrop `auto`, no items, no room), except that when `scene_editor` is on, a saas_admin or the owning merchant still gets the real scene. `capture_thumbnails` off refuses `POST /products/:id/thumbnail`. `wishlist` off refuses `POST /wishlists/:productId/toggle` and makes `GET /wishlists` return an empty list. `backdrop_menu` and `whatsapp_contact` are UI-only.
- Server cache: flags are cached for 5 seconds in memory and the cache is cleared whenever a flag is set.
- Client: flags load once through `GET /api/features`; until they load, and if the request fails, every feature counts as enabled.
- The Features page is admin-only (same guard pattern as the other admin pages), reachable from a new "Features" item in the Administration group of the sidebar (`dashboard-layout.tsx`).
- Tailwind: scale values only, no arbitrary px. No filler comments (global CLAUDE.md).
- Git: do not work on `main`. New branch `feature/admin-feature-flags` stacked on `feature/customer-scene-view` (Phase 4 is not merged yet). One branch, one commit: stage and `git commit --amend` after the first commit; message format `feat: admin-feature-flags` with a numbered cumulative body; no Co-Authored-By line; never `--no-verify`; no force-push without asking.
- The agent cannot run SQL on Supabase. Task 2 produces a SQL file; the user runs it and confirms before the live checks. Until then the table is missing and everything stays enabled.

## Review Focus

- With the table missing or the database unreachable, every feature stays enabled and nothing errors for users.
- A non-admin (customer, merchant, anonymous) cannot change a flag; an unknown key and a non-boolean `enabled` return 400.
- Turning `scene_editor` off hides the editor and refuses scene saves, but the scene data stays and customers still see it while `customer_scene_view` is on; turning flags back on restores the editor with the same data.
- Saving a scene while `room_builder` is off does not delete the stored room; reading it while off omits the room.
- With `customer_scene_view` off, customers see the plain product but the owner and admin editing keep working when `scene_editor` is on.
- With `capture_thumbnails` off there is no Capture button, no Use as thumbnail and no automatic thumbnail request.
- Flag changes reach the server within the 5 second cache window and reach already-open pages on their next load.
- `model_generation` off refuses generate and retry on the server (a direct API call fails) and hides the Create 3D Model entry; viewing existing models still works.

---

### Task 1: Feature catalogue

**Files:**
- Create: `src/lib/features/catalog.ts`
- Test: `tests/features.test.ts`

**Interfaces:**
- Produces: `FEATURE_KEYS` (readonly tuple of the eight keys above), `FeatureKey`, `FeatureDefinition { key: FeatureKey; label: string; description: string; group: "Models" | "Room studio" | "Viewer" | "Shopping" }`, `FEATURES: FeatureDefinition[]` (one per key, in the order listed above, with the labels from Global Constraints), `FeatureFlags = Record<FeatureKey, boolean>`, `isFeatureKey(value: string): value is FeatureKey`, `resolveFlags(rows: { key: string; enabled: boolean }[]): FeatureFlags` (starts all true, applies rows with known keys, ignores unknown keys), `featureOffMessage = "This feature is turned off by the administrator."`.

- [ ] **Step 1: Write failing tests:** the catalogue has eight unique keys that equal `FEATURE_KEYS`; every definition has a non-empty label and description; `isFeatureKey` accepts each key and rejects `"nope"` and `""`; `resolveFlags([])` is all true; `resolveFlags([{ key: "wishlist", enabled: false }])` turns off only `wishlist`; unknown keys are ignored; a later row for the same key wins.
- [ ] **Step 2: Run** `pnpm vitest run tests/features.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `catalog.ts`.**
- [ ] **Step 4: Run** `pnpm vitest run`. Expected: all pass.
- [ ] **Step 5: Commit** (branch and amend rules in Global Constraints).

### Task 2: Storage, service and routes

**Files:**
- Create: `docs/superpowers/sql/2026-10-25-feature-flags.sql`, `src/lib/supabase/features-db.ts`, `src/server/feature-service.ts`, `src/server/feature-routes.ts`
- Modify: `src/lib/db/schema.ts`, `src/server/app.ts` (mount the routes)
- Test: `tests/features-db.test.ts`, `tests/feature-api.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces SQL: `create table if not exists feature_flags (key text primary key, enabled boolean not null, updated_by text, updated_at timestamptz not null default now())`; mirror it in `schema.ts`.
- Produces (`features-db.ts`): `featuresDb.list(): Promise<{ key: string; enabled: boolean; updatedAt: string | null; updatedBy: string | null }[]>` (throws on a database error) and `featuresDb.set(key: FeatureKey, enabled: boolean, userId: string): Promise<void>` (upsert; throws on error).
- Produces (`feature-service.ts`): `featureFlags.getAll(): Promise<FeatureFlags>` (5 second cache; on any error logs once per failure and returns all true without caching the failure for more than 5 seconds), `featureFlags.isEnabled(key: FeatureKey): Promise<boolean>`, `featureFlags.set(key, enabled, userId): Promise<void>` (clears the cache), `featureOffResponse(c: Context): Response` (the 403 envelope with `code: "feature_disabled"`).
- Produces (`feature-routes.ts`): `featureRoutes(getCurrentUser)`: `GET /features` (public) returns `{ success: true, data: FeatureFlags }`; `GET /admin/features` (saas_admin only) returns `{ success: true, data: { key, label, description, group, enabled, updatedAt, updatedBy }[] }` in catalogue order; `PUT /admin/features/:key` (saas_admin only) with body `{ enabled: boolean }` returns the updated entry; 401 anonymous, 403 non-admin, 400 for an unknown key or a non-boolean `enabled`, 500 with the message when the database write fails.

- [ ] **Step 1: Write failing tests.** `features-db.test.ts` (mock `./db`'s client like `tests/scenes-db.test.ts`): `list` returns rows and maps columns; `list` throws on a database error; `set` upserts `{ key, enabled, updated_by }` and throws on error. `feature-api.test.ts` (mock `feature-service` and `auth-service`): `GET /features` is public and returns the map; `GET /admin/features` 401/403/200 and catalogue order; `PUT` 401 anonymous, 403 merchant and customer, 400 unknown key, 400 `enabled: "yes"`, 200 for admin calls `featureFlags.set` with the admin's id, 500 when `set` rejects. Add a service test (mock `featuresDb`): rows turn flags off; a failing `list` returns all true; two calls within 5 seconds read the database once (use fake timers); `set` clears the cache so the next read hits the database.
- [ ] **Step 2: Run to verify FAIL, implement the files and mount `featureRoutes` in `app.ts` next to the other `app.route` calls, run to verify PASS.**
- [ ] **Step 3: `pnpm vitest run && pnpm tsc --noEmit && pnpm eslint src tests`.** Expected: all pass.
- [ ] **Step 4: Stop and ask the user to run the SQL file in the Supabase SQL editor.** Then verify live: log in as admin, `PUT /api/admin/features/wishlist` with `{ "enabled": false }`, read `GET /api/features` within a few seconds, switch it back on; as a customer `PUT` returns 403. Expected: as described.
- [ ] **Step 5: Commit.**

### Task 3: Server enforcement

**Files:**
- Modify: `src/server/app.ts` (create, generate, retry, thumbnail, wishlist routes), `src/server/asset-routes.ts` (`GET /assets`), `src/server/scene-routes.ts` (GET and PUT)
- Test: `tests/scene-api.test.ts`, `tests/assets-api.test.ts` (extend; mock `@/server/feature-service`)

**Interfaces:**
- Consumes: Task 2 (`featureFlags.isEnabled`, `featureFlags.getAll`, `featureOffResponse`).
- Produces: the server rules in Global Constraints. In `scene-routes.ts`, `GET /products/:id/scene` reads the flags once; optional user detection uses the same `getCurrentUser`; `PUT` keeps `previous.room` when `room_builder` is off and rejects with `featureOffResponse` when `scene_editor` is off.

- [ ] **Step 1: Write failing tests.** Scene API: with `scene_editor` off, PUT returns 403 with `code: "feature_disabled"` and `upsert` is not called; with `room_builder` off, GET omits `room`, and a PUT whose body carries a different room stores the previous room (`upsert` called with the previous room) while a first save without any previous room stores none; with `customer_scene_view` off, GET as anonymous and as customer returns the empty scene, GET as the owner and as a saas_admin returns the real scene while `scene_editor` is on, and returns the empty scene for the owner when `scene_editor` is also off; with all flags on nothing changes (existing tests keep passing with the mocked service returning all true). Assets API: `GET /assets` returns 403 `feature_disabled` when `scene_editor` is off.
- [ ] **Step 2: Run to verify FAIL, implement the guards in the three route files and in `app.ts` (create product, generate, retry, thumbnail, wishlist toggle and list), run to verify PASS.**
- [ ] **Step 3: `pnpm vitest run && pnpm tsc --noEmit && pnpm eslint src tests`.** Expected: all pass.
- [ ] **Step 4: Live check after the SQL ran:** turn each of `model_generation`, `capture_thumbnails`, `wishlist` off through the admin endpoint and confirm the matching direct API calls (generate on an existing product, thumbnail POST, wishlist toggle) return 403 `feature_disabled` and work again after turning them on; then turn all back on.
- [ ] **Step 5: Commit.**

### Task 4: Client provider and Features page

**Files:**
- Create: `src/lib/features/features-context.tsx`, `src/app/admin/features/page.tsx`
- Modify: `src/app/layout.tsx` (wrap with the provider, following how `AuthProvider` is mounted), `src/components/layout/dashboard-layout.tsx` (Administration item "Features", icon `ToggleRight` from lucide-react, admin only)

**Interfaces:**
- Produces: `FeaturesProvider`, `useFeatures(): { flags: FeatureFlags; loaded: boolean }`, `useFeature(key: FeatureKey): boolean` (true until loaded and when the request fails).
- Produces: `/admin/features`: admin guard like `/admin/assets`; lists the catalogue grouped by `group`, each row with label, description, a switch (role `switch`, `aria-checked`) and "Last changed by/at" when known; toggling calls `PUT /api/admin/features/:key`, updates the row on success and shows the server's error text (banner) on failure; the page also refreshes `FeaturesProvider` state after a successful change so the admin's own UI follows.

- [ ] **Step 1: Read the relevant guide in `node_modules/next/dist/docs/` (client components) and `src/app/admin/assets/page.tsx` for the guard and styling conventions, then implement the provider, hook, page and nav entry.**
- [ ] **Step 2: `pnpm tsc --noEmit && pnpm eslint src tests && pnpm vitest run`.** Expected: clean and all pass.
- [ ] **Step 3: Commit.**

### Task 5: UI gating

**Files:**
- Modify: `src/components/layout/dashboard-layout.tsx` (hide "Create 3D Model" and the header "Create" actions when `model_generation` is off), `src/app/create/page.tsx` (show a notice instead of the form when off), `src/components/studio/model-viewer.tsx` (new optional props `showBackdropMenu?: boolean` and `showCapture?: boolean`, both default true), `src/app/viewer/[id]/page.tsx`, `src/app/products/page.tsx`, `src/app/store/[merchantId]/page.tsx`, `src/components/studio/scene-editor/scene-editor.tsx` (hide the Room rail entry when `room_builder` is off; skip `RoomRenderer` application and the room in the save body when off), `src/components/studio/scene/scene-view.ts` is unchanged (the server already omits the room)

**Interfaces:**
- Consumes: Task 4 hooks.
- Behaviour: `model_generation` off hides nav and header entries and the Generate/Generate Again/retry buttons on the viewer, and `/create` shows "3D model generation is turned off by the administrator."; `scene_editor` off means the page treats the user as a non-editor (`canEditScene` false) and no editor overlay mounts; `customer_scene_view` off needs no UI change (the server returns the empty scene); `room_builder` off hides the Room entry and panel in the editor and the editor sends no `room`; `capture_thumbnails` off passes `showCapture={false}` (no Capture button), `onUseAsThumbnail` undefined and `onFirstFrame` undefined; `backdrop_menu` off passes `showBackdropMenu={false}`; `wishlist` off hides every heart button (products list, store, viewer) and skips the wishlist fetch; `whatsapp_contact` off hides every WhatsApp button (products list, store, viewer).

- [ ] **Step 1: Implement the gating with `useFeature`.**
- [ ] **Step 2: `pnpm tsc --noEmit && pnpm eslint src tests && pnpm vitest run`.** Expected: clean and all pass.
- [ ] **Step 3: Commit.**

### Task 6: Verification and clean-up

**Files:** none (verification only, plus fixes it surfaces).

- [ ] **Step 1: Browser verification as admin:** open `/admin/features`, see the eight switches, turn `wishlist` off and see hearts disappear on the products list, store and viewer after a reload (and turn it on again); do the same for `whatsapp_contact` and `backdrop_menu`; turn `capture_thumbnails` off and confirm no Capture button; turn `model_generation` off and confirm the Create 3D Model entry and `/create` form are gone and direct generate calls return 403; turn `scene_editor` off and confirm the editor disappears while a saved scene still shows for customers; turn `customer_scene_view` off and confirm customers see the plain product while the owner and admin still edit (after turning `scene_editor` back on); turn `room_builder` off and confirm the Room entry and rooms disappear and a scene save keeps the stored room (re-enable and see the room back).
- [ ] **Step 2: As customer and merchant:** confirm the Features page and nav entry are not available and `PUT /api/admin/features/wishlist` returns 403.
- [ ] **Step 3: Failure check:** confirm the app works normally with the table unreachable (temporarily point the service at a failing client in a test, or rely on the pre-SQL run), and that all flags start enabled.
- [ ] **Step 4: Phone-width check** of the Features page in a 400 px same-origin iframe.
- [ ] **Step 5: Commit (amend), restore every flag to enabled, remove all test data, and list the remaining steps (merge the stacked branches).**
