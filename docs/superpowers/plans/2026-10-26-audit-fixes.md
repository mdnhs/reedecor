# Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the security holes, data leaks, broken generation lifecycle and fake metrics found in the 2026-10-26 project audit.

**Architecture:** Five vertical phases, each on its own stacked branch, each leaving the app working and tested. Authorization moves into small pure helpers in `src/server/access.ts` that every route uses; generation logic moves out of `app.ts` into `src/server/generation.ts` so generate/retry share one guarded path; public data goes through explicit public DTOs.

**Tech Stack:** Next.js 16.4 (App Router, `proxy.ts`), Hono, Supabase JS, zod 4, Vitest 5, three.js.

**Spec:** The audit report delivered in chat on 2026-10-26 (security §1, data §2, important §3, minor §4). Decisions taken by the builder because the user said "proceed your way":
- Demo role switching stays, but only when `DEMO_MODE=true` or `NODE_ENV !== "production"`; it is never reachable in production by default.
- Credits use no new table: balance = allowance − sum of `creditCostEstimate` of the merchant's non-cancelled attempts; allowance is `DEFAULT_CREDIT_ALLOWANCE = 100`.
- RLS is delivered as an SQL file the user runs in Supabase; the code fails fast in production when the service-role key is missing.

## Global Constraints

- Branches, stacked in this order, never merged or pushed by the agent: `fix/api-auth-hardening` → `fix/public-store-data` → `fix/generation-pipeline` → `fix/honest-metrics` → `fix/ux-a11y-3d`.
- One commit per branch, amended as work continues, message format from `~/.claude/CLAUDE.md` (`fix: <branch-slug>` + `commit message:` numbered list), no AI attribution trailer.
- No Tailwind arbitrary `[px]` values in touched lines; no narrative comments.
- Tests follow the `tests/scene-api.test.ts` pattern: `vi.hoisted` mocks for `@/lib/supabase/*`, bearer tokens mapped to users.
- After every phase: `pnpm test`, `npx tsc --noEmit -p .`, `npx eslint src tests`, then a fresh reviewer subagent on the phase diff; fix findings before the next phase.

## Review Focus

- Signed-out request to any write route → 401, never a demo fallback. (Task 1.2 tests)
- Merchant acting on another merchant's product → 403. (Task 1.2 tests)
- Public store for a merchant with zero completed products → empty list, never other merchants' products. (Task 2.1 tests)
- Second generate/retry while one attempt is processing → 409 and no Meshy call. (Task 3.1 tests)
- Status poll after cancel → attempt stays cancelled. (Task 3.2 tests)

---

## Phase 1 — `fix/api-auth-hardening`

### Task 1.1: Access helpers and demo-mode flag

**Files:** Create `src/server/access.ts`; Test `tests/access.test.ts`

**Interfaces — Produces:**
- `isDemoMode(env?: NodeJS.ProcessEnv): boolean` — true when `DEMO_MODE === "true"` or `NODE_ENV !== "production"`.
- `canManageProduct(user: AppUser | null, product: { merchantId: string }): boolean` — admin always; merchant only when `user.id === product.merchantId`.
- `isStaff(user: AppUser | null): user is AppUser` — role `merchant` or `saas_admin`.
- `PUBLIC_REGISTRATION_ROLES = ["merchant", "customer"] as const`.

- [ ] Tests: `isDemoMode({NODE_ENV:"production"})` false; with `DEMO_MODE:"true"` true; `NODE_ENV:"development"` true. `canManageProduct` true for owner and admin, false for other merchant, customer, null.
- [ ] Implement, run `pnpm vitest run tests/access.test.ts` → PASS.

### Task 1.2: Lock down auth and product routes in `src/server/app.ts`

**Files:** Modify `src/server/app.ts`; Test `tests/api-auth.test.ts`

- `/auth/me`: no session → `401 { success:false }`; with session → add `demoMode: isDemoMode()` to data.
- `/auth/register`: `role: z.enum(PUBLIC_REGISTRATION_ROLES).default("customer")`.
- `/auth/switch-demo`: `404` when `!isDemoMode()`.
- New `POST /admin/users` (admin only, body = register schema with all three roles) → creates user, does **not** set a cookie.
- `GET /products`: 401 signed out; admin → all; merchant → own; customer → `status === "completed"` only.
- `POST /products`, `DELETE /products/:id`, `/generate`, `/retry`, `/cancel`: 401 when signed out, 403 unless `isStaff` and (for existing products) `canManageProduct`. `POST /products` sets `merchantId = user.id`, never `DEMO_MERCHANT.id`.
- `POST /products/:id/thumbnail`: 401 signed out; 403 unless `canManageProduct`.
- `/credits/usage`: 401 signed out; merchant sees only own products' attempts.
- `GET/PATCH /merchants/profile`: 401 signed out; PATCH 403 for customers.

- [ ] Tests (one `it` each): signed-out delete → 401; other merchant delete → 403; owner delete → 200; register with `saas_admin` → 400; switch-demo with `NODE_ENV=production` → 404; `/auth/me` signed out → 401; merchant `GET /products` returns only own; `POST /admin/users` by admin returns 201 and no `set-cookie`.
- [ ] Implement; tests PASS.

### Task 1.3: Proxy allowlist, masked secrets, injection-safe lookup

**Files:** Modify `src/server/app.ts`, `src/lib/supabase/db.ts:274-300`; Create `src/server/proxy-allowlist.ts`; Test `tests/proxy-allowlist.test.ts`, extend `tests/api-auth.test.ts`

**Produces:** `isAllowedModelUrl(raw: string, supabaseUrl?: string): boolean` — https only; host is `assets.meshy.ai` or the host of `NEXT_PUBLIC_SUPABASE_URL`. `MAX_PROXY_BYTES = 60 * 1024 * 1024`.
- `/proxy-model`: 400 for disallowed URL; no default-model fallback (expired → upstream status); reject when `content-length` > cap.
- `GET /admin/settings`: `meshyApiKey` replaced by `maskSecret(key)` (`"••••" + last 4`, empty stays empty). `PATCH`: ignore `meshyApiKey` values starting with `"••••"`; `meshyApiBaseUrl` must match `^https://([a-z0-9-]+\.)*meshy\.ai(/.*)?$`.
- `getMerchantPublicProfile`: replace `.or(...)` with `.eq("id", x)` then `.eq("email", x)` fallback.

- [ ] Tests: `isAllowedModelUrl("http://169.254.169.254/")` false, `"https://assets.meshy.ai/a.glb"` true, supabase host true, `"https://evil.com"` false; settings GET returns masked key; PATCH with `meshyApiBaseUrl:"https://evil.com"` → 400.
- [ ] Implement; tests PASS.

### Task 1.4: Password hashing, login throttling, service-key fail-fast, RLS SQL

**Files:** Modify `src/lib/auth/password.ts`, `src/server/app.ts` (login), `src/lib/supabase/db.ts:6-10`, `src/lib/storage/supabase-storage.ts:6-10`; Create `src/server/rate-limit.ts`, `docs/superpowers/sql/2026-10-26-enable-rls.sql`; Test `tests/password.test.ts`, `tests/rate-limit.test.ts`

- `hashPassword` → `pbkdf2$210000$<salt>$<hash>`; `verifyPassword` accepts both new format and legacy `salt:hash` (1000 iterations).
- `createRateLimiter({ limit: 5, windowMs: 15 * 60_000 })` → `{ hit(key: string, now?: number): boolean }`; login keyed by `ip|email`, returns 429 when exhausted.
- Production without `SUPABASE_SERVICE_ROLE_KEY` → throw on first client creation; no hard-coded project URL fallback.
- SQL: `alter table … enable row level security` for `app_users, app_sessions, products, product_images, generation_attempts, merchant_followers, wishlists, system_settings, feature_flags, room_assets, asset_versions, asset_categories, product_scenes` (guarded with `if exists` via `DO` block); no anon policies (service role bypasses RLS).

- [ ] Tests: new hash verifies; legacy `salt:hash` built with 1000 iterations verifies; wrong password fails; limiter allows 5 then blocks, resets after window.
- [ ] Implement; tests PASS.

### Task 1.5: Client side — route protection, demo-only switcher, admin user creation

**Files:** Create `src/proxy.ts`; Modify `src/lib/auth/auth-context.tsx`, `src/components/layout/dashboard-layout.tsx`, `src/app/login/page.tsx`, `src/app/admin/rbac/page.tsx`, `src/app/admin/features/page.tsx`

- `proxy.ts`: matcher excludes `/login`, `/store/*`, `/viewer/*`, `/api/*`, `/_next/*`, static files; no `app_session` cookie → redirect to `/login?next=<path>`.
- `AuthContext` exposes `demoMode: boolean`; role switcher, login quick-login cards and "Switch to SaaS Admin" buttons render only when `demoMode`.
- `useAuth().role` is `null` when signed out (no `"merchant"` default); layout redirects to `/login` when `!isLoading && !user`.
- RBAC create-user form posts to `POST /api/admin/users`.
- Registration form offers merchant/customer only.

- [ ] Verify in browser: signed-out `/` → `/login`; `/store/<id>` loads signed out; admin creates user and stays admin.
- [ ] Phase gate: tests, tsc, eslint, reviewer subagent, commit.

---

## Phase 2 — `fix/public-store-data`

### Task 2.1: Public merchant DTO

**Files:** Modify `src/lib/supabase/db.ts:274-356`, `src/app/store/[merchantId]/page.tsx`; Create `src/lib/public-store.ts`; Test `tests/public-store.test.ts`

**Produces:** `toPublicStore(user, products): PublicStore` where `PublicStore = { id, name, businessName: string|null, bio: string|null, whatsappNumber: string|null, location: string|null, followerCount: number, products: PublicProduct[] }` and `PublicProduct = { id, name, category, description, widthMm, depthMm, heightMm, priceBdt: number|null, thumbnailUrl, modelUrl: string|null, aiGenerated: true }`.
- Only `merchantId === user.id && status === "completed"`; no email, attempts, storage paths; no `+128`; unknown merchant → `null` → route 404.

- [ ] Tests: other merchants' products excluded; drafts excluded; zero products → `[]`; output has no `email`/`generationAttempts` keys.

### Task 2.2: No invented contact data or prices

**Files:** Modify `src/lib/whatsapp.ts`, `src/app/store/[merchantId]/page.tsx`, `src/server/app.ts` (`priceBdt` default), tests `tests/core.test.ts` (whatsapp cases)
- `buildProductWhatsAppUrl(rawNumber: string | null, product)` returns `null` when number missing; order button hidden when URL null or price null.
- Remove "Verified Artisan Merchant" badge, fake location, `18500` fallbacks; add visible `AI-generated 3D` badge on store cards.

### Task 2.3: Stop seeding/swallowing in the data layer

**Files:** Modify `src/lib/supabase/db.ts` (`getAllProducts`, `createProduct`, `deleteProduct`, `updateProductStatus`, `addGenerationAttempt`)
- Never write `initialProducts` into the DB; on query error throw.
- Write methods throw on Supabase error; routes return 500 with a clear message.
- [ ] Phase gate.

---

## Phase 3 — `fix/generation-pipeline`

### Task 3.1: Shared guarded generation start + credits

**Files:** Create `src/server/generation.ts`; Modify `src/server/app.ts` (generate, retry, credits), `src/lib/constants.ts`; Test `tests/generation.test.ts`

**Produces:**
- `DEFAULT_CREDIT_ALLOWANCE = 100`.
- `creditCost(product, settings): number` — 10 for single image, `settings.meshyCreditsPerGeneration` otherwise.
- `creditsUsed(products): number` — sum of `creditCostEstimate` for attempts not `failed` with `errorCode` in `CANCELLED_BY_USER | GENERATION_INIT_FAILED | TIMEOUT`.
- `startGeneration(product, settings, used): Promise<Result>` — 409 when latest attempt is `processing|queued`; 402 when `used + cost > allowance`; production + no key → 503 instead of mock.
- `/credits/usage` returns `{ allowance, used, remaining, history }` per merchant, history sorted newest first.

- [ ] Tests: processing → 409 and Meshy mock not called; insufficient credits → 402; cancelled attempts not counted.

### Task 3.2: Cancel, timeout, compare-and-set status

**Files:** Modify `src/server/app.ts` (status, cancel), `src/lib/supabase/db.ts:244` (`updateGenerationAttempt(id, patch, expectedStatus?)` adds `.eq("status", expectedStatus)`)
- Status route: attempt older than `GENERATION_TIMEOUT_MS = 30 * 60_000` → failed `TIMEOUT`; completion writes only if still `processing`.
- Poll error returns `success:false` with 502 after logging, not fake progress.
- [ ] Tests: cancelled attempt not overwritten by a SUCCEEDED poll; stale attempt → failed TIMEOUT.

### Task 3.3: Images to Storage, versioned models, provenance

**Files:** Modify `src/server/app.ts` (`POST /products`), `src/lib/storage/supabase-storage.ts:174-190`, `src/lib/storage/glb-optimizer.ts`, `src/app/viewer/[id]/page.tsx`, `src/app/products/page.tsx`; Test `tests/glb-optimizer.test.ts`
- `POST /products`: decode `data:` URLs server side, accept jpeg/png/webp ≤ 10 MB, upload via `uploadProductImage`, store returned URL/path.
- Model path `models/{productId}/{attemptId}.glb`; viewer cache key `${productId}:${attemptId}`, cache only when `res.ok`.
- `optimizeGlbBuffer(buf, provenance?)` writes `asset.extras.provenance = { aiGenerated: true, provider: "meshy", taskId }`.
- Products page polls `/status` for processing items every 10 s; viewer shows "Simulated model" when `providerTaskId` starts with `mock-`.
- [ ] Phase gate.

---

## Phase 4 — `fix/honest-metrics`

### Task 4.1: Real dashboard and credits figures

**Files:** Modify `src/components/dashboard/section-cards.tsx`, `chart-area-interactive.tsx`, `data-table.tsx`, `src/app/credits/page.tsx`, `src/app/create/page.tsx:712`, `src/app/settings/page.tsx`; Create `src/lib/dashboard-stats.ts`; Test `tests/dashboard-stats.test.ts`
- `computeStats(products) → { total, completed, processing, failed, attempts, successRate: number | null }`; `attemptsByDay(products, days) → { date, completed, failed }[]`.
- Remove trend badges, `96.4`, `|| 6`, `80 / 100`, `~120 seconds`, static chart data, `|| 18500`; empty data shows "—".
- Credits page and create review modal use `/credits/usage` (`remaining`, per-mode cost).
- Settings: load before render, drop fake defaults and the unsaved `defaultGenerationPipeline`, integration badges reflect `meshyApiKey` presence, no Supabase project ref.
- [ ] Phase gate.

---

## Phase 5 — `fix/ux-a11y-3d`

### Task 5.1: Layout, loading and error states
- `globals.css`: drop `overflow: hidden` on `html, body`; the dashboard shell keeps its own `h-screen overflow-hidden`.
- Add `src/app/loading.tsx`, `src/app/error.tsx`, `src/app/not-found.tsx`.
- RBAC/features pages wait for `isLoading`; features context exposes `loaded` and pages gate on it; confirm before role change and suspend.

### Task 5.2: 3D viewer and editor robustness
- `model-viewer.tsx`: dispose textures, ground, environment; `renderer.forceContextLoss()`; `ResizeObserver` on container.
- `scene-editor.tsx`: Delete only when focus is inside the canvas wrapper; `beforeunload` warning when dirty.
- `rules.ts`: new item with `asset.hidden` → error `asset_hidden`; test in `tests/scenes.test.ts`.
- Viewer canvas shows visible `AI-generated 3D model` badge.

### Task 5.3: Accessibility, lint, cleanup
- `htmlFor`/`id` on login and RBAC forms; `aria-label` on pagination and icon buttons; no `<Button>` inside `<Link>`.
- `eslint.config.mjs`: ignore `public/**`; remove unused imports.
- Delete unused `src/components/layout/sidebar.tsx`, `header.tsx`; brand name "Artisan 3D" in metadata and login.
- Replace arbitrary `[Npx]` classes with nearest scale values in touched files.
- [ ] Final gate: full tests, tsc, eslint, browser check of `/`, `/login`, `/products`, `/create`, `/store/<id>`, `/viewer/<id>`, whole-stack review subagent.
