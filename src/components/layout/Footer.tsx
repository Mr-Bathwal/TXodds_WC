import Link from "next/link";

export function Footer() {
  return (
    <footer className="relative border-t border-border/50">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-10 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="h-2 w-2 rounded-full bg-pitch" />
          Match<span className="-ml-2 text-pitch">Pulse</span>
        </div>

        <nav className="flex items-center gap-5 text-sm text-muted">
          <Link href="/matches" className="transition-colors hover:text-foreground">Live</Link>
          <Link href="/predict" className="transition-colors hover:text-foreground">Predict</Link>
          <Link href="/leaderboard" className="transition-colors hover:text-foreground">Leaderboard</Link>
        </nav>

        <div className="text-center text-xs text-muted sm:text-right">
          <div>Built for the TxODDS × Solana World Cup Hackathon</div>
          <div className="mt-1">Data by TxLINE · Anchored on Solana · Footage: Pexels</div>
        </div>
      </div>
    </footer>
  );
}
