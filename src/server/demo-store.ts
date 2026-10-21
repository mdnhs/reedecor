export interface StoredProduct {
  id: string;
  merchantId: string;
  name: string;
  category: string;
  description?: string | null;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  priceBdt: number;
  status: "draft" | "queued" | "processing" | "completed" | "failed";
  generationMode?: "image_to_3d" | "multi_image_to_3d";
  createdAt: string;
  updatedAt: string;
  images: Array<{
    id: string;
    viewType: "front" | "back" | "left" | "right" | "single";
    publicUrl: string;
    storagePath: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
  }>;
  generationAttempts: Array<{
    id: string;
    provider: string;
    providerTaskId?: string | null;
    status: "queued" | "processing" | "completed" | "failed";
    modelUrl?: string | null;
    creditCostEstimate: number;
    errorCode?: string | null;
    errorMessage?: string | null;
    createdAt: string;
    completedAt?: string | null;
  }>;
}

// Initial seed demo products representing furniture merchant studio catalog
export const initialProducts: StoredProduct[] = [
  {
    id: "prod-sheen-chair-01",
    merchantId: "demo-merchant-001",
    name: "Velvet Sheen Accent Chair",
    category: "Chair",
    description: "Modern curved accent armchair with plush velvet upholstery and matte black metal legs.",
    widthMm: 850,
    depthMm: 780,
    heightMm: 820,
    priceBdt: 32500,
    status: "completed",
    createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    images: [
      {
        id: "img-chair-front",
        viewType: "front",
        publicUrl: "https://images.unsplash.com/photo-1580481077195-c328ad4f4f79?w=800&auto=format&fit=crop",
        storagePath: "products/prod-sheen-chair-01/front.jpg",
        fileName: "chair_front.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: 420000,
      },
      {
        id: "img-chair-back",
        viewType: "back",
        publicUrl: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=800&auto=format&fit=crop",
        storagePath: "products/prod-sheen-chair-01/back.jpg",
        fileName: "chair_back.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: 395000,
      },
      {
        id: "img-chair-left",
        viewType: "left",
        publicUrl: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&auto=format&fit=crop",
        storagePath: "products/prod-sheen-chair-01/left.jpg",
        fileName: "chair_left.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: 412000,
      },
      {
        id: "img-chair-right",
        viewType: "right",
        publicUrl: "https://images.unsplash.com/photo-1580481077195-c328ad4f4f79?w=800&auto=format&fit=crop",
        storagePath: "products/prod-sheen-chair-01/right.jpg",
        fileName: "chair_right.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: 430000,
      },
    ],
    generationAttempts: [
      {
        id: "gen-01",
        provider: "meshy",
        providerTaskId: "meshy-task-verified-01",
        status: "completed",
        modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SheenChair/glTF-Binary/SheenChair.glb",
        creditCostEstimate: 20,
        createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
        completedAt: new Date(Date.now() - 3600000 * 24 * 3 + 120000).toISOString(),
      },
    ],
  },
  {
    id: "prod-nordic-table-02",
    merchantId: "demo-merchant-001",
    name: "Nordic Minimalist Coffee Table",
    category: "Table",
    description: "Solid natural oak oval coffee table with organic tapered cylindrical legs.",
    widthMm: 1200,
    depthMm: 600,
    heightMm: 450,
    priceBdt: 45000,
    status: "completed",
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 11).toISOString(),
    images: [
      {
        id: "img-table-front",
        viewType: "front",
        publicUrl: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=800&auto=format&fit=crop",
        storagePath: "products/prod-nordic-table-02/front.jpg",
        fileName: "table_front.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: 380000,
      },
      {
        id: "img-table-back",
        viewType: "back",
        publicUrl: "https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=800&auto=format&fit=crop",
        storagePath: "products/prod-nordic-table-02/back.jpg",
        fileName: "table_back.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: 360000,
      },
      {
        id: "img-table-left",
        viewType: "left",
        publicUrl: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=800&auto=format&fit=crop",
        storagePath: "products/prod-nordic-table-02/left.jpg",
        fileName: "table_left.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: 375000,
      },
      {
        id: "img-table-right",
        viewType: "right",
        publicUrl: "https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=800&auto=format&fit=crop",
        storagePath: "products/prod-nordic-table-02/right.jpg",
        fileName: "table_right.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: 370000,
      },
    ],
    generationAttempts: [
      {
        id: "gen-02",
        provider: "meshy",
        providerTaskId: "meshy-task-verified-02",
        status: "completed",
        modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SheenChair/glTF-Binary/SheenChair.glb",
        creditCostEstimate: 20,
        createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        completedAt: new Date(Date.now() - 3600000 * 12 + 150000).toISOString(),
      },
    ],
  },
];

// Memory store instance
const globalStore = globalThis as unknown as {
  productsStore?: StoredProduct[];
};

if (!globalStore.productsStore) {
  globalStore.productsStore = [...initialProducts];
}

export const inMemoryStore = {
  getAll: () => globalStore.productsStore ?? [],
  getById: (id: string) => globalStore.productsStore?.find((p) => p.id === id) ?? null,
  add: (product: StoredProduct) => {
    globalStore.productsStore = [product, ...(globalStore.productsStore ?? [])];
  },
  update: (id: string, updateFn: (p: StoredProduct) => StoredProduct) => {
    globalStore.productsStore = (globalStore.productsStore ?? []).map((p) =>
      p.id === id ? updateFn(p) : p
    );
  },
  delete: (id: string) => {
    globalStore.productsStore = (globalStore.productsStore ?? []).filter((p) => p.id !== id);
  },
};
