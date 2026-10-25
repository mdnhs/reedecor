import { z } from "zod";
import { MAX_OFFSET_CM, MAX_SCENE_ITEMS, SCALE_RANGE } from "./types";

const offset = z.number().finite().min(-MAX_OFFSET_CM).max(MAX_OFFSET_CM);

export const sceneItemSchema = z.object({
  id: z.string().min(1).max(64),
  assetId: z.string().min(1),
  versionId: z.string().min(1),
  x: offset,
  z: offset,
  rotationY: z.number().finite(),
  scale: z.number().finite().min(SCALE_RANGE.min).max(SCALE_RANGE.max),
});

export const sceneSchema = z.object({
  schemaVersion: z.literal(1),
  backdrop: z.enum(["auto", "studio", "white", "transparent"]),
  items: z
    .array(sceneItemSchema)
    .max(MAX_SCENE_ITEMS)
    .refine((items) => new Set(items.map((i) => i.id)).size === items.length, {
      message: "Item ids must be unique",
    }),
});
