import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

export function useOrigin(): string {
  return useSyncExternalStore(
    emptySubscribe,
    () => (typeof window !== "undefined" ? window.location.origin : ""),
    () => ""
  );
}
