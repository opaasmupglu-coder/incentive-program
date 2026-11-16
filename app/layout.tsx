import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Incentive Program — 2026 Customer Feedback",
  description:
    "Enter monthly ratings, validator scores, and view rankings for the 2026 Customer Feedback Incentive Program.",
};

// Editorial pairing: Fraunces (display serif) + IBM Plex Sans (body).
// Self-hosted by next/font — bundled at build time, no runtime requests.
const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <p className="kicker">Provincial Government of La Union</p>
            <h1>2026 Customer Feedback Incentive Program</h1>
            <p className="site-sub">Monthly ratings, validator scores, rankings and finals — from the program database.</p>
            <Nav />
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="footer">
          <div className="container">
            The database is the source of truth — every number here comes from it, and every save writes back to it.
          </div>
        </footer>
      </body>
    </html>
  );
}
