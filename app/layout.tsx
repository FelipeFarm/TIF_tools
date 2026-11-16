import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource-variable/dm-sans";
import "./globals.css";
import { BRAND } from "@/lib/config";
import SiteNav from "@/components/SiteNav";

export const metadata: Metadata = {
  title: { default: "Free Marketing Tools | The Idea Farm", template: "%s | The Idea Farm" },
  description:
    "Free tools from The Idea Farm: find the right SEO plan, estimate your ad budget, and grade your website in seconds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteNav />
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
