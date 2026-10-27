import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md space-y-4 rounded-3xl p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">404</p>
        <h1 className="font-display text-xl font-bold text-stone-900">Page not found</h1>
        <p className="text-sm text-stone-500">This page does not exist or has moved.</p>
        <Link
          href="/"
          className="bg-gradient-brand inline-flex rounded-full px-5 py-2 text-sm font-semibold text-white"
        >
          Back to the shop
        </Link>
      </div>
    </div>
  );
}
