import type { Metadata } from "next";
import { Suspense } from "react";
import HeroArt from "@/components/HeroArt";
import SiteAudit from "@/components/SiteAudit";

export const metadata: Metadata = {
  title: "Free Site Audit",
  description:
    "Free SEO site audit: we crawl up to 100 pages and check for broken links, redirects, duplicate titles, thin content, speed and 40+ other issues, with a Site Health score.",
};

export default function Page() {
  return (
    <>
      <section className="hero-band">
        <HeroArt />
        <div className="wrap">
          <span className="eyebrow">Site Audit</span>
          <h1>
            Find what&apos;s holding your <em>whole site</em> back.
          </h1>
          <p className="lede">
            We crawl up to 100 pages like Google does and run 40+ checks: broken links, redirects, duplicate titles, thin
            content, speed and more. Re-run it anytime to see what you&apos;ve fixed.
          </p>
        </div>
      </section>
      <div className="wrap content">
        <Suspense>
          <SiteAudit />
        </Suspense>
      </div>
    </>
  );
}
