# Room Assets & Scene Studio: Design

## Intent

Merchants sell furniture through an interactive 3D viewer. A bare product on a grey backdrop sells less than the same product in a styled room (see the reference: armchair, side table, fiddle-leaf plant, throw, wooden floor, white wall). Today a merchant can only change the backdrop colour.

This feature lets a SaaS admin build a library of 3D decoration assets (plants, lamps, rugs, frames, tables, ...). Merchants drag those assets into their product's 3D studio, build a simple room (wall colour, floor type), and save the scene. Customers then see the merchant's styled scene when they open the product.

## Goals

- Admin panel has an **Assets** section: upload GLB assets with name, category, preview image, real-world size, and an access level.
- Access levels per asset: **Free** (all merchants), **Pro** (merchants on the Pro plan), **Selected merchants** (admin-chosen allow-list).
- Merchants have a **plan** (Free or Pro) that the admin sets by hand.
- In the studio viewer, a **slim icon rail on the left** (one icon per category) opens a floating asset panel (search, category, grid). Chosen layout: "B" from the mockup session.
- Merchant can drag an asset from the panel into the 3D scene, then select, move, rotate, scale and delete placed items.
- Merchant can build a **room**: choose wall colour and floor type (wood, concrete, tiles, ...). This sits next to / replaces the current Backdrop control.
- "Save scene" stores the arrangement with the product.
- Customers viewing the product see the saved scene, can orbit it, cannot edit it.
- Locked assets (above the merchant's access) are visible with a lock marker but cannot be placed.

## Non-goals

- Payments, billing, plan purchase flows (explicitly deferred; separate later project).
- Customers editing or placing assets.
- Merchants uploading their own assets.
- Physics, collision, snapping beyond keeping items on the floor plane.
- AR / mobile placement.

## Anti-goals (a failure even if it technically works)

- Placed assets with wrong proportions (a plant taller than the sofa). Scale must come from real sizes.
- A viewer that becomes slow or crashes on mobile because of heavy assets or too many items.
- A saved scene that breaks or vanishes when an admin edits, hides or deletes an asset it uses.
- Letting a merchant use an asset they do not have access to by calling the API directly.
- Changing how Meshy generation works. The product `images` array must stay untouched.

## Constraints and existing code

- Stack: Next.js (see AGENTS.md: read `node_modules/next/dist/docs/` before writing Next code), Hono API in `src/server/app.ts`, Supabase (DB + storage, bucket `furniture-3d-studio`), three.js viewer in `src/components/studio/model-viewer.tsx`, backdrop logic in `src/components/studio/backdrop.ts`.
- Roles: `saas_admin`, `merchant`, `customer`. Auth via `getCurrentUser` in `app.ts`.
- GLB handling already exists: Draco decoding in the viewer (`/public/draco`), server-side optimizer in `src/lib/storage/glb-optimizer.ts` (use it for uploaded assets).
- Schema changes need SQL run in the Supabase dashboard; the Supabase MCP is not usable from the agent session, so the plan must hand the user the SQL.
- No plans/subscriptions concept exists yet; this feature adds only a manual `plan` flag on the merchant.
- The recently added product thumbnail (auto first-frame + "Use as thumbnail") already captures the canvas. With scenes it should capture the saved scene naturally.
- Project rules: develop in vertical phases, each working end to end and tested; Tailwind scale values only (no arbitrary px); no filler comments.

## How it gets built (decisions made)

Phases, each independently shippable:

1. **Assets library (admin).** Tables `room_assets` and `room_asset_access`; merchant `plan` field. Admin pages to upload (optimizing the GLB), list, edit, hide, and set access level and allow-list. Admin page to set a merchant's plan. API endpoints with role checks.
2. **Scene editor (merchant).** Left icon rail + floating panel listing only assets visible to the merchant, locked ones marked. Drag into scene, selection with transform controls (move on floor, rotate, scale, delete). "Save scene" persists per product.
3. **Room builder.** Wall colour and floor type; walls and floor rendered in three.js and saved with the scene. Backdrop control is reconciled with this (see Left to the builder).
4. **Customer view and thumbnail.** Product viewer loads and shows the saved scene read-only; auto/first thumbnail and Capture use the scene.

## Calls made by me (please check)

- Access model is three levels (Free / Pro / selected merchants); a merchant's plan is Free or Pro, set manually by admin.
- Asset real-world size is stored in centimetres and used to scale it; the product's own size (`widthMm` etc.) sets the reference scale.
- Scene is stored as JSON per product (list of items: asset id, position, rotation, scale; plus room settings) rather than as a baked model.
- Items stay on the floor plane (only move in X/Z, rotate around Y) in the first release. Wall-hung items are decided below.
- Assets are optimized and size-limited on upload (suggested 5 MB after optimization); the builder picks the exact limit.
- Hiding an asset removes it from the panel but keeps it rendering in already-saved scenes; deleting an asset that is used is blocked or soft-deleted.

## Decisions by the user

- **Lost access (downgrade or removed from an allow-list):** customers keep seeing the items exactly as saved. In the merchant editor those items show a lock marker; the merchant can remove them but cannot add new copies of that asset. Saving is never blocked by them.
- **Wall-hung items (frames):** not in the first release. The `placement` field (`floor` or `wall`) is still stored per asset from Phase 1, and frame assets can be uploaded and listed, but placing items on a wall (snapping, vertical movement) is a later release. Until then, wall-placement assets are shown in the panel but cannot be placed.

## More calls made by me after the builder check (please check)

- **Access levels are exclusive.** An asset has exactly one level: Free, Pro, or Selected. A Free merchant on a Selected asset's allow-list gets that asset; Pro status does not grant Selected assets. Access is enforced on the panel listing, the placement step and the save-scene API, never only in the UI.
- **Scene storage:** separate table `product_scenes` (one row per product) holding the scene JSON plus a `schema_version`. The Meshy pipeline and `product.images` are untouched. If a product's model is regenerated, items keep their positions relative to the product's floor-centre origin.
- **Scale:** the product GLB is normalised so its largest side matches its `widthMm/depthMm/heightMm`; scene units are centimetres. Items store a scale multiplier on the asset's real-world size (1.0 = real size). A product with missing dimensions falls back to its model's bounding box with the default chair size (85 x 75 x 82 cm) as reference.
- **No scene = unchanged.** A product without a saved scene looks exactly as it does today (Backdrop mode only). The Backdrop stays as a fallback: a scene with a room replaces it, a scene without a room keeps the chosen backdrop. The scene JSON keeps the backdrop mode.
- **Assets are versioned.** Editing an asset's GLB or real-world size creates a new version; scenes reference an asset version, so existing scenes never change under a merchant. Name, category, access level and hidden flag are editable in place. Asset GLBs live in the public storage bucket, so customers can load them for any saved scene even if the asset is hidden or the merchant lost access.
- **Mobile budget (target: mid-range phone):** at most 20 items per scene, each asset under 2 MB after optimization with textures up to 1k, so a full scene stays under about 25 MB total. The customer view loads the product first and then the scene items.
- **Categories:** admin-defined, each with an icon chosen from a fixed icon set. The asset preview image is auto-rendered from the GLB in the browser at upload time, with an optional admin override.
- Every asset has a `placement` field (`floor` or `wall`) from Phase 1, so the schema never needs changing for wall items.

## Left to the builder

- Exact table/column names, API paths, and component structure.
- Choice of transform controls (e.g. three.js `TransformControls`) and drag-and-drop implementation.
- Exact floor/wall material set and textures.
- How the Backdrop control and the Room builder share the UI.
- Limits (item count per scene, asset file size), and test strategy.
