"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * Multi-theme system. Each theme swaps the CSS custom properties on <html>
 * via data-theme, and exposes accent hexes for the WebGL scenes (shader/material
 * colors can't read CSS vars).
 */
export type ThemeName = "night" | "turf" | "royal";

export interface ThemeDef {
  name: ThemeName;
  label: string;
  icon: string;
  /** Colors fed to 3D scenes. */
  three: {
    glow: string; // core / key light
    cool: string; // secondary light
    warm: string; // tertiary light
    particles: string;
  };
}

export const THEMES: ThemeDef[] = [
  {
    name: "night",
    label: "Night Match",
    icon: "🌙",
    three: { glow: "#1ad17a", cool: "#8fd8ff", warm: "#9945ff", particles: "#8fd8ff" },
  },
  {
    name: "turf",
    label: "Turf",
    icon: "🌿",
    three: { glow: "#c6ff3d", cool: "#3ddb84", warm: "#ffcf5c", particles: "#c6ff3d" },
  },
  {
    name: "royal",
    label: "Royal",
    icon: "👑",
    three: { glow: "#9945ff", cool: "#5aa2ff", warm: "#ffcf5c", particles: "#b28dff" },
  },
];

const KEY = "matchpulse.theme";

const ThemeContext = createContext<{
  theme: ThemeDef;
  setTheme: (name: ThemeName) => void;
  cycle: () => void;
}>({ theme: THEMES[0], setTheme: () => {}, cycle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState<ThemeName>("night");

  useEffect(() => {
    const stored = localStorage.getItem(KEY) as ThemeName | null;
    if (stored && THEMES.some((t) => t.name === stored)) setName(stored);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = name;
    localStorage.setItem(KEY, name);
  }, [name]);

  const theme = THEMES.find((t) => t.name === name) ?? THEMES[0];
  const cycle = () => {
    const i = THEMES.findIndex((t) => t.name === name);
    setName(THEMES[(i + 1) % THEMES.length].name);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setName, cycle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
