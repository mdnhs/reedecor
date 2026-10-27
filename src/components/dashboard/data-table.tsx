"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, Eye, ChevronLeft, ChevronRight, Box } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { StoredProduct } from "@/server/demo-store";
import { cn, formatDimension } from "@/lib/utils";
import { getProductThumbnail } from "@/lib/product-thumbnail";

interface DataTableProps {
  products: StoredProduct[];
}

export function DataTable({ products }: DataTableProps) {
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const filtered = products.filter((p) => {
    const matchesQuery =
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.category.toLowerCase().includes(filter.toLowerCase());
    const matchesCategory = categoryFilter === "all" || p.category.toLowerCase() === categoryFilter.toLowerCase();
    return matchesQuery && matchesCategory;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const from = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, filtered.length);

  return (
    <section className="space-y-4" aria-label="Furniture catalog">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-stone-900">Catalog</h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Filter furniture"
              placeholder="Search"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 w-full rounded-lg border border-stone-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 sm:w-56"
            />
          </div>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-900"
          >
            <option value="all">All</option>
            <option value="chair">Chairs</option>
            <option value="sofa">Sofas</option>
            <option value="table">Tables</option>
            <option value="bed">Beds</option>
            <option value="cabinet">Cabinets</option>
          </select>
        </div>
      </div>

      {paginated.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-center">
          <Box className="mx-auto h-8 w-8 text-stone-400" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-stone-900">No results</p>
        </div>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-2xl bg-white studio-card-shadow">
          {paginated.map((product) => {
            const thumbnail = getProductThumbnail(product);
            const ready = product.status === "completed";
            return (
              <li key={product.id} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                  {thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbnail} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-stone-400">
                      <Box className="h-5 w-5" aria-hidden="true" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-900">{product.name}</p>
                  <p className="truncate text-xs text-stone-500">
                    {product.category} · {formatDimension(product.widthMm)} ×{" "}
                    {formatDimension(product.depthMm)} × {formatDimension(product.heightMm)}
                  </p>
                </div>

                <span className="hidden font-mono text-sm font-semibold text-stone-900 sm:block">
                  {product.priceBdt > 0 ? `৳${product.priceBdt.toLocaleString("en-BD")}` : "—"}
                </span>

                <Badge
                  variant={
                    ready
                      ? "success"
                      : product.status === "processing"
                      ? "processing"
                      : product.status === "failed"
                      ? "destructive"
                      : "secondary"
                  }
                  className="hidden sm:inline-flex"
                >
                  {ready
                    ? "3D Ready"
                    : product.status === "processing"
                    ? "Processing"
                    : product.status === "failed"
                    ? "Failed"
                    : "Draft"}
                </Badge>

                <Link
                  href={`/viewer/${product.id}`}
                  aria-label={`${ready ? "Open 3D studio for" : "Inspect"} ${product.name}`}
                  className={cn(
                    buttonVariants({ size: "sm", variant: ready ? "default" : "outline" }),
                    "h-8 gap-1.5 text-xs",
                    ready ? "bg-gradient-brand text-white" : "border-stone-200 text-stone-700"
                  )}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">{ready ? "Open" : "Inspect"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-between text-xs text-stone-500">
        <span>
          {from}–{to} of {filtered.length}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            aria-label="Previous page"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span aria-live="polite">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            aria-label="Next page"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
