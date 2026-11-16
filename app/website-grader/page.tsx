import type { Metadata } from "next";
import Grader from "@/components/Grader";

export const metadata: Metadata = {
  title: "Free Website Grader",
  description: "Get an instant score for your website's SEO basics, mobile readiness, speed and security.",
};

export default function Page() {
  return (
    <>
      <section className="hero-band">
        <div className="wrap">
        <span className="eyebrow">Website Grader</span>
        <h1>How does your website score?</h1>
        <p className="lede">
          Enter your address for an instant check-up on SEO basics, mobile readiness, speed and security. It takes
          about 10 seconds.
        </p>
        </div>
      </section>
      <div className="wrap content">
        <Grader />
      </div>
    </>
  );
}
