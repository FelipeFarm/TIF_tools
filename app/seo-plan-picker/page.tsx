import type { Metadata } from "next";
import SeoPicker from "@/components/SeoPicker";

export const metadata: Metadata = {
  title: "SEO Plan Picker",
  description: "Answer 6 quick questions to find the SEO plan that fits your business: Starter, Growth or Authority.",
};

export default function Page() {
  return (
    <>
      <section className="hero-band">
        <div className="wrap">
        <span className="eyebrow">SEO Plan Picker</span>
        <h1>Which SEO plan fits your business?</h1>
        <p className="lede">Six quick questions. About a minute. No email needed to see your result.</p>
        </div>
      </section>
      <div className="wrap content">
        <SeoPicker />
      </div>
    </>
  );
}
