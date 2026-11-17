export type Status = "pass" | "warn" | "fail";
export type Category = "SEO" | "Speed" | "Local" | "Mobile" | "Security" | "Social";

export const CATEGORIES: Category[] = ["SEO", "Speed", "Local", "Mobile", "Security", "Social"];

export interface Check {
  id: string;
  category: Category;
  title: string;
  status: Status;
  /** Short, always-visible result, e.g. "Missing", "3.8s", "★ 4.8 · 52 reviews" */
  headline: string;
  /** What we found (unlocked by the lead form) */
  detail: string;
  /** How to fix it (unlocked by the lead form). Empty when passing. */
  fix: string;
  weight: number;
}

export interface SpeedData {
  source: "pagespeed";
  performance: number; // 0–100, Lighthouse mobile
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  fcpMs: number | null;
  /** Every lab score we got (we run the test several times and keep the median run) */
  runs?: number[];
  /** Same test with Google's desktop settings (median run) */
  desktop?: SpeedData | null;
  /** Real-user (Chrome UX Report) data, when Google has enough traffic for the URL */
  field: { category: string; lcpMs: number | null; inpMs: number | null; cls: number | null } | null;
}

export interface GbpData {
  status: "found" | "possible" | "not_found";
  name?: string;
  address?: string;
  rating?: number;
  reviews?: number;
  mapsUri?: string;
  query: string;
}

export interface Report {
  url: string;
  host: string;
  score: number;
  grade: string;
  categories: { name: Category; score: number }[];
  counts: { pass: number; warn: number; fail: number };
  checks: Omit<Check, "weight">[];
  speed: SpeedData | null;
  speedError?: string;
  gbp: GbpData | null;
  gbpSkipped?: boolean;
}
