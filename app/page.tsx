import HeroArt from "@/components/HeroArt";
import Link from "next/link";
import { TOOLS } from "@/lib/tools";
import ToolIcon from "@/components/ToolIcon";


export default function Home() {
  return (
    <>
      <section className="hero-band">
        <HeroArt />
        <div className="wrap">
        <span className="eyebrow">Free tools</span>
        <h1>
            Grow smarter. Start with <em>the numbers.</em>
          </h1>
        <p className="lede">
          Three free tools from The Idea Farm to help you plan your SEO, budget your ads and see how your website
          stacks up. No sign-up required.
        </p>
        </div>
      </section>
      <section className="wrap content grid3">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="card tool-card">
            <div className="icon" aria-hidden>
              <ToolIcon name={t.icon} size={34} />
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
