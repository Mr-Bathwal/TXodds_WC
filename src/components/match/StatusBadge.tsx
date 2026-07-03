import { cn } from "@/lib/utils";
import type { Fixture } from "@/lib/txline";
import { formatKickoff } from "@/lib/format";

export function StatusBadge({ fixture, className }: { fixture: Fixture; className?: string }) {
  const { status, minute } = fixture;

  if (status === "live") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-pitch font-semibold", className)}>
        <span className="live-dot h-2 w-2 rounded-full bg-pitch" />
        {minute}&rsquo;
      </span>
    );
  }
  if (status === "halftime") {
    return <span className={cn("text-accent font-semibold", className)}>HT</span>;
  }
  if (status === "finished") {
    return <span className={cn("text-muted font-medium", className)}>FT</span>;
  }
  return (
    <span className={cn("text-muted text-sm", className)}>{formatKickoff(fixture.kickoff)}</span>
  );
}
