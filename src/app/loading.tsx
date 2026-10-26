export default function Loading() {
  return (
    <div className="flex h-dvh items-center justify-center" role="status" aria-live="polite">
      <div className="glass-panel flex items-center gap-3 rounded-2xl px-5 py-3 text-sm text-stone-600">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
        Loading…
      </div>
    </div>
  );
}
