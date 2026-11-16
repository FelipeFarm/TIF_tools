import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { BRAND } from "@/lib/config";

export const metadata: Metadata = {
  title: { default: "Free Marketing Tools | The Idea Farm", template: "%s | The Idea Farm" },
  description:
    "Free tools from The Idea Farm: find the right SEO plan, estimate your ad budget, and grade your website in seconds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="wrap">
            <Link href="/" className="logo">
              {BRAND.name}
              <small>{BRAND.byline}</small>
            </Link>
            <nav className="nav" aria-label="Tools">
              <Link href="/seo-plan-picker">SEO Plan</Link>
              <Link href="/ad-budget-estimator">Ad Budget</Link>
              <Link href="/website-grader">Website Grader</Link>
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="foot">
          <div className="wrap">
            © {new Date().getFullYear()} {BRAND.name} — VM Digital Corp. Estimates are for planning only and are not a
            guarantee of results.
          </div>
        </footer>
      </body>
    </html>
  );
}
