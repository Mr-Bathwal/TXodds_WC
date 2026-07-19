import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import dynamic from "next/dynamic";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SmoothScroll } from "@/components/providers/SmoothScroll";
import { CustomCursor } from "@/components/providers/CustomCursor";
import { ThemeProvider } from "@/lib/theme";
import { WalletProvider } from "@/components/providers/WalletProvider";

const GlobalBackground = dynamic(() => import("@/components/three/GlobalBackground"));

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const sora = Sora({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: "MatchPulse — Provably-fair World Cup, on Solana",
  description:
    "Live World Cup 2026 scores, odds and momentum powered by TxLINE, with predictions timestamped on Solana. Provably fair. Verifiable on-chain.",
  applicationName: "MatchPulse",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "MatchPulse", statusBarStyle: "black-translucent" },
  openGraph: {
    title: "MatchPulse — Provably-fair World Cup, on Solana",
    description:
      "Live TxLINE match data + predictions you commit to Solana before kickoff. No cheating, provably fair.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#04060a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <WalletProvider>
          <ThemeProvider>
            <CustomCursor />
            <GlobalBackground />
            <SmoothScroll>
              <Header />
              <main className="flex-1 w-full">{children}</main>
              <Footer />
            </SmoothScroll>
          </ThemeProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
