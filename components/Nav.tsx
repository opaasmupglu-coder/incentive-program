"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/enter", label: "Enter monthly numbers" },
  { href: "/rankings", label: "Rankings & Top 5" },
  { href: "/scores", label: "Validator scores" },
  { href: "/finals", label: "Final results" },
  { href: "/settings", label: "Settings" },
  { href: "/prizes", label: "Prizes" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="main-nav" aria-label="Sections">
      {NAV.map((n, i) => {
        const active = pathname === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={active ? "active" : undefined}
          >
            <span className="nav-num" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
