import { BRAND_DISPLAY } from '@/lib/brand';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-x-2.5">
      <div className="w-10 h-10 bg-[#0a1428] rounded-xl flex items-center justify-center shrink-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1040 992"
          className="w-7 h-7 text-cyan-400"
          fill="currentColor"
        >
          <path d="M464 333c-80 40-120 100-120 180 0 30 10 60 30 85 20 25 50 45 90 55v-320zm407-147c-5 5-10 10-15 15-200 200-200 520 0 720 5 5 10 10 15 15h347l5-5c200-200 200-520 0-720l-5-5H871z" />
        </svg>
      </div>
      {!compact && (
        <div>
          <div className="font-display font-semibold text-slate-100 tracking-tight">
            {BRAND_DISPLAY}
          </div>
          <div className="text-xs text-slate-500">Appliance Console</div>
        </div>
      )}
    </div>
  );
}