# Room Scene Editor (Phase 2: Merchant) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A merchant (or admin) opens their product's 3D viewer, drags room assets from a left icon rail into the scene, moves, rotates, scales and deletes them, and saves the scene with the product.

**Architecture:** Pure, unit-tested modules in `src/lib/scenes/` define the scene JSON, its validation, the scale maths and the save-time access rules. A `product_scenes` table and two endpoints persist and resolve scenes (the GET is public so Phase 4 customers can use it). The editor is a separate set of components under `src/components/studio/scene-editor/` that attaches to the existing `ModelViewer` through a small `onReady` / `renderOverlay` hook, so `model-viewer.tsx` does not absorb the editor.

**Tech Stack:** Next.js (App Router), Hono, Supabase, three.js (`TransformControls`, `GLTFLoader`, `DRACOLoader`), zod, vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-room-assets-studio-design.md` (Phase 2 of its phase list). Phase 1 is on `main` (`src/lib/assets/*`, `src/lib/supabase/assets-db.ts`, `src/server/asset-routes.ts`). Phase 3 (room: wall colour and floor) and Phase 4 (customer view) are separate plans.

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code (AGENTS.md).
- Scene JSON is `{ schemaVersion: 1, backdrop: BackdropMode, items: SceneItem[] }`. `SceneItem` is `{ id: string; assetId: string; versionId: string; x: number; z: number; rotationY: number; scale: number }`. `x` and `z` are centimetres from the product's floor-centre origin; `rotationY` is radians; `scale` is a multiplier on the asset's real size (1.0 = real size).
- At most 20 items per scene. `scale` is limited to 0.2 through 5. `x` and `z` are limited to 500 cm in magnitude. All numbers must be finite.
- Items stay on the floor: they move in X/Z and rotate around Y only; their bottom sits on y = 0.
- Real scale: the product is normalised so its largest side is 1.05 world units (existing `model-viewer.tsx` behaviour). One centimetre is therefore `1.05 / max(widthMm, depthMm, heightMm) * 10` world units. A product with a missing or zero dimension uses the default chair size 85 x 75 x 82 cm. An asset's model is scaled so its largest bounding-box side equals its stored real size in cm (largest of width, depth, height), then multiplied by the item's `scale`.
- Access is enforced on the server when saving: a scene may keep items that were already saved, but adding a new item whose asset the merchant cannot use (`canUseAsset`) is rejected. Removing items is always allowed. Saving is never blocked by a previously saved item that has since become locked.
- Wall-placement assets (`placement: "wall"`) are listed in the panel but cannot be placed (disabled with a short note); the server rejects a new item that references one.
- A saved item references an asset version (`versionId`), so editing an asset never changes an existing scene. The GET endpoint resolves each item to its version's `glbUrl` and size.
- Only the product's owning merchant or a saas_admin may save a scene. Anyone may read it.
- A product with no saved scene looks exactly as it does today.
- Mobile budget: 20 items maximum; assets are already limited to 2 MB each. Load the product first, then the items.
- Drag-and-drop must have a tap/click fallback (adding the asset at the floor centre) so touch devices and keyboard users can place items.
- Tailwind: scale values only, no arbitrary px. No filler comments (global CLAUDE.md).
- Git: do not work on `main`. Ask the user to approve a new branch (suggested `feature/room-scene-editor`). One branch, one commit: stage and `git commit --amend` after the first commit; message format `feat: room-scene-editor` with a numbered cumulative body; no Co-Authored-By line; never `--no-verify`; no force-push without asking.
- The agent cannot run SQL on Supabase. Task 4 produces a SQL file; the user runs it and confirms before the live checks.

## Review Focus

- Saving 21 items returns 400 and stores nothing.
- A scene item whose `versionId` does not exist returns 400.
- A merchant who does not own the product gets 403 on save; an anonymous caller gets 401.
- Saving an unchanged scene that contains an item whose asset the merchant has since lost access to succeeds; adding a second copy of that locked asset is rejected.
- Saving an empty items list succeeds, and GET then returns the empty scene (the product looks as it does today).
- `NaN`, `Infinity`, `scale: 0` or `x: 100000` in an item returns 400.
- An asset GLB that fails to load in the editor shows a placeholder box for that item and the editor keeps working; saving still works.
- On a touch device with no drag-and-drop, tapping an asset places it at the floor centre.
- Deleting the last remaining item leaves the Save button enabled so the empty scene can be saved.

---

### Task 1: Scene types, schema and scale maths

**Files:**
- Create: `src/lib/scenes/types.ts`, `src/lib/scenes/schema.ts`, `src/lib/scenes/scale.ts`
- Test: `tests/scenes.test.ts`

**Interfaces:**
- Produces (`types.ts`): `SceneItem`, `SceneData { schemaVersion: 1; backdrop: BackdropMode; items: SceneItem[] }`, `EMPTY_SCENE: SceneData` (backdrop `"auto"`, no items), `MAX_SCENE_ITEMS = 20`, `SCALE_RANGE = { min: 0.2, max: 5 }`, `MAX_OFFSET_CM = 500`, `ResolvedSceneItem extends SceneItem { glbUrl: string; widthCm: number; depthCm: number; heightCm: number; placement: AssetPlacement }`, `ResolvedScene { schemaVersion: 1; backdrop: BackdropMode; items: ResolvedSceneItem[] }`. `BackdropMode` is imported from `src/components/studio/backdrop.ts`.
- Produces (`schema.ts`): `sceneItemSchema`, `sceneSchema` (zod; finite numbers only, ranges above, at most 20 items, unique item ids, backdrop one of `auto|studio|white|transparent`).
- Produces (`scale.ts`): `DEFAULT_PRODUCT_CM = { width: 85, depth: 75, height: 82 }`; `worldUnitsPerCm(product: { widthMm?: number | null; depthMm?: number | null; heightMm?: number | null }): number`; `assetBaseScale(args: { worldPerCm: number; assetMaxCm: number; modelMaxSize: number }): number` (the factor that makes the model's largest side equal the asset's real size in world units).

- [ ] **Step 1: Write failing tests in `tests/scenes.test.ts`.** Assertions: `sceneSchema` accepts `EMPTY_SCENE` and a scene with 20 valid items; rejects 21 items; rejects duplicate item ids; rejects each of `scale: 0`, `scale: 5.01`, `x: 501`, `z: -501`, `x: NaN`, `rotationY: Infinity`; `worldUnitsPerCm({ widthMm: 850, depthMm: 750, heightMm: 820 })` equals `1.05 / 85` (use `toBeCloseTo`); a product with `heightMm: 0` or `null` dimensions falls back to the default chair and equals `1.05 / 85`; a product taller than wide uses its largest side (`{ widthMm: 500, depthMm: 500, heightMm: 2000 }` gives `1.05 / 200`); `assetBaseScale({ worldPerCm: 0.01, assetMaxCm: 120, modelMaxSize: 2 })` equals `0.6`; `assetBaseScale` with `modelMaxSize: 0` returns 1 (no division by zero).
- [ ] **Step 2: Run** `pnpm vitest run tests/scenes.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement the three modules with the signatures above.**
- [ ] **Step 4: Run** `pnpm vitest run`. Expected: all pass.
- [ ] **Step 5: Commit** (branch and amend rules in Global Constraints).

### Task 2: Save-time scene rules

**Files:**
- Create: `src/lib/scenes/rules.ts`
- Test: `tests/scenes.test.ts` (extend)

**Interfaces:**
- Consumes: `SceneData`, `SceneItem` (Task 1); `canUseAsset` from `src/lib/assets/access.ts`; `RoomAsset`, `AssetVersion`, `MerchantPlan` from `src/lib/assets/types.ts`.
- Produces: `validateSceneSave(args: { next: SceneData; previous: SceneData | null; versions: Map<string, { version: AssetVersion; asset: RoomAsset }>; merchant: { id: string; plan?: MerchantPlan | null } }): { ok: true } | { ok: false; error: string; status: 400 | 403 }`. Rules in order: every item's `versionId` must exist in `versions` and its `assetId` must match that version's asset (else 400 "Unknown asset"); a new item (id not in `previous`) must not reference a `wall` asset (400); a new item must reference an asset `canUseAsset` allows for this merchant (403 naming the asset); items already in `previous` are never re-checked.

- [ ] **Step 1: Write failing tests** for each rule: unknown versionId gives 400; assetId that does not match the version's asset gives 400; a new wall item gives 400; a new item using a `pro` asset for a free merchant gives 403; the same item already present in `previous` passes; a second new copy (new id) of a locked asset gives 403; a free asset passes; removing every item (empty `next`) passes even when `previous` held locked items; `previous: null` treats every item as new.
- [ ] **Step 2: Run to verify FAIL, implement `validateSceneSave`, run to verify PASS.**
- [ ] **Step 3: Commit.**

### Task 3: Scene repository and SQL

**Files:**
- Create: `docs/superpowers/sql/2026-10-25-product-scenes.sql`, `src/lib/supabase/scenes-db.ts`
- Modify: `src/lib/supabase/assets-db.ts` (add `getVersionsWithAssets`), `src/lib/db/schema.ts` (mirror the table)

**Interfaces:**
- Produces SQL: `create table if not exists product_scenes (product_id text primary key references products(id) on delete cascade, scene jsonb not null, updated_by text, updated_at timestamptz not null default now())`. If the foreign key fails because `products.id` has a different type, drop the `references` clause and tell the user.
- Produces (`scenes-db.ts`): `scenesDb.get(productId: string): Promise<SceneData | null>`; `scenesDb.upsert(productId: string, scene: SceneData, userId: string): Promise<void>` (throws on database error).
- Produces on `assetsDb`: `getVersionsWithAssets(versionIds: string[]): Promise<Map<string, { version: AssetVersion; asset: RoomAsset }>>` (empty input returns an empty map; unknown ids are absent from the map; returns the version row plus its parent asset even if hidden).

- [ ] **Step 1: Write the SQL file, the drizzle mirror, `scenesDb` and `getVersionsWithAssets`.** `scenesDb.get` re-validates stored JSON with `sceneSchema` and returns `null` for an invalid or missing row.
- [ ] **Step 2: `pnpm tsc --noEmit && pnpm eslint src`.** Expected: clean.
- [ ] **Step 3: Stop and ask the user to run the SQL file in the Supabase SQL editor.** Then verify live with a temporary vitest file (deleted afterwards, loading `.env` itself): upsert a scene for an existing product, read it back and compare, upsert again (replace), read `getVersionsWithAssets` for one real version id and one unknown id, then delete the row. Expected: all assertions hold.
- [ ] **Step 4: Commit.**

### Task 4: Scene API

**Files:**
- Create: `src/server/scene-routes.ts`
- Modify: `src/server/app.ts` (mount next to `assetRoutes`)
- Test: `tests/scene-api.test.ts`

**Interfaces:**
- Consumes: Tasks 1 to 3, `getCurrentUser`, `supabaseDb.getProductById` / `inMemoryStore.getById` (existing product lookup used by `GET /products/:id`).
- Produces: `sceneRoutes(getCurrentUser: (c: Context) => Promise<AppUser | null>)`, a Hono app mounted at `/`.
  - `GET /products/:id/scene` (public): 404 when the product does not exist; otherwise `{ success: true, data: ResolvedScene }`. A product with no saved scene returns `{ schemaVersion: 1, backdrop: "auto", items: [] }`. Items whose version row no longer exists are dropped from the response.
  - `PUT /products/:id/scene`: 401 anonymous; 403 customers and merchants who do not own the product (saas_admin always allowed); 404 unknown product; body parsed with `sceneSchema` (400 on failure); `validateSceneSave` against the previous scene and `getVersionsWithAssets` (status and message from the rule); on success `scenesDb.upsert` and return the resolved scene. A database failure returns 500 with a message.
  - All responses use the existing `{ success, data | error }` shape.

- [ ] **Step 1: Write failing route tests in `tests/scene-api.test.ts`** (same `app.request` + `vi.mock` pattern as `tests/assets-api.test.ts`; mock `scenes-db`, `assets-db`, `auth-service`, `@/lib/supabase/db` and the in-memory store lookup). Cases: GET unknown product 404; GET with no saved scene returns the empty scene; GET drops an item whose version is missing and returns `glbUrl` and sizes for a present one; PUT anonymous 401; PUT customer 403; PUT merchant who is not the owner 403; PUT by the owner with 21 items 400 and `upsert` not called; PUT with `scale: 0` 400; PUT with an unknown versionId 400; PUT of a new item using a locked asset 403; PUT of an unchanged scene with an already-saved locked item 200; PUT with an empty items list 200 and `upsert` called with empty items; PUT by saas_admin on another merchant's product 200.
- [ ] **Step 2: Run to verify FAIL, implement the routes, mount them in `app.ts`, run to verify PASS.**
- [ ] **Step 3: `pnpm vitest run && pnpm tsc --noEmit && pnpm eslint src tests`.** Expected: all pass.
- [ ] **Step 4: Live check against the dev server** after the SQL ran: log in as the demo merchant and admin (`/api/auth/login`), PUT a one-item scene using a real asset version, GET it back resolved, PUT 21 items and see 400, then restore the product's scene to empty.
- [ ] **Step 5: Commit.**

### Task 5: Viewer integration hook

**Files:**
- Modify: `src/components/studio/model-viewer.tsx`
- Create: `src/components/studio/viewer-context.ts`

**Interfaces:**
- Produces (`viewer-context.ts`): `ViewerContext { scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; controls: OrbitControls; container: HTMLElement; worldPerCm: number }`.
- Produces on `ModelViewerProps` (all optional): `initialBackdrop?: BackdropMode`; `onBackdropChange?: (mode: BackdropMode) => void`; `onReady?: (context: ViewerContext) => void | (() => void)` (called once the product model has been added to the scene, again whenever the viewer rebuilds for a new `modelUrl`; the returned cleanup runs before the next call and on unmount); `renderOverlay?: (context: ViewerContext | null) => React.ReactNode` (rendered inside the viewer container above the canvas, receiving `null` until ready); `bgMode` initial state comes from `initialBackdrop ?? "auto"`.

- [ ] **Step 1: Implement the props and the `ViewerContext` creation in the effect that builds the scene (`worldPerCm` from `worldUnitsPerCm` in `src/lib/scenes/scale.ts`).** Call `onBackdropChange` whenever the backdrop menu changes the mode. Keep every existing behaviour (capture, thumbnail, autorotate) unchanged.
- [ ] **Step 2: Verify no regression.** `pnpm tsc --noEmit && pnpm eslint src && pnpm vitest run`, then open a product viewer in the browser: model loads, backdrop menu, Capture and "Use as thumbnail" still work, and the browser console shows no new errors.
- [ ] **Step 3: Commit.**

### Task 6: Scene editor core (three.js)

**Files:**
- Create: `src/components/studio/scene-editor/scene-controller.ts`, `src/components/studio/scene-editor/convert.ts`
- Test: `tests/scene-convert.test.ts`

**Interfaces:**
- Consumes: `ViewerContext` (Task 5), scale maths (Task 1), `ResolvedSceneItem` and `SceneItem` (Task 1).
- Produces (`convert.ts`, pure and tested): `itemToTransform(item: SceneItem, worldPerCm: number): { position: [number, number, number]; rotationY: number }` (world position is `x * worldPerCm`, `0`, `z * worldPerCm`); `transformToItemFields(position: { x: number; z: number }, rotationY: number, scale: number, worldPerCm: number): Pick<SceneItem, "x" | "z" | "rotationY" | "scale">` (inverse; values clamped to the Task 1 ranges and rotation normalised to the range -PI to PI); `clampScale(value: number): number`.
- Produces (`scene-controller.ts`): `class SceneController` constructed with `(context: ViewerContext, callbacks: { onChange: (state: ControllerState) => void })`, where `ControllerState = { selectedId: string | null; itemCount: number; dirty: boolean }`. Methods: `load(items: ResolvedSceneItem[]): Promise<void>` (replaces current items, marks clean); `addAsset(asset: { assetId: string; versionId: string; glbUrl: string; widthCm: number; depthCm: number; heightCm: number }, at?: { x: number; z: number }): string | null` (returns the new item id, or `null` when already at 20 items; default position is the floor centre); `addAssetAtPointer(asset, clientX: number, clientY: number): string | null` (raycasts onto the y = 0 plane); `select(id: string | null)`; `setMode(mode: "translate" | "rotate" | "scale")`; `removeSelected()`; `serialize(): SceneItem[]`; `markClean()`; `dispose()`. Behaviour: models load with `GLTFLoader` and `DRACOLoader` (decoder path `/draco/`), are scaled with `assetBaseScale` times the item's `scale`, sit with their bounding-box bottom at y = 0, and are centred on their own bounding box in X/Z. `TransformControls` is attached to the selected item with Y locked (translate only along X/Z, rotate only around Y, uniform scale), `controls.enabled` (OrbitControls) is false while dragging, and every change calls `onChange` with `dirty: true`. A GLB that fails to load is replaced by a placeholder box of the asset's real size so the item stays selectable and savable. `dispose()` removes everything the controller added and disposes geometries, materials and textures.

- [ ] **Step 1: Write failing tests in `tests/scene-convert.test.ts`:** `itemToTransform` and `transformToItemFields` round-trip a representative item within 1e-6; `transformToItemFields` clamps `scale` to 0.2 and 5, clamps `x` to 500 and `z` to -500, and normalises `rotationY` of `3 * Math.PI` to a value equal to `Math.PI` or `-Math.PI` within 1e-6; `clampScale(NaN)` returns 1.
- [ ] **Step 2: Run to verify FAIL, implement `convert.ts`, run to verify PASS.**
- [ ] **Step 3: Implement `SceneController`** per the interface (no unit test for the three.js wiring; it is verified in the browser in Task 8).
- [ ] **Step 4: `pnpm tsc --noEmit && pnpm eslint src && pnpm vitest run`.** Expected: clean and all pass.
- [ ] **Step 5: Commit.**

### Task 7: Asset rail and panel UI

**Files:**
- Create: `src/components/studio/scene-editor/asset-rail.tsx`, `src/components/studio/scene-editor/asset-panel.tsx`, `src/components/studio/scene-editor/use-merchant-assets.ts`

**Interfaces:**
- Consumes: `GET /api/assets` (Phase 1; returns `MerchantAssetView[]`), `GET /api/admin/asset-categories` is admin-only, so the merchant UI needs categories another way. Produces: extend `GET /assets` in `src/server/asset-routes.ts` to return `{ success: true, data: MerchantAssetView[], categories: AssetCategory[] }` (existing consumers read only `data`), with a route test for the new field.
- Produces (`use-merchant-assets.ts`): `useMerchantAssets(): { assets: MerchantAssetView[]; categories: AssetCategory[]; loading: boolean; error: string | null }`.
- Produces (`asset-rail.tsx`): `AssetRail` props `{ categories: AssetCategory[]; activeCategoryId: string | null; onSelectCategory: (id: string | null) => void }`: a slim vertical rail of category icons (reuse `CategoryIcon` from `src/components/assets/category-icon.tsx`), each with an accessible name and tooltip.
- Produces (`asset-panel.tsx`): `AssetPanel` props `{ assets: MerchantAssetView[]; categoryName: string; search: string; onSearch: (value: string) => void; atLimit: boolean; onAdd: (asset: MerchantAssetView) => void; onDragStartAsset: (asset: MerchantAssetView, event: React.DragEvent) => void }`: a floating panel with a search field and a two-column grid of preview tiles. Locked tiles show a lock marker and are not draggable or addable; wall-placement tiles are disabled with the note "Wall items are coming soon"; when `atLimit` every tile is disabled with the note "Scene is full (20 items)"; each usable tile adds the asset on click or tap (the drag-free fallback) and is draggable.

- [ ] **Step 1: Write the failing route test, extend `GET /assets` to return `categories`, run to verify PASS.**
- [ ] **Step 2: Implement the hook and the two components, styled to match the existing admin/asset components (Tailwind scale values only).**
- [ ] **Step 3: `pnpm tsc --noEmit && pnpm eslint src && pnpm vitest run`.** Expected: clean and all pass.
- [ ] **Step 4: Commit.**

### Task 8: Editor assembly, save and viewer page wiring

**Files:**
- Create: `src/components/studio/scene-editor/scene-editor.tsx`, `src/components/studio/scene-editor/selection-toolbar.tsx`
- Modify: `src/app/viewer/[id]/page.tsx`

**Interfaces:**
- Consumes: Tasks 4 to 7.
- Produces: `SceneEditor` props `{ productId: string; context: ViewerContext | null; backdrop: BackdropMode }`. It loads `GET /api/products/:id/scene`, passes the items to `SceneController.load`, renders `AssetRail` plus `AssetPanel` on the left of the viewer (rail always visible, panel opened by tapping a category and closable), `SelectionToolbar` (Move, Rotate, Scale, Delete; shown when an item is selected; keyboard: `Delete` removes, `Escape` deselects), an "n/20 items" counter, and a **Save scene** button (enabled whenever `dirty`, including after deleting the last item) that sends `PUT /api/products/:id/scene` with `{ schemaVersion: 1, backdrop, items: controller.serialize() }` and shows success or the server's error text next to the button. Dropping an asset on the canvas calls `addAssetAtPointer`. The editor tells the user when items belong to assets they no longer have access to (lock marker on those items' tile in the panel is not required; a one-line note under the counter is enough).
- `viewer/[id]/page.tsx` renders the editor through `ModelViewer`'s `renderOverlay` and `onReady`, passes `initialBackdrop` from the loaded scene and `onBackdropChange` to track the current backdrop for saving, and shows the editor only when the signed-in user is a merchant who owns the product or a saas_admin (customers and anonymous visitors see the viewer exactly as today).

- [ ] **Step 1: Implement the components and the page wiring.**
- [ ] **Step 2: `pnpm tsc --noEmit && pnpm eslint src tests && pnpm vitest run`.** Expected: clean and all pass.
- [ ] **Step 3: Browser verification as the demo merchant** (upload two small test assets through `/admin/assets` first and remove them afterwards): open a product viewer; the rail and panel appear; drag an asset onto the floor; tap another asset to add it at the centre; select, move, rotate, scale and delete items; the counter reads correctly; a Pro asset for a Free merchant shows locked and cannot be added; add 20 items and see every tile disabled; Save, reload and see the same scene and backdrop; delete every item, Save, reload and see the plain product; open the same product as the customer persona and see no editor and no items; check a narrow (phone-width) window: rail and panel remain usable and tap-to-add works; capture/thumbnail still work.
- [ ] **Step 4: Commit (amend), then clean up all test data (scene rows, test assets, storage files) and summarise Phase 3 and Phase 4 as the next plans.**
