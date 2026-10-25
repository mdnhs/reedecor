# Room Assets Library (Phase 1: Admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A SaaS admin can upload, categorise, version, hide and access-control 3D room-decoration assets, set each merchant's plan (Free/Pro), and the API can tell any merchant which assets they may use.

**Architecture:** Pure access and validation logic lives in `src/lib/assets/` (unit tested). Supabase persistence goes through one repository, `src/lib/supabase/assets-db.ts`. Hono endpoints in `src/server/app.ts` enforce roles and access on the server. The admin UI is a new `/admin/assets` page; GLB previews are rendered in the browser at upload time.

**Tech Stack:** Next.js (App Router), Hono, Supabase (Postgres + Storage), three.js, `@gltf-transform` optimizer (`src/lib/storage/glb-optimizer.ts`), zod, vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-room-assets-studio-design.md` (this plan covers its Phase 1 only. Phases 2 to 4 each get their own plan once this one ships, because they consume the interfaces defined here.)

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code (AGENTS.md: this Next.js has breaking changes).
- Access levels are exclusive: an asset has exactly one of `free`, `pro`, `selected`. `free`: every merchant. `pro`: merchants with plan `pro`. `selected`: only merchants on the allow-list, whatever their plan.
- Merchant plan is `free` or `pro`, set by the admin by hand. No payment or billing code.
- Access is enforced on the server in every endpoint that lists or returns assets, never only in the UI.
- Every asset has `placement` of `floor` or `wall` from day one.
- Asset real-world size is stored in centimetres.
- Editing an asset's GLB or size creates a new version; name, category, access level, allow-list, placement and hidden flag are edited in place. There is no delete in Phase 1, only hide.
- Each asset GLB is optimized on upload and rejected if larger than 2 MB (2 * 1024 * 1024 bytes) afterwards.
- Categories are admin-defined; each has an icon from the fixed set `leaf, lamp, frame, sofa, table, flower, book, shapes`.
- The product `images` array and the Meshy pipeline are not touched.
- Tailwind: scale values only, no arbitrary px. No filler comments (global CLAUDE.md).
- Git: do not work on `main`. Ask the user to approve a new branch (suggested `feature/room-assets-library`) before Task 1. One branch, one commit: stage and `git commit --amend` after the first commit, message format `feat: room-assets-library` with a numbered cumulative body, no Co-Authored-By line. Never `--no-verify`. Do not force-push without asking.
- Supabase schema changes cannot be run by the agent (the Supabase MCP is not usable from the agent session). Task 2 produces a SQL file; the user runs it in the dashboard and confirms before Tasks 3 to 8 touch the database.

## Review Focus

- A merchant row with no `plan` value (existing `app_users` rows, or a missing column) behaves as plan `free`, never as an error or as `pro`.
- A file named `.glb` that is not a GLB (wrong magic bytes, truncated) is rejected with a 400 and nothing is stored.
- A GLB over 2 MB after optimization is rejected with a 413 and nothing is stored.
- A hidden asset disappears from merchant listings but stays visible and editable to the admin.
- Two admins creating a new version of the same asset at once never produce duplicate version numbers (second gets a 409 or retries; unique constraint on asset and version).
- An allow-list entry for a merchant id that no longer exists is ignored, not an error.

---

### Task 1: Types, access rules and upload validation

**Files:**
- Create: `src/lib/assets/types.ts`, `src/lib/assets/access.ts`, `src/lib/assets/validation.ts`
- Test: `tests/assets.test.ts`

**Interfaces:**
- Produces (`types.ts`): `AssetAccessLevel = "free" | "pro" | "selected"`, `MerchantPlan = "free" | "pro"`, `AssetPlacement = "floor" | "wall"`, `ASSET_CATEGORY_ICONS` (readonly tuple of the eight icon names) and `AssetCategoryIcon`, `AssetCategory { id; name; icon: AssetCategoryIcon; sortOrder: number }`, `AssetVersion { id; assetId; version: number; glbUrl; storagePath; previewUrl: string | null; widthCm; depthCm; heightCm: number; fileSizeBytes: number; createdAt }`, `RoomAsset { id; name; categoryId; accessLevel; placement; hidden: boolean; allowedMerchantIds: string[]; currentVersion: AssetVersion; createdAt; updatedAt }`, `MerchantAssetView` (RoomAsset without `allowedMerchantIds`, plus `locked: boolean`).
- Produces (`access.ts`): `canUseAsset(asset: Pick<RoomAsset, "accessLevel" | "allowedMerchantIds">, merchant: { id: string; plan?: MerchantPlan | null }): boolean`; `toMerchantView(asset: RoomAsset, merchant: { id: string; plan?: MerchantPlan | null }): MerchantAssetView | null` (null when the asset is hidden).
- Produces (`validation.ts`): `MAX_ASSET_BYTES` (= 2 * 1024 * 1024); `validateGlb(buffer: Uint8Array): { ok: true } | { ok: false; error: string }`; zod schemas `assetMetaSchema` (name 1 to 80 chars, categoryId string, accessLevel, placement, widthCm/depthCm/heightCm positive and at most 1000, allowedMerchantIds string array defaulting to `[]`) and `assetUpdateSchema` (every `assetMetaSchema` field except the three sizes, all optional, plus `hidden` boolean optional).

- [ ] **Step 1: Write the failing tests in `tests/assets.test.ts`** (a `describe` each for access, GLB validation, schemas). Assertions: `free` asset usable by plan `free`, `pro` and by `plan: null`/undefined; `pro` asset usable by plan `pro`, not by `free` or null; `selected` asset usable by a `free` merchant whose id is in the allow-list, not by a `pro` merchant who is not in it; `toMerchantView` returns null for a hidden asset and `locked: true` for an asset the merchant cannot use, and its result has no `allowedMerchantIds` key; `validateGlb` accepts a 12-byte header `glTF`, version 2, length equal to buffer length (build a minimal valid buffer in the test) and rejects wrong magic, wrong version, and a header length that differs from the buffer length; `assetMetaSchema` rejects `widthCm: 0`, `widthCm: 1001`, an unknown `accessLevel`, and an empty name, and defaults `allowedMerchantIds` to `[]`.
- [ ] **Step 2: Run** `pnpm vitest run tests/assets.test.ts`. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement the three modules with the signatures above.**
- [ ] **Step 4: Run** `pnpm vitest run`. Expected: all tests pass, including the 13 existing ones.
- [ ] **Step 5: Commit** (branch and amend rules in Global Constraints).

### Task 2: Database schema and SQL for the user to run

**Files:**
- Create: `docs/superpowers/sql/2026-10-25-room-assets.sql`
- Modify: `src/lib/db/schema.ts` (mirror the new tables as drizzle tables, following the file's existing style)

**Interfaces:**
- Produces tables (all `create table if not exists`): `room_asset_categories (id uuid pk default gen_random_uuid(), name text unique not null, icon text not null, sort_order int not null default 0, created_at timestamptz default now())`; `room_assets (id uuid pk, name text not null, category_id uuid not null references room_asset_categories(id), access_level text not null default 'free' check in ('free','pro','selected'), placement text not null default 'floor' check in ('floor','wall'), hidden boolean not null default false, current_version_id uuid, created_at, updated_at)`; `room_asset_versions (id uuid pk, asset_id uuid not null references room_assets(id) on delete cascade, version int not null, glb_url text not null, storage_path text not null, preview_url text, width_cm numeric not null, depth_cm numeric not null, height_cm numeric not null, file_size_bytes int not null, created_at, unique (asset_id, version))`; `room_asset_access (asset_id uuid references room_assets(id) on delete cascade, merchant_id text not null, primary key (asset_id, merchant_id))`; and `alter table app_users add column if not exists plan text not null default 'free' check (plan in ('free','pro'))`.

- [ ] **Step 1: Write the SQL file with the statements above plus an index on `room_assets(category_id)` and `room_asset_versions(asset_id)`.**
- [ ] **Step 2: Mirror the four new tables in `src/lib/db/schema.ts`.** Run `pnpm tsc --noEmit`. Expected: no errors.
- [ ] **Step 3: Stop and ask the user to run the SQL file in the Supabase SQL editor and confirm.** Then verify read-only with a throwaway script in the scratchpad directory that selects `plan` from `app_users` and one row from each new table through the project's Supabase env. Expected: no "does not exist" errors.
- [ ] **Step 4: Commit.**

### Task 3: Merchant plan flag (admin-controlled)

**Files:**
- Modify: `src/lib/supabase/auth-service.ts`, `src/server/app.ts` (next to the other `/admin/users/:id/...` routes), `src/app/admin/rbac/page.tsx`
- Test: `tests/assets.test.ts` (extend)

**Interfaces:**
- Consumes: `MerchantPlan` from Task 1.
- Produces: `AppUser.plan: MerchantPlan` (missing or null database value maps to `"free"`); `AuthService.updateUserPlan(userId: string, plan: MerchantPlan): Promise<AppUser | null>`; endpoint `PATCH /api/admin/users/:id/plan` with body `{ plan: "free" | "pro" }`, saas_admin only, 400 on any other value, 404 when the user does not exist. `normalizePlan(value: unknown): MerchantPlan` exported from `src/lib/assets/access.ts`.

- [ ] **Step 1: Write failing tests** for `normalizePlan`: `"pro"` gives `"pro"`; `"free"`, `null`, `undefined`, `""`, `"enterprise"` give `"free"`.
- [ ] **Step 2: Run to verify FAIL, implement `normalizePlan`, run to verify PASS.**
- [ ] **Step 3: Add `plan` to `AppUser`, to every place `auth-service.ts` builds an `AppUser` from a row (use `normalizePlan`), and add `updateUserPlan`.**
- [ ] **Step 4: Add the endpoint, guarded like the existing role endpoint (saas_admin only, same error shape).**
- [ ] **Step 5: In the RBAC page's user table add a Plan select (Free/Pro) for merchant rows that calls the endpoint and updates local state, matching the page's existing role-select pattern.**
- [ ] **Step 6: Verify:** `pnpm tsc --noEmit`, `pnpm eslint src`, then with the dev server up, `PATCH` the plan of `user-merchant` to `pro` as the admin and read it back through `GET /api/admin/users`. Expected: plan is `pro`; a customer-session call returns 403.
- [ ] **Step 7: Commit.**

### Task 4: Asset file storage

**Files:**
- Modify: `src/lib/storage/types.ts`, `src/lib/storage/supabase-storage.ts`

**Interfaces:**
- Produces on `StorageProvider` and `SupabaseStorageService`: `uploadAssetFile(file: Buffer, kind: "glb" | "preview", assetId: string, version: number, mimeType?: string): Promise<StorageUploadResult>`. Paths: `assets/{assetId}/v{version}.glb` (content type `model/gltf-binary`) and `assets/{assetId}/v{version}-preview.png` (content type `image/png`). When no Supabase client is configured it throws (assets need real storage; no mock URL).

- [ ] **Step 1: Implement the interface method, reusing `ensureBucket` and the public-URL pattern of `uploadModelFile`.**
- [ ] **Step 2: Verify:** `pnpm tsc --noEmit`. Then upload a tiny buffer to path `assets/test-asset/v1.glb` from a scratchpad script, fetch the returned public URL (expect HTTP 200), and delete the object. Expected: URL loads.
- [ ] **Step 3: Commit.**

### Task 5: Assets repository

**Files:**
- Create: `src/lib/supabase/assets-db.ts`

**Interfaces:**
- Consumes: types from Task 1, `getSupabaseClient` from `./db`.
- Produces `assetsDb` with: `listCategories(): Promise<AssetCategory[]>` (ordered by `sortOrder`, then name); `createCategory(name: string, icon: AssetCategoryIcon): Promise<AssetCategory>` (throws `"duplicate"` error message on a name clash); `deleteCategory(id: string): Promise<"deleted" | "in_use">`; `listAssets(): Promise<RoomAsset[]>` (includes hidden; each with its current version and allow-list; ignores allow-list entries whose merchant id has no `app_users` row); `getAsset(id: string): Promise<RoomAsset | null>`; `createAsset(input: { id: string; name; categoryId; accessLevel; placement; allowedMerchantIds: string[] }, version: Omit<AssetVersion, "id" | "createdAt">): Promise<RoomAsset>` (inserts asset, version 1, sets `current_version_id`, writes allow-list); `addVersion(assetId: string, version: Omit<AssetVersion, "id" | "createdAt" | "version">): Promise<RoomAsset>` (next version number = current max + 1; unique-violation raises an error whose message is `"version_conflict"`); `updateAsset(id: string, patch: Partial<Pick<RoomAsset, "name" | "categoryId" | "accessLevel" | "placement" | "hidden">> & { allowedMerchantIds?: string[] }): Promise<RoomAsset | null>` (replaces the allow-list when provided; clears nothing when omitted).

- [ ] **Step 1: Implement with the Supabase client, following the mapping style of `src/lib/supabase/db.ts` (snake_case rows to camelCase objects).**
- [ ] **Step 2: Verify with a scratchpad script against the real database after the user has run the SQL:** create a category, create an asset, add a version (expect version 2 and `currentVersion.version === 2`), update access to `selected` with an allow-list including one real and one non-existent merchant id (expect only the real one returned), hide it, then clean up the rows. Expected: all assertions hold; script prints OK.
- [ ] **Step 3: Commit.**

### Task 6: Asset API endpoints

**Files:**
- Modify: `src/server/app.ts` (new section "Room Assets" after the product endpoints)

**Interfaces:**
- Consumes: Tasks 1, 4, 5; `optimizeGlbBuffer` from `src/lib/storage/glb-optimizer.ts`.
- Produces endpoints (all under `/api`):
  - `GET /admin/asset-categories`, `POST /admin/asset-categories` (`{ name, icon }`, icon must be in `ASSET_CATEGORY_ICONS`, 409 on duplicate name), `DELETE /admin/asset-categories/:id` (409 when assets use it). saas_admin only.
  - `GET /admin/assets` returns every `RoomAsset` including hidden. saas_admin only.
  - `POST /admin/assets`: multipart with `glb` (file), optional `preview` (PNG file), and `meta` (JSON string parsed with `assetMetaSchema`). Steps: validate GLB (400), optimize, reject over `MAX_ASSET_BYTES` (413), upload GLB and preview, create asset. Returns 201 with the `RoomAsset`.
  - `PATCH /admin/assets/:id`: body parsed with `assetUpdateSchema`; 404 when missing.
  - `POST /admin/assets/:id/versions`: multipart with `glb`, optional `preview`, and `meta` JSON containing `widthCm`, `depthCm`, `heightCm`; same validation and size rules; 409 on `version_conflict`.
  - `GET /assets`: for a merchant or admin, returns `MerchantAssetView[]` built with `toMerchantView` (hidden assets omitted, `locked` set, allow-list never included); 403 for customers.
  - All of the above return the existing `{ success, data | error }` shape and 401/403 like the other admin routes.

- [ ] **Step 1: Write failing route tests in `tests/assets-api.test.ts`** using `app.request` with `vi.mock` for `@/lib/supabase/assets-db`, `@/lib/storage/supabase-storage`, `@/lib/storage/glb-optimizer` and `@/lib/supabase/auth-service`. Cases: customer and anonymous calls to `/admin/assets` give 403/401; a non-GLB upload gives 400 and `uploadAssetFile` is never called; an optimizer result over 2 MB gives 413 and nothing is uploaded; `GET /assets` for a `free` merchant returns a `pro` asset with `locked: true`, omits a hidden asset, and the payload has no `allowedMerchantIds`; `POST /admin/assets/:id/versions` returns 409 when the repository throws `version_conflict`; `PATCH` with an invalid `accessLevel` gives 400.
- [ ] **Step 2: Run** `pnpm vitest run tests/assets-api.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the endpoints. Reuse `getCurrentUser`; extract one small `requireAdmin(c)` helper if the same check appears in more than two new routes.**
- [ ] **Step 4: Run** `pnpm vitest run && pnpm tsc --noEmit && pnpm eslint src`. Expected: all pass.
- [ ] **Step 5: Manual check with the dev server:** upload a real small GLB (for example `public/models/default-model.glb` if it is under 2 MB after optimization, otherwise any small GLB) as admin; then `GET /api/assets` as the free merchant and confirm the three access levels behave as in the spec.
- [ ] **Step 6: Commit.**

### Task 7: Browser GLB preview renderer

**Files:**
- Create: `src/lib/assets/render-preview.ts`

**Interfaces:**
- Produces: `renderGlbPreview(file: File, size?: number): Promise<{ blob: Blob; dimensionsCm: { width: number; depth: number; height: number } }>` — loads the GLB (with the Draco decoder at `/draco/`), frames it on a neutral backdrop, renders a square PNG (default 512), disposes the renderer and geometry, and returns the model's bounding-box size in centimetres assuming glTF units are metres. Rejects with an `Error` whose message says the file could not be read when loading fails.

- [ ] **Step 1: Implement using the same three.js setup choices as `model-viewer.tsx` (RoomEnvironment lighting, NeutralToneMapping, sRGB output), offscreen canvas, no animation loop.**
- [ ] **Step 2: Verify in the browser (Task 8 page, or a temporary test page that is deleted afterwards):** pick a GLB, confirm a preview PNG appears, dimensions are plausible, and the browser console shows no WebGL context leak warnings after ten consecutive previews.
- [ ] **Step 3: Commit.**

### Task 8: Admin Assets page and navigation

**Files:**
- Create: `src/app/admin/assets/page.tsx`; split components into `src/components/assets/` (`asset-upload-form.tsx`, `asset-card.tsx`, `category-manager.tsx`) so no file grows past what fits comfortably in context
- Modify: `src/components/layout/sidebar.tsx` (new item "Room Assets", `adminOnly: true`, `show: isSaasAdmin`, icon `Shapes` from lucide-react)

**Interfaces:**
- Consumes: Task 6 endpoints, Task 7 `renderGlbPreview`, types from Task 1.

- [ ] **Step 1: Read the relevant Next.js guide in `node_modules/next/dist/docs/` (client components, routing) and the existing `src/app/admin/rbac/page.tsx` for the layout wrapper and styling conventions.**
- [ ] **Step 2: Build the page.** Category manager (list, add with icon picker, delete with the in-use error shown). Upload form: GLB file picker, name, category, placement, size fields in cm pre-filled from `renderGlbPreview` but editable, access level radio (Free / Pro / Selected merchants), merchant multi-select shown only for Selected (merchants from `GET /api/admin/users`), preview shown with an optional override file input, a visible 2 MB limit and "textures up to 1k recommended" hint. Asset grid with preview, name, category, access badge, placement, hidden toggle, inline edit of name/category/access/allow-list, and "Upload new version" (GLB plus size fields). Errors from the API are shown verbatim near the action.
- [ ] **Step 3: Add the sidebar item. Customers and merchants must not see it and must be redirected or shown an access-denied state if they open `/admin/assets` directly (match the RBAC page's behaviour).**
- [ ] **Step 4: Verify in the browser as admin:** create a category, upload an asset as Free, switch it to Pro, then Selected with one merchant, hide it, upload a new version and see version 2 become current; then switch to the merchant persona and confirm `GET /api/assets` reflects each state, and that `/admin/assets` is blocked.
- [ ] **Step 5: Run** `pnpm vitest run && pnpm tsc --noEmit && pnpm eslint src`. Expected: all pass; check changed files against the Tailwind and comment rules.
- [ ] **Step 6: Commit (amend), then list the remaining phases (scene editor, room builder, customer view) as the next plans.**
