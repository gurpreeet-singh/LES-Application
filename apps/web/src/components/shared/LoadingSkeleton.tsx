export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-5 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <div key={i} className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-${count} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4 animate-pulse text-center">
          <div className="h-7 bg-gray-200 rounded w-12 mx-auto mb-2" />
          <div className="h-3 bg-gray-200 rounded w-16 mx-auto" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="card p-4 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-48 mb-4" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-3">
            <div className="h-3 bg-gray-200 rounded w-24" />
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="h-3 bg-gray-200 rounded w-12" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-6 bg-gray-200 rounded w-64 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-32" />
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card p-4">
            <div className="h-7 bg-gray-200 rounded w-12 mx-auto mb-2" />
            <div className="h-3 bg-gray-200 rounded w-16 mx-auto" />
          </div>
        ))}
      </div>
      <div className="card p-5">
        <div className="h-4 bg-gray-200 rounded w-48 mb-4" />
        <div className="h-24 bg-gray-200 rounded" />
      </div>
    </div>
  );
}
