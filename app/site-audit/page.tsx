import type { Metadata } from "next";
import { Suspense } from "react";
import HeroArt from "@/components/HeroArt";
import SiteAudit from "@/components/SiteAudit";

export const metadata: Metadata = {
  title: "Free Site Audit",
  description:
    "Free SEO site audit: crawl up to 100 pages, Google speed test, Google Business Profile check and 50+ checks, with a Site Health score and competitor comparison.",
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
            We crawl up to 100 pages like Google does, run Google&apos;s own speed test and check your Business Profile.
            50+ checks in all. Add a competitor to see how you stack up, and re-run anytime to see what you&apos;ve fixed.
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
