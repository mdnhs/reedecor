# Minimal Merchant 3D Studio

A minimal, functional full-stack web application tailored for furniture merchants. Merchants upload product photographs from 4 distinct perspective angles (Front, Back, Left, Right), generate textured 3D models using **Meshy AI Multi-Image to 3D API**, inspect models interactively in a real-time WebGL studio, and download the resulting `.glb` file.

---

## 🛠️ Technology Stack

- **Frontend:** Next.js (App Router), React, TypeScript
- **Styling:** Tailwind CSS, shadcn/ui design tokens, Lucide React
- **Backend API:** Hono.js (TypeScript) mounted via Next.js App Router API route handlers (`/api/[...route]`)
- **Database:** Supabase PostgreSQL with Drizzle ORM
- **Media & Model Storage:** Supabase Storage (with client IndexedDB fallback cache)
- **Authentication:** Better Auth (Drizzle PostgreSQL Adapter) with instant Demo Merchant mode
- **3D Viewer:** Three.js + React Three Fiber / Drei (WebGL OrbitControls, PBR materials, soft floor shadows)
- **3D AI Provider:** Meshy AI Multi-Image to 3D API (`should_texture: true`, `texture_resolution: "2k"`, `enable_pbr: true`)
- **Validation:** Zod
- **Testing:** Vitest
- **Package Manager:** pnpm

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Set your credentials in `.env`:
```env
# Supabase Database (Drizzle ORM)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.aafouqxsgibfqjcxozii.supabase.co:5432/postgres

# Supabase Storage & Client
NEXT_PUBLIC_SUPABASE_URL=https://aafouqxsgibfqjcxozii.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_STORAGE_BUCKET=furniture-3d-studio

# Meshy AI Multi-Image API
MESHY_API_KEY=your_meshy_api_key
MESHY_API_BASE_URL=https://api.meshy.ai
MESHY_MODEL=meshy-7.1
MESHY_TEXTURE_RESOLUTION=2k
MESHY_CREDITS_PER_GENERATION=20

# Currency & Costing
USD_TO_BDT_RATE=122.50
COST_PER_CREDIT_USD=0.05
```

> **Note:** If API keys are not supplied, the studio automatically runs in offline development simulation mode with instant 3D model previews and demo catalogue data!

### 3. Database Migrations (Drizzle ORM)
Generate and push migrations to Supabase PostgreSQL:
```bash
pnpm drizzle-kit push
```

### 4. Run Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Automated Tests & Typecheck
```bash
pnpm test          # Runs Vitest unit tests (dimensions, BDT currency, 4-angle validation)
pnpm tsc --noEmit  # Strict TypeScript check
pnpm lint          # ESLint rules check
pnpm build         # Production Next.js build
```

---

## 📐 Application Architecture & Pages

1. **Overview (`/`):** Live metrics (Total Products, Generated 3D, In Progress, Failed) and Recent Products grid with 3D studio links.
2. **My Products (`/products`):** Searchable catalogue with category filter (Chair, Sofa, Table, etc.), status filter, and safe deletion.
3. **Create 3D Model (`/create`):**
   - Physical dimensions input with automatic normalization to millimeters (`mm`).
   - 4-slot dedicated image uploader: Front, Back, Left, Right with drag-and-drop, preview, and duplicate angle warning.
   - Pre-generation review modal showing 4-angle grid and credit estimation.
4. **Interactive 3D Studio (`/viewer/[id]`):**
   - WebGL 3D canvas featuring smooth OrbitControls, 360° rotation, zoom in/out, camera reset, and background toggle.
   - Side-by-side comparison with the 4 source photographs.
   - Live status polling with progress bar during generation.
   - Direct **Download GLB** button and **Generate Again** retry flow.
5. **Credits & Usage (`/credits`):** Generation attempts history, total credits consumed, and live cost calculation in Bangladeshi Taka (BDT).
6. **Settings (`/settings`):** Active merchant profile and cloud provider statuses.

---

## 🔒 Security & Privacy

- `MESHY_API_KEY` and Supabase Service Role keys are strictly kept on the server side in Hono route handlers and never leaked to client bundles.
- Images and GLB models are cached in local browser IndexedDB to prevent memory leaks and provide offline resilience.
