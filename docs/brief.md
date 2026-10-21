# Minimal Merchant 3D Studio — Project Brief

## 1. Executive Summary & Vision

The **Minimal Merchant 3D Studio** is a focused, high-precision SaaS platform built specifically for furniture merchants and manufacturers. It enables merchants to transform standard 4-angle product photographs into textured, dimensionally accurate, production-ready 3D interactive models (`.glb`) powered by **Meshy AI Multi-Image to 3D API**.

Merchants can inspect 3D models interactively in a real-time WebGL studio (360° orbit, zoom, pan, lighting controls) and download the `.glb` files for e-commerce listings, AR previews, or digital catalogs.

---

## 2. Core Architecture & Technology Stack

| Layer | Technology | Rationale & Specifications |
| :--- | :--- | :--- |
| **Framework** | **Next.js (App Router)** | Server Components, fast streaming, modern React 19/18 ecosystem, TypeScript. |
| **Styling & Design System** | **Tailwind CSS + shadcn/ui** | Clean, minimalist, sophisticated merchant UI. Dark charcoal typography, warm neutral backgrounds, subtle borders, restrained shadows. |
| **Icons** | **Lucide React** | Consistent, modern iconography. |
| **Backend API Layer** | **Hono.js (TypeScript)** | Ultra-fast, lightweight, type-safe API routing integrated seamlessly with Next.js route handlers (`/api/[...route]`). |
| **Database & ORM** | **Supabase PostgreSQL + Drizzle ORM** | Cloud-native serverless PostgreSQL with Drizzle ORM for type-safe schema, relational queries, and automated migrations. |
| **Media & Model Storage** | **Supabase Storage** | Reliable cloud object storage for the 4 source photographs (Front, Back, Left, Right) and generated `.glb` 3D models with persistent public URLs. |
| **Authentication** | **Better Auth** | Modern TypeScript authentication engine backed by Drizzle ORM adapter. Supports credentials, sessions, and a pre-configured **One-Click Demo Merchant** profile. |
| **3D Engine** | **Three.js + React Three Fiber / Drei** | WebGL 3D rendering studio featuring OrbitControls, realistic PBR materials, soft shadows, studio lighting, camera reset, and dimension inspection. |
| **AI 3D Generation** | **Meshy AI Multi-Image to 3D API** | `POST /openapi/v1/multi-image-to-3d` pipeline using 4 perspective images, standard geometry, `should_texture: true`, `texture_resolution: "2k"` (or `"4k"`), and `enable_pbr: true`. |
| **Validation** | **Zod** | End-to-end schema validation on both client forms and server endpoints. |
| **Package Manager** | **pnpm** | Fast, deterministic dependency management. |

---

## 3. Product Features & Modules

### 3.1. Merchant Dashboard & Shell
- **Responsive Layout:** Desktop sidebar with collapsed mobile drawer.
- **Top Navigation Bar:** Demo merchant profile avatar, live remaining demo credits, quick **"Create 3D Model"** action button, and breadcrumbs.
- **Navigation Sections:**
  1. **Overview:** Metric cards (Total Products, Generated 3D Models, In Progress, Failed Generations) and Recent Products grid.
  2. **My Products:** Searchable, filterable catalogue of merchant products with 3D status badges, preview shortcuts, and deletion safety dialogs.
  3. **Create 3D Model:** Dedicated 4-angle upload wizard.
  4. **Credits & Usage:** Usage analytics, generation history, credit consumption, and estimated costs in BDT (Bangladeshi Taka).
  5. **Settings:** Merchant preferences and environment status.

### 3.2. Product Creation & 4-Angle Upload Wizard
- **Product Information:**
  - Product Name (Required)
  - Category (Chair, Sofa, Table, Bed, Cabinet, Home Decor, Other)
  - Description (Optional)
  - Real-world Dimensions: Width, Depth, Height (validated positive numbers, normalized and stored in **millimeters** `mm`).
- **4-Angle Dedicated Upload Zones:**
  1. Front View
  2. Back View
  3. Left View
  4. Right View
- **Dropzone Capabilities:** Drag-and-drop, native file picker, preview thumbnail, file replacement/deletion, file format verification (`image/jpeg`, `image/png`, `image/webp`), max 20MB per image, duplicate image warning.
- **Pre-Generation Review Modal:**
  - Summary of dimensions and views.
  - Estimated Meshy API credits cost.
  - One-click confirmation with duplicate click prevention.

### 3.3. Meshy AI Generation Pipeline
- **Security:** `MESHY_API_KEY` is strictly confined to server-side Hono handlers.
- **Lifecycle Flow:**
  1. `queued`: Task created and logged in PostgreSQL.
  2. Submitting 4 public image URLs from Supabase Storage to Meshy API.
  3. `processing`: Provider task ID saved; backend polling with exponential backoff and rate-limit compliance.
  4. `completed`: Fetching generated `.glb` model, storing it into Supabase Storage, and updating the database.
  5. `failed`: Safe error reporting with granular error codes; dedicated **"Retry Generation"** action creating a new traceable attempt.

### 3.4. Interactive 3D Studio Viewer
- Real-time GLB loading with progress indicators and error boundaries.
- **Controls:** Orbit (360° rotation), Zoom (in/out), Pan, Camera Reset, Fit to View.
- **Visuals:** Studio lighting setup, realistic reflections, floor shadow, toggleable neutral/transparent background.
- **Actions:** Prominent **Download GLB** action and direct **Generate Again** trigger.
- **Resource Management:** Automatic cleanup (`dispose()`) of Three.js geometry, materials, and textures to prevent browser memory leaks.

---

## 4. Database Schema (Drizzle ORM)

```sql
-- Users (Better Auth)
users (id, name, email, role, created_at, updated_at)

-- Products
products (
  id UUID PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  width_mm INTEGER NOT NULL,
  depth_mm INTEGER NOT NULL,
  height_mm INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, queued, processing, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

-- Product Images (4 angles per product)
product_images (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  view_type TEXT NOT NULL, -- 'front', 'back', 'left', 'right'
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

-- Generation Attempts (Audit log of all 3D generations)
generation_attempts (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'meshy',
  provider_task_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed
  model_url TEXT,
  credit_cost_estimate NUMERIC(6, 2) DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
)
```

---

## 5. Environment Variables Specification

```env
# Application Base
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Better Auth Configuration
BETTER_AUTH_SECRET=your_better_auth_secret_32_chars_min
BETTER_AUTH_URL=http://localhost:3000

# Supabase (PostgreSQL via Drizzle ORM)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres

# Supabase Storage & SDK
NEXT_PUBLIC_SUPABASE_URL=https://[REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_STORAGE_BUCKET=furniture-3d-studio

# Meshy AI Configuration
MESHY_API_KEY=your_meshy_api_key
MESHY_API_BASE_URL=https://api.meshy.ai
MESHY_MODEL=meshy-7.1 # or standard multi-image-to-3d
MESHY_GEOMETRY_RESOLUTION=standard
MESHY_TEXTURE_RESOLUTION=2k
MESHY_CREDITS_PER_GENERATION=20

# Economics & Currency Rates
USD_TO_BDT_RATE=122.50
COST_PER_CREDIT_USD=0.05
```
