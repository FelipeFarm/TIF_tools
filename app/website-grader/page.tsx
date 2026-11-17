import HeroArt from "@/components/HeroArt";
import type { Metadata } from "next";
import Grader from "@/components/Grader";

export const metadata: Metadata = {
  title: "Free Website Grader",
  description: "Free website grader: Google speed test, SEO basics, Google Business Profile check and a head-to-head comparison with a competitor.",
};

export default function Page() {
  return (
    <>
      <section className="hero-band">
        <HeroArt />
        <div className="wrap">
        <span className="eyebrow">Website Grader</span>
        <h1>How does your website score?</h1>
        <p className="lede">
            Get a free score for your homepage with Google&apos;s own speed test, an SEO check-up and a Google Business
            Profile lookup. Add a competitor to see how you stack up. Takes about 30 seconds.
          </p>
        </div>
      </section>
      <div className="wrap content">
        <Grader />
      </div>
    </>
  );
}
