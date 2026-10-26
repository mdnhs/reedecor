"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, Eye, ChevronLeft, ChevronRight, Box } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

  return (
    <Card className="bg-white border-stone-200/80 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold text-stone-900">
              Furniture Catalog & 3D Assets
            </CardTitle>
            <CardDescription className="text-xs text-stone-500">
              Interactive 3D GLB assets reconstructed from multi-angle photographs
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                aria-label="Filter furniture"
                placeholder="Filter furniture..."
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-stone-900 bg-stone-50/50 w-44 sm:w-56"
              />
            </div>

            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-50/50 text-stone-700 focus:outline-hidden"
            >
              <option value="all">All Categories</option>
              <option value="chair">Chairs</option>
              <option value="sofa">Sofas</option>
              <option value="table">Tables</option>
              <option value="bed">Beds</option>
              <option value="cabinet">Cabinets</option>
            </select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-xl border border-stone-200/80 overflow-hidden bg-white">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/60 text-stone-600 font-semibold">
                <th className="py-3 px-4">Item</th>
                <th className="py-3 px-4 hidden sm:table-cell">Category</th>
                <th className="py-3 px-4 hidden md:table-cell">Scale (W × D × H)</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">3D Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-400">
                    No furniture items match your search.
                  </td>
                </tr>
              ) : (
                paginated.map((product) => (
                  <tr key={product.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-stone-100 border border-stone-200 overflow-hidden shrink-0">
                          {getProductThumbnail(product) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={getProductThumbnail(product)}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-stone-400">
                              <Box className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-stone-900">{product.name}</p>
                          <p className="text-xs text-stone-500 font-mono">
                            {product.images.length}/4 angles captured
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 hidden sm:table-cell font-medium text-stone-600">
                      {product.category}
                    </td>

                    <td className="py-3 px-4 hidden md:table-cell font-medium text-stone-700">
                      {formatDimension(product.widthMm)} × {formatDimension(product.depthMm)} ×{" "}
                      {formatDimension(product.heightMm)}
                    </td>

                    <td className="py-3 px-4 font-bold text-stone-900 font-mono">
                      {product.priceBdt > 0 ? `৳${product.priceBdt.toLocaleString("en-BD")}` : "Price not set"}
                    </td>

                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          product.status === "completed"
                            ? "success"
                            : product.status === "processing"
                            ? "processing"
                            : product.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {product.status === "completed"
                          ? "● 3D Ready"
                          : product.status === "processing"
                          ? "Processing"
                          : product.status === "failed"
                          ? "Failed"
                          : "Draft"}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/viewer/${product.id}`}
                        className={cn(
                          buttonVariants({
                            size: "sm",
                            variant: product.status === "completed" ? "default" : "outline",
                          }),
                          "gap-1.5 text-xs h-7.5",
                          product.status === "completed"
                            ? "bg-amber-700 hover:bg-amber-800 text-white shadow-2xs font-semibold"
                            : "border-stone-200 text-stone-700 hover:bg-stone-100"
                        )}
                      >
                        <Eye className="h-3 w-3" />
                        <span>{product.status === "completed" ? "3D Studio" : "Inspect"}</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between pt-4 text-xs text-stone-500">
          <span>
            Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to{" "}
            <strong>{Math.min(currentPage * pageSize, filtered.length)}</strong> of{" "}
            <strong>{filtered.length}</strong> items
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              aria-label="Previous page"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="font-semibold text-stone-800 px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              aria-label="Next page"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
