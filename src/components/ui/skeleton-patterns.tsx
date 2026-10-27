import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingRegion({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function StatCardsSkeleton() {
  return (
    <LoadingRegion label="Loading stats" className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="space-y-3 p-5 shadow-xs">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </Card>
      ))}
    </LoadingRegion>
  );
}

export function ChartSkeleton() {
  return (
    <LoadingRegion label="Loading chart">
      <Card className="space-y-4 p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-48 rounded-full" />
        </div>
        <div className="flex h-56 items-end gap-2">
          {[40, 65, 30, 80, 55, 70, 45, 90, 35, 60, 75, 50].map((h, i) => (
            <Skeleton key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${h}%` }} />
          ))}
        </div>
      </Card>
    </LoadingRegion>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <LoadingRegion label="Loading products" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="space-y-3 bg-white p-4">
          <Skeleton className="aspect-4/3 w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </Card>
      ))}
    </LoadingRegion>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <LoadingRegion label="Loading table">
      <Card className="divide-y divide-stone-100 p-0">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-1/5" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </Card>
    </LoadingRegion>
  );
}

export function FormSkeleton() {
  return (
    <LoadingRegion label="Loading form" className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-9 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </LoadingRegion>
  );
}

export function ViewerSkeleton() {
  return (
    <LoadingRegion label="Loading product" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-140 rounded-2xl lg:col-span-2" />
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    </LoadingRegion>
  );
}

export { StorefrontSkeleton } from "@/components/store/storefront-skeleton";
