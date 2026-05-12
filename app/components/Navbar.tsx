"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletButton";

const LINKS = [
  { href: "/", label: "Prijava", icon: "📝" },
  { href: "/ujp", label: "UJP", icon: "🏦" },
  { href: "/dom", label: "Dom", icon: "🏠" },
  { href: "/mon", label: "MON", icon: "📋" },
];

export function Navbar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <nav className="flex items-center gap-1">
          {LINKS.map(({ href, label, icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <WalletButton />
      </div>
    </header>
  );
}
