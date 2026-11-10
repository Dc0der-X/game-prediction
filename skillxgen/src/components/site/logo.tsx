import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-lg font-bold tracking-tight", className)}>
      <svg viewBox="0 0 28 28" className="size-7" aria-hidden>
        <rect width="28" height="28" rx="3" fill="#e5192b" />
        <path d="M7 7l14 14M21 7L7 21" stroke="#fff" strokeWidth="3.2" strokeLinecap="square" />
      </svg>
      <span>SKILL<span className="text-primary">X</span>GEN</span>
    </span>
  );
}
