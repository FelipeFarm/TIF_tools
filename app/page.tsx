import Link from "next/link";

const tools = [
  {
    href: "/seo-plan-picker",
    icon: "🌱",
    title: "SEO Plan Picker",
    body: "Answer 6 quick questions and see which SEO plan fits your business: Starter, Growth or Authority.",
  },
  {
    href: "/ad-budget-estimator",
    icon: "📈",
    title: "Ad Budget Estimator",
    body: "See a ballpark Google, Meta and Local Services Ads budget for your industry, and the leads it could bring in.",
  },
  {
    href: "/website-grader",
    icon: "🔍",
    title: "Website Grader",
    body: "Enter your URL for an instant check-up on SEO basics, mobile readiness, speed and security.",
  },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <span className="eyebrow">Free tools</span>
        <h1>Grow smarter. Start with the numbers.</h1>
        <p className="lede">
          Three free tools from The Idea Farm to help you plan your SEO, budget your ads and see how your website
          stacks up. No sign-up required.
        </p>
      </section>
      <section className="grid3">
        {tools.map((t) => (
          <Link key={t.href} href={t.href} className="card tool-card">
            <div className="icon" aria-hidden>
              {t.icon}
            </div>
            <h3>{t.title}</h3>
            <p>{t.body}</p>
            <span className="go">Try it →</span>
          </Link>
        ))}
      </section>
    </>
  );
}
