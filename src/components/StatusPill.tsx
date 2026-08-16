import { statusTone } from "@/lib/saban-config";
import { cn } from "@/lib/utils";

const tones = {
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20",
  warn: "bg-amber-500/15 text-amber-300 border-amber-400/20",
  bad: "bg-rose-500/15 text-rose-300 border-rose-400/20",
  neutral: "bg-white/5 text-muted-foreground border-white/10",
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  if (!status) return null;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2.5 py-1 text-[11px] font-medium",
        tones[statusTone(status)],
        className,
      )}
    >
      {status}
    </span>
  );
}