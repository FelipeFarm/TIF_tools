import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "@fontsource-variable/dm-sans";
import "./globals.css";
import { BRAND } from "@/lib/config";
import { BOOKING_URL } from "@/lib/basePath";

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
            <Link href="/" className="logo" aria-label={`${BRAND.name} ${BRAND.byline}, all tools`}>
              <Image
                src="/logo-white.png"
                alt={`${BRAND.name} ${BRAND.byline}`}
                width={480}
                height={193}
                priority
                unoptimized
                style={{ height: 46, width: "auto", display: "block" }}
              />
            </Link>
            <nav className="nav" aria-label="Tools">
              <Link className="nav-link" href="/seo-plan-picker">SEO Plan</Link>
              <Link className="nav-link" href="/ad-budget-estimator">Ad Budget</Link>
              <Link className="nav-link" href="/website-grader">Website Grader</Link>
              <a className="btn" href={BOOKING_URL} target="_top">
                Book a 20-minute call
              </a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="foot">
          <div className="wrap">
            <span>
              © {new Date().getFullYear()} {BRAND.name}, VM Digital Corp. Estimates are for planning only and are not a
              guarantee of results.
            </span>
            <a href="https://www.theideafarm.net" target="_top">
              theideafarm.net
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
