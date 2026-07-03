import { cn } from "@/lib/utils";

/**
 * Crisp SVG country flag (flagcdn) with the 3-letter code as graceful alt text.
 * Avoids the Windows/Chromium flag-emoji fallback (which renders as letter pairs).
 */
export function Flag({
  iso,
  code,
  className,
}: {
  iso: string;
  code: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/${iso}.svg`}
      alt={code}
      loading="lazy"
      className={cn(
        "inline-block aspect-[4/3] rounded-[3px] object-cover shadow-sm ring-1 ring-white/10",
        className,
      )}
    />
  );
}
