import type { Check, SpeedData } from "./types";
import { timedFetch } from "./net";

const PSI_ENDPOINT = () => process.env.PSI_ENDPOINT || "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parsePsi(json: any): SpeedData | null {
  const lh = json?.lighthouseResult;
  const perf = lh?.categories?.performance?.score;
  if (typeof perf !== "number") return null;
  const audit = (k: string): number | null => {
    const v = lh?.audits?.[k]?.numericValue;
    return typeof v === "number" ? v : null;
  };
  const m = json?.loadingExperience?.metrics;
  const pct = (k: string): number | null => (typeof m?.[k]?.percentile === "number" ? m[k].percentile : null);
  const hasField = m && json?.loadingExperience?.overall_category && json.loadingExperience.overall_category !== "NONE";
  return {
    source: "pagespeed",
    performance: Math.round(perf * 100),
    lcpMs: audit("largest-contentful-paint"),
    cls: audit("cumulative-layout-shift"),
    tbtMs: audit("total-blocking-time"),
    fcpMs: audit("first-contentful-paint"),
    field: hasField
      ? {
          category: String(json.loadingExperience.overall_category),
          lcpMs: pct("LARGEST_CONTENTFUL_PAINT_MS"),
          inpMs: pct("INTERACTION_TO_NEXT_PAINT"),
          // CrUX reports CLS ×100
          cls: pct("CUMULATIVE_LAYOUT_SHIFT_SCORE") !== null ? (pct("CUMULATIVE_LAYOUT_SHIFT_SCORE") as number) / 100 : null,
        }
      : null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Google's lab score swings a lot between runs (we've seen 44 and 78 for the same page minutes apart),
 *  so run it several times at once and report the median run, like Google recommends. */
export const PSI_RUNS = 3;
/** Points between the best and worst run above which we call the result noisy */
export const NOISY_SPREAD = 15;
export async function runPsi(url: string, apiKey?: string, strategy: "mobile" | "desktop" = "mobile"): Promise<{ data: SpeedData | null; error?: string }> {
  const batch = (n: number) =>
    Promise.all(Array.from({ length: n }, (_, i) => new Promise((r) => setTimeout(r, i * 1500)).then(() => runPsiOnce(url, apiKey, strategy))));
  const results = await batch(PSI_RUNS);
  let ok = results.map((r) => r.data).filter((d): d is SpeedData => !!d);
  if (!ok.length) return { data: null, error: results[0].error };
  // Runs disagree a lot (e.g. 64, 64, 97)? Google's test was noisy: take 2 more runs before picking the median
  const spread = (xs: SpeedData[]) => Math.max(...xs.map((d) => d.performance)) - Math.min(...xs.map((d) => d.performance));
  if (ok.length < 2 || spread(ok) > NOISY_SPREAD) {
    const more = (await batch(2)).map((r) => r.data).filter((d): d is SpeedData => !!d);
    ok = [...ok, ...more];
  }
  ok.sort((a, b) => a.performance - b.performance);
  const median = ok[Math.floor((ok.length - 1) / 2)];
  return { data: { ...median, runs: ok.map((d) => d.performance), noisy: spread(ok) > NOISY_SPREAD } };
}

async function runPsiOnce(url: string, apiKey: string | undefined, strategy: "mobile" | "desktop"): Promise<{ data: SpeedData | null; error?: string }> {
  const qs = new URLSearchParams({ url, strategy, category: "performance" });
  if (apiKey) qs.set("key", apiKey);
  try {
    const res = await timedFetch(`${PSI_ENDPOINT()}?${qs}`, 55_000);
    if (!res.ok) {
      console.warn("[psi] HTTP", res.status);
      return { data: null, error: res.status === 429 ? "Google's speed test is busy right now." : "Google's speed test couldn't load this page." };
    }
    const data = parsePsi(await res.json());
    return data ? { data } : { data: null, error: "Google's speed test returned no score for this page." };
  } catch (err) {
    console.warn("[psi] failed", err);
    return { data: null, error: "Google's speed test timed out." };
  }
}

const sec = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

export function speedChecks(s: SpeedData): Check[] {
  const checks: Check[] = [];
  const p = s.performance;
  checks.push({
    id: "psi",
    category: "Speed",
    title: "Google mobile speed score",
    status: p >= 90 ? "pass" : p >= 50 ? "warn" : "fail",
    headline: `${p} / 100`,
    detail: `Google's PageSpeed test scores your homepage ${p}/100 on a mid-range phone.${p < 50 ? " That's in Google's red zone." : p < 90 ? " That's in Google's 'needs improvement' range." : ""}${
      s.field ? ` Real Chrome users rate your site's speed as ${s.field.category.toLowerCase()}.` : ""
    }`,
    fix:
      p >= 90
        ? ""
        : "Compress and resize images (use WebP/AVIF), lazy-load images below the fold, remove unused scripts and chat/tracking widgets you don't need, and load fonts efficiently.",
    weight: 12,
  });

  const lcp = s.field?.lcpMs ?? s.lcpMs;
  if (lcp !== null) {
    checks.push({
      id: "lcp",
      category: "Speed",
      title: "Main content load time (LCP)",
      status: lcp <= 2500 ? "pass" : lcp <= 4000 ? "warn" : "fail",
      headline: sec(lcp),
      detail: `The biggest thing on screen (usually your hero image or headline) shows up after ${sec(lcp)}${s.field?.lcpMs != null ? " for real visitors" : " on a phone"}. Google's target is under 2.5s.`,
      fix: lcp <= 2500 ? "" : "Shrink and preload the hero image, avoid hero videos/sliders on mobile, and make sure the headline isn't waiting on custom fonts or scripts.",
      weight: 6,
    });
  }

  const cls = s.field?.cls ?? s.cls;
  if (cls !== null) {
    checks.push({
      id: "cls",
      category: "Speed",
      title: "Layout stability (CLS)",
      status: cls <= 0.1 ? "pass" : cls <= 0.25 ? "warn" : "fail",
      headline: cls.toFixed(2),
      detail: `Your layout shift score is ${cls.toFixed(2)}. ${cls <= 0.1 ? "The page stays put while it loads." : "Things jump around while the page loads, which causes mis-taps and frustration."} Google's target is under 0.1.`,
      fix: cls <= 0.1 ? "" : "Set width and height on images and embeds, reserve space for banners and pop-ups, and avoid injecting content above what's already on screen.",
      weight: 3,
    });
  }

  if (s.field?.inpMs != null) {
    const inp = s.field.inpMs;
    checks.push({
      id: "inp",
      category: "Speed",
      title: "Responsiveness (INP)",
      status: inp <= 200 ? "pass" : inp <= 500 ? "warn" : "fail",
      headline: `${Math.round(inp)}ms`,
      detail: `For real visitors, the page takes about ${Math.round(inp)}ms to react to taps and clicks. Google's target is under 200ms.`,
      fix: inp <= 200 ? "" : "Cut heavy JavaScript: remove unused apps and widgets, delay non-essential scripts, and break up long tasks.",
      weight: 4,
    });
  } else if (s.tbtMs !== null) {
    const tbt = s.tbtMs;
    checks.push({
      id: "tbt",
      category: "Speed",
      title: "Responsiveness (blocking time)",
      status: tbt <= 200 ? "pass" : tbt <= 600 ? "warn" : "fail",
      headline: `${Math.round(tbt)}ms`,
      detail: `On a phone, the page is frozen by scripts for about ${Math.round(tbt)}ms while loading, so taps don't respond. Google's target is under 200ms.`,
      fix: tbt <= 200 ? "" : "Cut heavy JavaScript: remove unused apps and widgets, delay non-essential scripts, and break up long tasks.",
      weight: 4,
    });
  }
  return checks;
}
