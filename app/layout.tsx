import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Incentive Program — 2026 Customer Feedback",
  description: "Enter monthly ratings, validator scores, and view rankings for the 2026 Customer Feedback Incentive Program.",
};

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/enter", label: "Enter monthly numbers" },
  { href: "/rankings", label: "Rankings & Top 5" },
  { href: "/scores", label: "Validator scores" },
  { href: "/finals", label: "Final results" },
  { href: "/settings", label: "Settings" },
  { href: "/prizes", label: "Prizes" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <h1>2026 Customer Feedback Incentive Program</h1>
          <p>Monthly ratings, validator scores, rankings and finals — from the program database.</p>
          <nav className="main-nav">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}>
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="container">{children}</main>
        <footer className="footer">
          The database is the source of truth — every number here comes from it, and every save writes back to it.
        </footer>
      </body>
    </html>
  );
}
