"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { WalletButton } from "@/components/wallet/wallet-button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/start/", label: "Start", hint: "tour" },
  { href: "/boost/", label: "Boost", hint: "veBTC" },
  { href: "/earn/", label: "Earn", hint: "veMEZO" },
  { href: "/market/", label: "Market", hint: "rounds" },
] as const;

function NavLinks({ className }: { readonly className?: string }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Main" className={cn("flex items-center gap-1", className)}>
      {NAV.map(({ href, label }) => {
        const active = pathname.startsWith(href.replace(/\/$/, ""));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-16 items-center gap-4">
        <Link href="/" aria-label="Janus home" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Wordmark />
        </Link>
        <NavLinks className="hidden md:flex" />
        <div className="ml-auto flex items-center gap-2">
          <Badge tone="bronze" className="hidden sm:inline-flex">
            Mezo Matsnet
          </Badge>
          <ThemeToggle />
          <WalletButton />
        </div>
      </div>
      <NavLinks className="container -mt-1 overflow-x-auto pb-2 md:hidden" />
    </header>
  );
}
