import type { Metadata } from "next";
import Nav, { TopBar } from "@/components/Nav";
import PreferencesProvider from "@/components/Preferences";
import "./globals.css";
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
    <html lang="en">
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
