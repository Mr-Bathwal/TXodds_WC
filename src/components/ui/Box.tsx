import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BoxProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Box({ children, className, noPadding = false, ...props }: BoxProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/30 bg-surface/40 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-white/10 hover:shadow-2xl hover:bg-surface/70",
        !noPadding && "p-4 sm:p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
