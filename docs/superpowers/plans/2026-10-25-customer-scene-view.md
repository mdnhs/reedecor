# Customer Scene View (Phase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anyone who opens a product's 3D viewer and is not editing it (customers, merchants who do not own the product, anonymous visitors) sees the merchant's saved scene read-only: placed assets, room (walls and floor) and backdrop. The first-frame thumbnail and Capture show that scene.

**Architecture:** The item loading, scaling and disposal code inside the editor's `SceneController` is extracted into a shared `ItemLoader`, which the controller (editing) and a new read-only `SceneView` (viewing, with the existing `RoomRenderer`) both use. The viewer page fetches the public scene for everyone before mounting the viewer, then attaches either the editor (owner or admin) or the read-only view. The auto-thumbnail waits until the scene has finished loading.

**Tech Stack:** Next.js (App Router), three.js, existing Hono scene API (no change), vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-room-assets-studio-design.md` (Phase 4: "Customer view and thumbnail. Product viewer loads and shows the saved scene read-only; auto/first thumbnail and Capture use the scene"). Builds on Phases 1 to 3, all on `main`.

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code (AGENTS.md).
- Read-only means read-only: the customer view has no `TransformControls`, no selection, no pointer handlers on items, no drag-and-drop listeners, and never calls the save endpoint.
- A product with no saved scene (or an empty one with no room) looks and behaves exactly as it does today for customers.
- If the scene request fails, customers still see the plain product viewer (no error wall); owners and admins see the existing "editing is off" notice.
- Items render from the public scene GET, which resolves each item's asset version, so hidden assets and assets the merchant has since lost access to still render for customers.
- The scene is fetched once per page load by the viewer page for everyone and passed down; the viewer is mounted only after that request settles (success or failure), so the saved backdrop is the initial backdrop.
- The first-frame auto thumbnail (taken only when a product has no thumbnail) is captured only after the scene's items have finished loading (a failed asset counts as loaded because it shows a placeholder), so it includes the scene. Capture already renders the canvas.
- Behaviour of the editor (add, select, move, rotate, scale, delete, save, dirty tracking) must not change; the refactor in Task 1 is behaviour-preserving.
- 20 items maximum and 2 MB assets (Phase 1 and 2 limits) are the mobile budget; no new limits.
- Tailwind: scale values only, no arbitrary px. No filler comments (global CLAUDE.md).
- Git: do not work on `main`. Branch `feature/customer-scene-view` (the user's "then phase 4" follows their earlier approvals of one branch per phase). One branch, one commit: stage and `git commit --amend` after the first commit; message format `feat: customer-scene-view` with a numbered cumulative body; no Co-Authored-By line; never `--no-verify`; no force-push without asking.
- No database or SQL change in this phase.

## Review Focus

- A customer opening a product with a saved scene sees the same items, room and backdrop the owner saved, and cannot select, move or delete anything.
- A product with no scene row looks identical to before for customers, with no visible extra delay beyond the one scene request.
- A scene request failure (network error or 500) leaves customers with a working plain viewer.
- Editor behaviour is unchanged after the extraction (add by click and drag, select by click, Move/Rotate/Scale/Delete, Save, reload restores).
- The auto thumbnail for a product without a thumbnail includes the scene's items and room, and is not taken before the items appear.
- A scene whose asset fails to load still lets the page finish loading and the thumbnail be captured (placeholder box).
- Unmounting or rebuilding the viewer leaves no extra geometries, materials or textures alive (disposal covers items, placeholders, the model cache and the room).
- Orbit, zoom, auto-rotate, Backdrop menu and Capture still work for customers with the scene present.

---

### Task 1: Extract the shared item loader

**Files:**
- Create: `src/components/studio/scene/item-loader.ts`
- Modify: `src/components/studio/scene-editor/scene-controller.ts`

**Interfaces:**
- Produces (`item-loader.ts`): `PlaceableAsset { assetId; versionId; glbUrl; widthCm; depthCm; heightCm }` (moved here; `scene-controller.ts` re-exports it so existing imports keep working); `class ItemLoader` constructed with `(worldPerCm: number)` with `createGroup(id: string, item: SceneItem): THREE.Group` (synchronous: group with `userData.itemId = id`, position from `itemToTransform`, `rotation.y`, uniform scale from `clampScale(item.scale)`), `fill(group: THREE.Group, asset: PlaceableAsset, isActive: () => boolean): Promise<void>` (loads and caches the GLB with `GLTFLoader` and `DRACOLoader` at `/draco/`, clones it, scales it with `assetBaseScale`, centres it on its bounding box in X and Z with its bottom at y = 0, enables cast and receive shadows, falls back to a placeholder box of the asset's real size when loading fails, and adds the content to the group only if `isActive()` is still true afterwards), `dispose(): void` (disposes cached models and the Draco loader; rejected cache entries are ignored); and `disposeGroup(group: THREE.Group): void` (disposes placeholder meshes' geometry and material in the group; loaded models are shared with the cache and are not disposed here).
- Consumes: `assetBaseScale` (`src/lib/scenes/scale.ts`), `clampScale`/`itemToTransform` (`src/components/studio/scene-editor/convert.ts`).
- `SceneController` keeps selection, transform controls, records, dirty tracking and serialization, and delegates group creation, model loading, fitting, placeholders and cache disposal to `ItemLoader`.

- [ ] **Step 1: Implement `ItemLoader`, then change `SceneController` to use it (delete its private `loadModel`, `fitModel`, `placeholder`, model cache, loader and Draco members; `removeRecord` calls `disposeGroup`; `dispose` calls `loader.dispose()`).**
- [ ] **Step 2: `pnpm tsc --noEmit && pnpm eslint src && pnpm vitest run`.** Expected: clean and all pass.
- [ ] **Step 3: Verify the editor in the browser as the product owner (create a throwaway category and two small test assets through the admin API first; remove them afterwards):** add an asset by click and by drag, select by click, Move/Rotate/Scale/Delete, Save, reload and see the same scene. Expected: identical to before the refactor and no console errors.
- [ ] **Step 4: Commit** (branch and amend rules in Global Constraints).

### Task 2: Read-only scene view

**Files:**
- Create: `src/components/studio/scene/scene-view.ts`

**Interfaces:**
- Consumes: `ItemLoader`, `disposeGroup` (Task 1), `RoomRenderer` (`src/components/studio/room/room-renderer.ts`), `ViewerContext`, `ResolvedScene`, `MAX_SCENE_ITEMS`.
- Produces: `class SceneView` constructed with `(context: ViewerContext)`; `load(scene: ResolvedScene): Promise<void>` (applies `scene.room` through a `RoomRenderer`, creates and fills a group for up to 20 items, resolves when every item has finished loading even if some fell back to placeholders, and returns early without touching the scene if the view was disposed meanwhile); `dispose(): void` (removes every group it added and disposes them, the room renderer and the loader; idempotent). It adds no listeners and no controls.

- [ ] **Step 1: Implement `SceneView`.**
- [ ] **Step 2: `pnpm tsc --noEmit && pnpm eslint src`.** Expected: clean. (Rendering is verified in the browser in Task 4.)
- [ ] **Step 3: Commit.**

### Task 3: Page wiring and thumbnail gating

**Files:**
- Modify: `src/app/viewer/[id]/page.tsx`, `src/components/studio/model-viewer.tsx`, `src/components/studio/scene-editor/scene-editor.tsx`

**Interfaces:**
- Consumes: Tasks 1 and 2, the existing public `GET /api/products/:id/scene`.
- Produces on `ModelViewerProps`: `captureReady?: boolean` (default `true`); the first-frame capture effect waits for `captureReady` as well as the model being loaded.
- Produces on `SceneEditorProps`: `onLoaded?: () => void`, called once after the controller's initial `load` has settled (also when it fails).
- Page behaviour: for every viewer of a completed product the page fetches the scene (not only editors); while that request is pending it shows the existing skeleton; on success it stores the scene and the saved backdrop, on failure it records an error and continues. Editors (`canEditScene`) keep the editor overlay (if the load failed, the existing notice and no overlay). Everyone else gets `onReady` that creates a `SceneView`, calls `load(scene)` when a scene was fetched, marks the scene as rendered when the load settles, and returns a cleanup that disposes the view; when no scene was fetched (failure or none) it marks the scene as rendered immediately and attaches nothing. The viewer's `captureReady` is the page's "scene rendered" flag, which editors set through `onLoaded`.

- [ ] **Step 1: Implement the `ModelViewer` prop, the `SceneEditor` callback and the page changes.**
- [ ] **Step 2: `pnpm tsc --noEmit && pnpm eslint src tests && pnpm vitest run`.** Expected: clean and all pass.
- [ ] **Step 3: Commit.**

### Task 4: Verification and clean-up

**Files:** none (verification only, plus fixes it surfaces).

- [ ] **Step 1: Browser verification** (create a throwaway category and two small test assets through the admin API; save a scene with two items, a room and a non-default backdrop through the editor as the owner): switch to the Customer persona and open the product: the items, room and backdrop appear read-only, clicking an item selects nothing, there is no editor, orbit/zoom/Capture/Backdrop menu work; switch to a merchant who does not own the product and see the same; open a product with no saved scene as a customer and see the plain viewer as before.
- [ ] **Step 2: Thumbnail check:** note a product's current thumbnail URL, clear it in the database, open the product as the customer persona, and confirm the auto-saved thumbnail shows the room and items (not the bare product); then restore the original thumbnail URL.
- [ ] **Step 3: Failure checks:** make an asset's GLB unreachable (point a saved item at a version whose file is deleted from storage) and confirm the page still loads, a placeholder box appears and the thumbnail is still captured; confirm that editing, saving and reloading as the owner still work.
- [ ] **Step 4: Disposal check:** with a temporary debug hook (removed before the commit), switch persona or rebuild the viewer repeatedly and confirm `renderer.info.memory` geometries and textures return to their starting values.
- [ ] **Step 5: Commit (amend), remove every test row, asset, category, scene, storage file and the thumbnail change, and summarise what the five phases delivered.**
