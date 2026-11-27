"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe2, LayoutDashboard, Rocket, Sparkles } from "lucide-react";

const LINKS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/launches", label: "Launches", icon: Rocket },
  { href: "/map", label: "Live map", icon: Globe2 },
  { href: "/assistant", label: "Assistant", icon: Sparkles },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5 rounded-full border border-white/8 bg-white/[0.03] p-1">
      {LINKS.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-label={link.label}
            title={link.label}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs transition-colors sm:px-3 sm:text-[13px] ${
              active ? "bg-white/10 text-ink" : "text-muted hover:text-ink"
            }`}
          >
            <Icon className="size-4 sm:hidden" aria-hidden />
            <span className="hidden sm:inline">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
