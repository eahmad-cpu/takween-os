"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock } from "lucide-react";
import { SheetClose } from "@/components/ui/sheet";

type NavLink = {
  href: string;
  label: string;
  icon?: typeof Clock;
};

const LINKS: NavLink[] = [
  { href: "/", label: "الرئيسية" },
  { href: "/elastic-habits", label: "العادات المطاطية" },
  { href: "/vision", label: "تنفيذ الرؤية" },
  { href: "/weekly", label: "أسبوعي" },
  { href: "/ibadah", label: "الشريعة والإصلاح" },
  { href: "/aspects", label: "بقية الجوانب" },
  { href: "/aspects-review", label: "تقييم الجوانب" },
  { href: "/time-audit", label: "أين يذهب وقتي", icon: Clock },
  
  
  { href: "/reset-day", label: "إعادة ضبط المسار" },
  // { href: "/settings", label: "الإعدادات" },
];

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavLinks({ closeOnClick = false }: { closeOnClick?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-2 text-sm">
      {LINKS.map((link) => {
        const active = isActive(link.href, pathname);
        const Icon = link.icon;
        const className = [
          "flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-all",
          active
            ? "border-primary/35 bg-primary/10 font-extrabold text-primary shadow-[0_0_18px_rgba(234,179,8,0.12)]"
            : "border-transparent text-muted-foreground hover:border-border/80 hover:bg-muted/70 hover:text-foreground",
        ].join(" ");

        const linkElement = (
          <Link
            href={link.href}
            className={className}
            aria-current={active ? "page" : undefined}
          >
            {Icon && <Icon className="size-4" aria-hidden="true" />}
            {link.label}
          </Link>
        );

        return closeOnClick ? (
          <SheetClose asChild key={link.href}>
            {linkElement}
          </SheetClose>
        ) : (
          <span key={link.href}>{linkElement}</span>
        );
      })}
    </nav>
  );
}

