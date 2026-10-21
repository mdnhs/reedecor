import { openDB, DBSchema, IDBPDatabase } from "idb";

interface MerchantStudioDB extends DBSchema {
  images: {
    key: string; // `${productId}_${viewType}`
    value: {
      key: string;
      productId: string;
      viewType: string;
      blob: Blob;
      fileName: string;
      mimeType: string;
      updatedAt: number;
    };
  };
  models: {
    key: string; // productId
    value: {
      key: string;
      productId: string;
      blob: Blob;
      fileName: string;
      updatedAt: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<MerchantStudioDB>> | null = null;

function getDB() {
  if (typeof window === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB<MerchantStudioDB>("merchant-3d-studio-cache", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("images")) {
          db.createObjectStore("images", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("models")) {
          db.createObjectStore("models", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveProductImageToIDB(
  productId: string,
  viewType: "front" | "back" | "left" | "right",
  blob: Blob,
  fileName: string,
  mimeType: string
): Promise<void> {
  const db = await getDB();
  if (!db) return;
  const key = `${productId}_${viewType}`;
  await db.put("images", {
    key,
    productId,
    viewType,
    blob,
    fileName,
    mimeType,
    updatedAt: Date.now(),
  });
}

export async function getProductImageFromIDB(
  productId: string,
  viewType: string
): Promise<{ blob: Blob; fileName: string; mimeType: string } | null> {
  const db = await getDB();
  if (!db) return null;
  const key = `${productId}_${viewType}`;
  const record = await db.get("images", key);
  if (!record) return null;
  return {
    blob: record.blob,
    fileName: record.fileName,
    mimeType: record.mimeType,
  };
}

export async function saveGeneratedModelToIDB(
  productId: string,
  blob: Blob,
  fileName: string = "model.glb"
): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.put("models", {
    key: productId,
    productId,
    blob,
    fileName,
    updatedAt: Date.now(),
  });
}

export async function getGeneratedModelFromIDB(
  productId: string
): Promise<{ blob: Blob; fileName: string } | null> {
  const db = await getDB();
  if (!db) return null;
  const record = await db.get("models", productId);
  if (!record) return null;
  return {
    blob: record.blob,
    fileName: record.fileName,
  };
}

export async function deleteProductAssetsFromIDB(productId: string): Promise<void> {
  const db = await getDB();
  if (!db) return;
  const tx = db.transaction(["images", "models"], "readwrite");
  const views = ["front", "back", "left", "right"];
  for (const v of views) {
    await tx.objectStore("images").delete(`${productId}_${v}`);
  }
  await tx.objectStore("models").delete(productId);
  await tx.done;
}
