"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * 3D cursor-tilt wrapper: the element leans toward the pointer with a moving
 * light sheen, and eases back on leave. Gives every card a tactile, physical
 * feel. Pure CSS transforms — zero per-frame React re-renders.
 */
export function Tilt({
  children,
  className,
  max = 7,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const sheen = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width; // 0..1
    const py = (e.clientY - r.top) / r.height;
    const rx = (0.5 - py) * max;
    const ry = (px - 0.5) * max;
    el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
    if (sheen.current) {
      sheen.current.style.opacity = "1";
      sheen.current.style.background = `radial-gradient(320px circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.08), transparent 60%)`;
    }
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg)";
    if (sheen.current) sheen.current.style.opacity = "0";
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn("relative transition-transform duration-200 ease-out will-change-transform", className)}
      style={{ transformStyle: "preserve-3d" }}
    >
      <div
        ref={sheen}
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0 transition-opacity duration-300"
      />
      {children}
    </div>
  );
}
