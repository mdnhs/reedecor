"use client";

import { useCallback, useEffect, useState } from "react";
import { MAX_ASSET_BYTES } from "@/lib/assets/validation";
import { renderGlbPreview } from "@/lib/assets/render-preview";
import { errorText } from "./api";
import type { SizeValues } from "./size-fields";

const EMPTY_SIZE: SizeValues = { width: "", depth: "", height: "" };

export function useGlbPicker() {
  const [file, setFile] = useState<File | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [size, setSize] = useState<SizeValues>(EMPTY_SIZE);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  const setPreview = useCallback((blob: Blob | null) => {
    setPreviewBlob(blob);
    setPreviewUrl(blob ? URL.createObjectURL(blob) : null);
  }, []);

  const pick = useCallback(
    async (picked: File | null) => {
      setError(null);
      setFile(picked);
      setPreview(null);
      if (!picked) return;

      if (picked.size > MAX_ASSET_BYTES * 10) {
        setError("File is very large. Assets must be under 2 MB after optimization.");
      }

      setRendering(true);
      try {
        const rendered = await renderGlbPreview(picked);
        setPreview(rendered.blob);
        setSize({
          width: String(rendered.dimensionsCm.width),
          depth: String(rendered.dimensionsCm.depth),
          height: String(rendered.dimensionsCm.height),
        });
      } catch (err) {
        setError(errorText(err));
      } finally {
        setRendering(false);
      }
    },
    [setPreview]
  );

  const reset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setSize(EMPTY_SIZE);
    setError(null);
  }, [setPreview]);

  return { file, previewBlob, previewUrl, size, setSize, rendering, error, pick, setPreview, reset };
}

export function sizeIsValid(size: SizeValues): boolean {
  return [size.width, size.depth, size.height].every((v) => {
    const n = Number(v);
    return n > 0 && n <= 1000;
  });
}
