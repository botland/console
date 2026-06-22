export function GpuBar({
  name,
  utilization,
  vramMb,
}: {
  name: string;
  utilization: number;
  vramMb: number;
}) {
  const vramGb = (vramMb / 1024).toFixed(0);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400 truncate max-w-[70%]">{name}</span>
        <span className="text-slate-500">{utilization}% · {vramGb} GB</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-1000"
          style={{ width: `${utilization}%` }}
        />
      </div>
    </div>
  );
}