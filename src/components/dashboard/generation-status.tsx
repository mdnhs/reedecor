"use client";

import React from "react";
import { StoredProduct } from "@/server/demo-store";

const STATUS_GROUPS = [
  { label: "Ready", statuses: ["completed"], bar: "bg-emerald-400" },
  { label: "Processing", statuses: ["processing", "queued"], bar: "bg-amber-500" },
  { label: "Drafts", statuses: ["draft"], bar: "bg-sky-400" },
  { label: "Failed", statuses: ["failed"], bar: "bg-rose-400" },
] as const;

export function GenerationStatus({ products, loading }: { products: StoredProduct[]; loading: boolean }) {
  const total = products.length;
  const groups = STATUS_GROUPS.map((group) => ({
    ...group,
    count: products.filter((p) => (group.statuses as readonly string[]).includes(p.status)).length,
  }));

  return (
    <section className="rounded-3xl bg-white/70 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-bold">Generation Status</h2>
        <span className="text-xs text-stone-500">{loading ? "…" : `${total} product${total === 1 ? "" : "s"}`}</span>
      </div>

      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-stone-100">
        {!loading &&
          total > 0 &&
          groups.map((group) =>
            group.count > 0 ? (
              <div
                key={group.label}
                className={group.bar}
                style={{ width: `${(group.count / total) * 100}%` }}
              />
            ) : null
          )}
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2">
        {groups.map((group) => (
          <li key={group.label} className="rounded-2xl bg-white/80 px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-xs text-stone-500">
              <span className={`h-2 w-2 rounded-full ${group.bar}`} />
              {group.label}
            </span>
            <p className="mt-1 font-display text-xl font-bold tabular-nums">{loading ? "–" : group.count}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
