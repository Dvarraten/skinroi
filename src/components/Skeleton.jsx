// Loading placeholders shown on Home while the portfolio loads, so the page
// doesn't flash "No active items" or warnings before the real data arrives.
// Bones use the theme's subtext colour at low opacity, so they fit every theme;
// the pulse sits on the wrapper because it animates opacity itself.

export function Bone({ className = '', theme }) {
  return (
    <span
      aria-hidden="true"
      className={`block rounded-md bg-current opacity-[0.12] ${theme.subtext} ${className}`}
    />
  );
}

function CardSkeleton({ theme }) {
  return (
    <div
      className={`flex flex-col ${theme.panel} rounded-xl border ${theme.cardBorder} overflow-hidden`}
    >
      <div className="h-28 flex items-center justify-center bg-gradient-to-b from-white/[0.06] to-black/25">
        <Bone theme={theme} className="h-14 w-24 rounded-lg" />
      </div>
      <div className="h-[3px]" />
      <div className="p-3 flex flex-col gap-2.5">
        <Bone theme={theme} className="h-3 w-4/5" />
        <Bone theme={theme} className="h-2.5 w-2/5" />
        <Bone theme={theme} className="h-3 w-1/2 mt-1" />
      </div>
    </div>
  );
}

export function ItemGridSkeleton({ theme, viewMode = 'grid', count = 8 }) {
  const slots = Array.from({ length: count }, (_, i) => i);
  return (
    <div role="status" aria-label="Loading items" className="motion-safe:animate-pulse">
      {viewMode === 'list' ? (
        <div className={`border-t ${theme.cardBorder}`}>
          {slots.map(i => (
            <div key={i} className={`flex items-center gap-3 px-3 py-3 border-b ${theme.cardBorder}`}>
              <Bone theme={theme} className="h-9 w-9 shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <Bone theme={theme} className="h-3 w-1/3" />
                <Bone theme={theme} className="h-2.5 w-1/5" />
              </div>
              <Bone theme={theme} className="h-3 w-16 shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(172px, 1fr))' }}>
          {slots.map(i => <CardSkeleton key={i} theme={theme} />)}
        </div>
      )}
    </div>
  );
}

export function RecentSalesSkeleton({ theme, count = 4 }) {
  return (
    <div role="status" aria-label="Loading sales" className={`motion-safe:animate-pulse rounded-xl border ${theme.cardBorder} ${theme.card}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 ${theme.cardBorder}`}>
          <Bone theme={theme} className="h-8 w-8 shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Bone theme={theme} className="h-3 w-3/4" />
            <Bone theme={theme} className="h-2.5 w-1/2" />
          </div>
          <Bone theme={theme} className="h-3 w-10 shrink-0" />
        </div>
      ))}
    </div>
  );
}
