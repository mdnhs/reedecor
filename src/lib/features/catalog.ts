export const FEATURE_KEYS = [
  "model_generation",
  "scene_editor",
  "room_builder",
  "customer_scene_view",
  "capture_thumbnails",
  "backdrop_menu",
  "wishlist",
  "whatsapp_contact",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type FeatureFlags = Record<FeatureKey, boolean>;
export type FeatureGroup = "Models" | "Room studio" | "Viewer" | "Shopping";

export interface FeatureDefinition {
  key: FeatureKey;
  label: string;
  description: string;
  group: FeatureGroup;
}

export const featureOffMessage = "This feature is turned off by the administrator.";

export const FEATURES: FeatureDefinition[] = [
  {
    key: "model_generation",
    label: "3D model generation",
    description: "Create 3D Model page, product creation, generate and retry. Existing models stay viewable.",
    group: "Models",
  },
  {
    key: "scene_editor",
    label: "Room scene editor",
    description: "Merchants place room assets around a product and save the scene.",
    group: "Room studio",
  },
  {
    key: "room_builder",
    label: "Room walls and floor",
    description: "The Room panel and the rendering of walls and floor. Saved rooms are kept while this is off.",
    group: "Room studio",
  },
  {
    key: "customer_scene_view",
    label: "Styled scenes for customers",
    description: "Customers see the merchant's saved scene around the product.",
    group: "Room studio",
  },
  {
    key: "capture_thumbnails",
    label: "Screenshot capture and thumbnails",
    description: "Capture button, Use as thumbnail and the automatic first-frame thumbnail.",
    group: "Viewer",
  },
  {
    key: "backdrop_menu",
    label: "Backdrop menu",
    description: "The Backdrop control in the 3D viewer.",
    group: "Viewer",
  },
  {
    key: "wishlist",
    label: "Wishlist",
    description: "Heart buttons and the wishlist API.",
    group: "Shopping",
  },
  {
    key: "whatsapp_contact",
    label: "WhatsApp contact buttons",
    description: "WhatsApp buttons on product cards and the viewer.",
    group: "Shopping",
  },
];

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as readonly string[]).includes(value);
}

export function resolveFlags(rows: { key: string; enabled: boolean }[]): FeatureFlags {
  const flags = Object.fromEntries(FEATURE_KEYS.map((key) => [key, true])) as FeatureFlags;
  for (const row of rows) {
    if (isFeatureKey(row.key)) flags[row.key] = row.enabled;
  }
  return flags;
}
