import type { Metadata, Viewport } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { BootOverlay } from "@/components/system/BootOverlay";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orbital Index — live launch & satellite tracker",
  description:
    "Live global launch schedule, interactive launch-pad and satellite maps, launch analytics, and a retrieval-grounded AI assistant. Data from Launch Library 2 and CelesTrak.",
  applicationName: "Orbital Index",
};

export const viewport: Viewport = {
  themeColor: "#04050c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-void font-sans text-ink">
        <div className="starfield" aria-hidden />
        <BootOverlay />
        <SiteHeader />
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-8 sm:px-6 lg:px-10">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
