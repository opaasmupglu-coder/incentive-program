import type { Metadata } from "next";
import localFont from "next/font/local";
import Nav, { TopBar } from "@/components/Nav";
import PreferencesProvider from "@/components/Preferences";
import "./globals.css";
const inter = localFont({
  src: [
    { path: "../public/fonts/inter-400.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/inter-500.ttf", weight: "500", style: "normal" },
    { path: "../public/fonts/inter-600.ttf", weight: "600", style: "normal" },
    { path: "../public/fonts/inter-700.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-ui",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Feedback — 2026 Incentive Program",
  description:
    "The customer feedback workspace for the Provincial Government of La Union. Enter scores, track progress, and recognize excellent public service.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <PreferencesProvider>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <Nav />
          <div className="workspace">
            <TopBar />
            <main className="container" id="main-content">
              {children}
            </main>
            <footer className="footer">
              <span>2026 Customer Feedback Incentive Program</span>
              <span>
                Provincial Government of La Union{" "}
                <span className="footer-dot">•</span> Made for better public
                service
              </span>
            </footer>
          </div>
        </PreferencesProvider>
      </body>
    </html>
  );
}
