"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div role="alert" className="glass-panel w-full max-w-md space-y-4 rounded-3xl p-8 text-center">
        <h1 className="font-display text-xl font-bold text-stone-900">Something went wrong</h1>
        <p className="text-sm text-stone-500">The page could not be loaded. Try again, or go back to the studio.</p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => retry()}
            className="bg-gradient-brand rounded-full px-5 py-2 text-sm font-semibold text-white"
          >
            Try again
          </button>
          <Link href="/" className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-stone-700">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
