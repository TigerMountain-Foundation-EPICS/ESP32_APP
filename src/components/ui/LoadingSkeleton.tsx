export const LoadingSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="space-y-2" aria-hidden>
    {Array.from({ length: rows }).map((_, index) => (
      <div
        key={index}
        className="h-5 w-full animate-pulse rounded-md bg-slate-200"
        style={{ width: `${100 - index * 8}%` }}
      />
    ))}
  </div>
);
