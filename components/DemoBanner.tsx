/**
 * Shown only when NEXT_PUBLIC_DEMO_MODE=true (public marketing demo).
 * Sets expectations without undermining confidence.
 */
export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return null;

  const site = process.env.NEXT_PUBLIC_MARKETING_URL || 'https://b2b.ownedge.ai';

  return (
    <div className="border-b border-cyan-500/25 bg-slate-950 text-slate-200 shrink-0">
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="inline-flex h-5 items-center rounded-full bg-cyan-500/15 px-2 text-[10px] font-bold uppercase tracking-wider text-cyan-300 shrink-0">
            Interactive preview
          </span>
          <span className="text-slate-400 text-xs sm:text-sm">
            Explore the interface you&apos;ll use to manage your appliance. This demo runs
            entirely in your browser and doesn&apos;t require an account.
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-medium shrink-0">
          <a
            href={`${site}/en`}
            className="text-cyan-400 hover:text-cyan-300 underline-offset-2 hover:underline"
          >
            ← Marketing site
          </a>
          <a
            href={`${site}/en#appliances`}
            className="text-slate-400 hover:text-slate-200 underline-offset-2 hover:underline"
          >
            Browse appliances
          </a>
        </div>
      </div>
    </div>
  );
}
