# Room Builder (Phase 3: Walls and Floor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A merchant (or admin) editing a product's scene can switch on a room (a floor plus two walls) around the product, choose the wall colour (with suggestions derived from the product's colour) and the floor type, and save it with the scene.

**Architecture:** The room is optional data inside the existing scene JSON (`room`), so no new table and no SQL. A reusable `RoomRenderer` (three.js) builds and disposes the floor and walls from a `RoomSettings` value and is independent of the editor, so Phase 4 can use it for customers. Floor materials are generated procedurally on a canvas (no image assets). The editor gets a "Room" entry in the left rail that opens a room panel in the same floating-panel slot as the asset panel.

**Tech Stack:** Next.js (App Router), Hono, three.js, zod, vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-room-assets-studio-design.md` (Phase 3: "Room builder. Wall colour and floor type; walls and floor rendered in three.js and saved with the scene"). Builds on Phase 2 (`src/lib/scenes/*`, `src/components/studio/scene-editor/*`, `src/server/scene-routes.ts`), which is on `main`.

## Global Constraints

- `RoomSettings` is `{ enabled: boolean; wallColor: string; floorType: FloorType }`. `wallColor` is a six-digit hex string matching `^#[0-9a-fA-F]{6}$`. `FloorType` is one of `oak`, `walnut`, `concrete`, `tile`.
- `room` is optional inside `SceneData` and `ResolvedScene`; `schemaVersion` stays `1`. A scene without `room`, or with `room.enabled === false`, looks exactly like today (backdrop and the soft ground shadow only).
- Geometry in centimetres converted with the scene's `worldPerCm`: floor 600 x 600 cm centred on the product's floor-centre origin; a back wall on the far side (negative Z) and a left wall (negative X), each 600 cm wide and 280 cm high, forming a corner behind and to the left of the default camera. Walls and floor are single-sided so walls are invisible when the camera orbits behind them. No ceiling.
- The room never limits where items can be placed or moved (item offsets stay limited to 500 cm by Phase 2).
- When the room is enabled the existing soft ground shadow plane is hidden and the floor receives shadows; when disabled it is shown again exactly as before. Toggling must not leak geometries, materials or textures.
- Suggested wall colours come from the product's dominant colour (`extractProductTone`): three muted suggestions, always light enough to read as wall paint, plus the fixed neutrals white `#f5f5f4`, greige `#d6d3d1` and warm stone `#e7e0d5`.
- The Backdrop control is unchanged. The backdrop remains what is seen outside the room.
- Only the product's owner or a saas_admin can save a room (existing scene PUT rules). Anyone can read it through the public scene GET.
- Capture and the auto thumbnail already render the canvas, so they include the room with no extra work.
- Tailwind: scale values only, no arbitrary px. No filler comments (global CLAUDE.md).
- Git: do not work on `main`. Ask the user to approve a new branch (suggested `feature/room-builder`). One branch, one commit: stage and `git commit --amend` after the first commit; message format `feat: room-builder` with a numbered cumulative body; no Co-Authored-By line; never `--no-verify`; no force-push without asking.
- No database change in this phase.

## Review Focus

- A scene saved before this phase (no `room`) loads, shows no room and saves unchanged.
- `wallColor` values such as `red`, `#12`, `#GGGGGG`, `javascript:alert(1)` and an empty string return 400 on save; an unknown `floorType` returns 400.
- With the room off, the viewer is identical to today, including the soft ground shadow.
- Switching the room on and off, and changing the floor type, twenty times in a row leaves no extra geometries or textures alive (disposal is complete).
- Orbiting to the back or left of the product never leaves the camera trapped behind an opaque wall.
- Items placed or dragged beyond the walls stay selectable and savable.
- A product with a very small or very large size (for example 20 cm or 300 cm) gets a correctly scaled room, because the room is built from centimetres and `worldPerCm`.
- Saving with only a room change (no item change) enables Save and persists.

---

### Task 1: Room settings, schema and colour suggestions

**Files:**
- Create: `src/lib/scenes/room.ts`
- Modify: `src/lib/scenes/types.ts`, `src/lib/scenes/schema.ts`
- Test: `tests/room.test.ts`

**Interfaces:**
- Produces (`room.ts`): `FLOOR_TYPES = ["oak", "walnut", "concrete", "tile"] as const`, `FloorType`, `RoomSettings { enabled: boolean; wallColor: string; floorType: FloorType }`, `DEFAULT_ROOM: RoomSettings` (`enabled: true`, wallColor `#e7e0d5`, floorType `oak`), `ROOM_SIZE_CM = { floor: 600, wallHeight: 280 }`, `NEUTRAL_WALL_COLORS: { name: string; color: string }[]` (white, greige, warm stone, with the hex values in Global Constraints), `suggestWallColors(tone: ProductTone | null): string[]` (returns three hex colours; with `null` it returns the first three neutrals' colours; otherwise it derives them from the product hue: a pale tint of the hue, a muted complement of the hue, and a muted analogue 30 degrees away, all with lightness between 0.78 and 0.92 and saturation at most 0.25), `isHexColor(value: string): boolean`.
- Modifies `types.ts`: `SceneData` and `ResolvedScene` gain `room?: RoomSettings`. `EMPTY_SCENE` stays without `room`.
- Modifies `schema.ts`: `roomSchema` (`enabled` boolean, `wallColor` string matching the hex pattern, `floorType` enum from `FLOOR_TYPES`) and `sceneSchema` gains `room: roomSchema.optional()`.

- [ ] **Step 1: Write failing tests in `tests/room.test.ts`.** `sceneSchema` accepts `EMPTY_SCENE` (no room) and a scene with `DEFAULT_ROOM`; accepts `enabled: false`; rejects each wallColor of `red`, `#12`, `#GGGGGG`, `javascript:alert(1)`, `""` and `#12345678`; rejects `floorType: "lava"`; `isHexColor("#a1B2c3")` is true and `isHexColor("a1b2c3")` is false; `suggestWallColors(null)` returns exactly the three neutral colours; for a terracotta tone (`{ h: 0.04, s: 0.7, l: 0.4 }`) and for a dark burgundy tone (`{ h: 0.98, s: 0.6, l: 0.2 }`) it returns three distinct valid hex colours whose HSL lightness is at least 0.78 and saturation at most 0.25 (compute HSL in the test with `THREE.Color.getHSL`); a grey product (`{ h: 0, s: 0, l: 0.5 }`) still yields three valid hex colours.
- [ ] **Step 2: Run** `pnpm vitest run tests/room.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `room.ts` and the type and schema changes.**
- [ ] **Step 4: Run** `pnpm vitest run`. Expected: all pass.
- [ ] **Step 5: Commit** (branch and amend rules in Global Constraints).

### Task 2: Room persisted through the scene API

**Files:**
- Modify: `src/server/scene-routes.ts`, `src/lib/supabase/scenes-db.ts` (only if it drops unknown fields), `tests/scene-api.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `GET /products/:id/scene` returns `room` when the saved scene has one (omitted when it does not); `PUT /products/:id/scene` accepts, validates (Task 1 schema) and stores `room`, and returns it in the resolved scene.

- [ ] **Step 1: Add failing route tests:** PUT with a valid room returns 200, `upsert` receives the room, and the response `data.room` equals it; GET returns the stored room; GET of a scene stored without a room has no `room` key; PUT with `wallColor: "red"` returns 400 and does not call `upsert`; PUT with `floorType: "lava"` returns 400; PUT of a room-only change (same items as the previous scene) returns 200.
- [ ] **Step 2: Run to verify FAIL, update `resolveScene` and anything else that copies scene fields so `room` is carried through, run to verify PASS.**
- [ ] **Step 3: `pnpm vitest run && pnpm tsc --noEmit && pnpm eslint src tests`.** Expected: all pass.
- [ ] **Step 4: Commit.**

### Task 3: Viewer context additions

**Files:**
- Modify: `src/components/studio/viewer-context.ts`, `src/components/studio/model-viewer.tsx`

**Interfaces:**
- Produces on `ViewerContext`: `ground: THREE.Mesh` (the existing soft shadow plane) and `productTone: ProductTone | null` (computed once from the loaded product model and also used for the backdrop).

- [ ] **Step 1: Implement:** compute `extractProductTone(currentModel)` once in the model-load callback, pass it into the context and into `setProductTone`; add the `ground` mesh to the context. No behaviour change.
- [ ] **Step 2: Verify no regression:** `pnpm tsc --noEmit && pnpm eslint src && pnpm vitest run`, then open a product viewer in the browser: model, backdrop menu, capture and (as owner) the editor behave as before and the console shows no new errors.
- [ ] **Step 3: Commit.**

### Task 4: Room renderer

**Files:**
- Create: `src/components/studio/room/floor-textures.ts`, `src/components/studio/room/room-renderer.ts`

**Interfaces:**
- Consumes: `RoomSettings`, `FloorType`, `ROOM_SIZE_CM` (Task 1), `ViewerContext` (Task 3).
- Produces (`floor-textures.ts`): `createFloorTexture(type: FloorType, renderer: THREE.WebGLRenderer): THREE.CanvasTexture` (procedural 1024 px canvas texture; `oak` light wood planks, `walnut` dark wood planks, `concrete` mottled grey, `tile` white square tiles with grout lines; sRGB colour space, repeat wrapping, anisotropy set from the renderer, and `repeat` chosen so a plank is about 12 cm wide and a tile about 60 cm across on a 600 cm floor).
- Produces (`room-renderer.ts`): `class RoomRenderer` constructed with `(context: ViewerContext)`; `apply(room: RoomSettings | undefined): void` (idempotent; builds or updates the floor and the two walls, shows or hides `context.ground`, rebuilds the floor texture only when `floorType` changes, updates wall colour in place, removes and disposes everything when the room is `undefined` or `enabled: false`); `dispose(): void` (removes and disposes everything it added and restores `context.ground.visible = true`). Floor and walls use single-sided `MeshStandardMaterial` (floor roughness 0.85, walls roughness 0.95, walls cast no shadow, floor and walls receive shadows).

- [ ] **Step 1: Implement both modules.**
- [ ] **Step 2: `pnpm tsc --noEmit && pnpm eslint src`.** Expected: clean. (Rendering is verified in the browser in Task 6.)
- [ ] **Step 3: Commit.**

### Task 5: Room panel and editor integration

**Files:**
- Create: `src/components/studio/scene-editor/room-panel.tsx`
- Modify: `src/components/studio/scene-editor/asset-rail.tsx`, `src/components/studio/scene-editor/scene-editor.tsx`, `src/app/viewer/[id]/page.tsx` (only if the editor's props change)

**Interfaces:**
- Consumes: Tasks 1, 3, 4.
- Produces: `RoomPanel` props `{ room: RoomSettings | undefined; suggestions: string[]; onChange: (room: RoomSettings | undefined) => void; onClose: () => void }`: an on/off switch ("Room"), wall colour swatches (suggested first with the label "Suggested for this product", then the neutrals) plus a custom colour input, and a row of four floor-type tiles (each showing a small swatch of the texture). Switching the room on without a previous value uses `DEFAULT_ROOM`; switching it off sets `enabled: false` but keeps the chosen colour and floor so switching back restores them.
- `AssetRail` gains an optional `onOpenRoom` / `roomActive` pair and renders a divider and a "Room" button (Home icon, accessible name "Room") below the category buttons.
- `SceneEditor`: holds `room` state initialised from `initialScene.room`; creates one `RoomRenderer` per viewer context and calls `apply(room)` on every change; disposes it with the controller; the panel slot shows `RoomPanel` when the Room button is active and `AssetPanel` when a category is active (opening one closes the other); a room change marks the scene dirty (compare against the last saved room by deep value, so reverting to the saved room is clean); Save sends `room` in the PUT body (omitted when the user never enabled a room and none was saved) and records the saved room from the response; `onSaved` keeps the page's scene in sync as in Phase 2.

- [ ] **Step 1: Implement the panel, the rail change and the editor wiring.**
- [ ] **Step 2: `pnpm tsc --noEmit && pnpm eslint src tests && pnpm vitest run`.** Expected: clean and all pass.
- [ ] **Step 3: Commit.**

### Task 6: Verification and clean-up

**Files:** none (verification only, plus fixes it surfaces).

- [ ] **Step 1: Browser verification as the product's owner** (create a throwaway category and two small test assets through the admin API first; remove them afterwards): open the Room panel, switch the room on and see the floor and two walls around the product; change wall colour through a suggestion, a neutral and the custom input; change floor type through all four and see each texture; orbit to the back and left and confirm walls disappear instead of trapping the camera; place an item and see it sit on the floor with a shadow; switch the room off and see the viewer return to the backdrop with the soft ground shadow; Save, reload and see the same room, colour and floor; save a room-only change; Capture while the room is on and see the room in the screenshot; add a stale-scene check by loading a product whose scene has no room and confirm nothing changes; open the product as the customer persona and confirm there is no editor (the room itself appears for customers in Phase 4).
- [ ] **Step 2: Phone-width check** in a 400 px same-origin iframe: the Room button is reachable, the panel is usable and swatches can be tapped.
- [ ] **Step 3: Toggle the room on and off and change floor types twenty times** while watching `renderer.info.memory` (geometries and textures) in the browser console through the page; the counts return to their starting values.
- [ ] **Step 4: Commit (amend), clean up every test row, asset, category and storage file, and summarise Phase 4 as the next plan.**
