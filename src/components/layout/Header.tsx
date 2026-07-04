"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { useFixtures } from "@/lib/hooks";

const NAV = [
  { href: "/matches", label: "Live" },
  { href: "/predict", label: "Predict" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function Header() {
  const pathname = usePathname();
  const { theme, cycle } = useTheme();
  const { data } = useFixtures(30_000);
  const liveCount =
    data?.fixtures.filter((f) => f.status === "live" || f.status === "halftime").length ?? 0;

  return (
    <header className="fixed top-0 inset-x-0 z-40 border-b border-white/5 bg-background/50 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="relative flex h-2.5 w-2.5">
            <span className="live-dot absolute inline-flex h-full w-full rounded-full bg-pitch" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-pitch" />
          </span>
          <span>
            Match<span className="text-pitch">Pulse</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative px-3 py-1.5 rounded-full transition-colors",
                  active
                    ? "bg-surface-2 text-foreground"
                    : "text-muted hover:text-foreground hover:bg-surface",
                )}
              >
                {item.label}
                {item.label === "Live" && liveCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pitch px-1 font-mono text-[10px] font-bold text-background">
                    {liveCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={cycle}
            title={`Theme: ${theme.label} — click to switch`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-pitch/40 hover:text-foreground"
          >
            <span>{theme.icon}</span>
            <span className="hidden sm:inline">{theme.label}</span>
          </button>
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-sol-teal" />
            TxLINE feed
          </span>
        </div>
      </div>
    </header>
  );
}
