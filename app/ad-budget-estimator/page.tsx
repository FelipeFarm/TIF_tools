import type { Metadata } from "next";
import AdEstimator from "@/components/AdEstimator";

export const metadata: Metadata = {
  title: "Ad Budget Estimator",
  description:
    "Estimate your monthly Google, Meta and Local Services Ads budget, and how many leads it could bring in.",
};

export default function Page() {
  return (
    <>
      <section className="hero-band">
        <div className="wrap">
        <span className="eyebrow">Ad Budget Estimator</span>
        <h1>What should you spend on ads?</h1>
        <p className="lede">
          Get a ballpark budget and channel split for Google, Meta and Local Services Ads, based on your industry and
          market.
        </p>
        </div>
      </section>
      <div className="wrap content">
        <AdEstimator />
      </div>
    </>
  );
}
