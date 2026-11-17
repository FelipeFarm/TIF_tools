import type { Check, GbpData } from "./types";
import { bareHost, timedFetch } from "./net";

const PLACES_ENDPOINT = () => process.env.PLACES_ENDPOINT || "https://places.googleapis.com/v1/places:searchText";
const FIELDS = [
  "places.displayName",
  "places.formattedAddress",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
].join(",");

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

/* eslint-disable @typescript-eslint/no-explicit-any */
export function pickPlace(json: any, siteHost: string, query: string, userNamed: boolean): GbpData {
  const places: any[] = Array.isArray(json?.places) ? json.places : [];
  const host = bareHost(siteHost);
  const toData = (p: any, status: GbpData["status"]): GbpData => ({
    status,
    name: p?.displayName?.text,
    address: p?.formattedAddress,
    rating: typeof p?.rating === "number" ? p.rating : undefined,
    reviews: typeof p?.userRatingCount === "number" ? p.userRatingCount : 0,
    mapsUri: p?.googleMapsUri,
    query,
  });
  // 1. A listing whose website points at this site = confirmed
  const byWebsite = places.find((p) => {
    try {
      return p?.websiteUri && bareHost(new URL(p.websiteUri).hostname) === host;
    } catch {
      return false;
    }
  });
  if (byWebsite) return toData(byWebsite, "found");
  // 2. The user typed their business name and the top result matches it, but it doesn't link to their site
  const top = places[0];
  if (userNamed && top?.displayName?.text) {
    const a = norm(top.displayName.text);
    const b = norm(query.split(",")[0]);
    if (a && b && (a.includes(b) || b.includes(a))) return toData(top, "possible");
  }
  return { status: "not_found", query };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function findGbp(siteHost: string, query: string, userNamed: boolean, apiKey: string): Promise<GbpData | null> {
  try {
    const res = await timedFetch(PLACES_ENDPOINT(), 10_000, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELDS },
      body: JSON.stringify({ textQuery: query, pageSize: 5 }),
    });
    if (!res.ok) {
      console.warn("[gbp] HTTP", res.status);
      return null;
    }
    return pickPlace(await res.json(), siteHost, query, userNamed);
  } catch (err) {
    console.warn("[gbp] failed", err);
    return null;
  }
}

export function gbpCheck(g: GbpData): Check {
  if (g.status === "not_found") {
    return {
      id: "gbp",
      category: "Local",
      title: "Google Business Profile",
      status: "fail",
      headline: "Not found",
      detail: `We searched Google for “${g.query}” and couldn't find a Business Profile that links to this website. Your profile is what shows up in the map results and on the right side of Google, and it's often where local customers call from.`,
      fix: "Claim or create your profile at business.google.com, verify it, add your website link, categories, hours, photos and services, then start asking happy customers for reviews. If you already have one, make sure it links to this exact website.",
      weight: 10,
    };
  }
  const reviews = g.reviews ?? 0;
  const rating = g.rating;
  const stars = rating ? `★ ${rating.toFixed(1)} · ${reviews} review${reviews === 1 ? "" : "s"}` : "No reviews yet";
  if (g.status === "possible") {
    return {
      id: "gbp",
      category: "Local",
      title: "Google Business Profile",
      status: "warn",
      headline: "Not linked to site",
      detail: `We found a listing called “${g.name}”${g.address ? ` at ${g.address}` : ""} (${stars}), but it doesn't link to this website. Google may not connect your profile and your site, which weakens both.`,
      fix: "Edit your Business Profile and set the website field to this exact address. Make sure your name, address and phone match your website word for word.",
      weight: 10,
    };
  }
  const strong = reviews >= 20 && (rating ?? 0) >= 4.3;
  return {
    id: "gbp",
    category: "Local",
    title: "Google Business Profile",
    status: strong ? "pass" : "warn",
    headline: stars,
    detail: `Found “${g.name}”${g.address ? ` at ${g.address}` : ""} with ${rating ? `a ${rating.toFixed(1)}-star rating from ${reviews} reviews` : "no reviews yet"}.${
      strong ? " That's a strong local signal." : " Profiles with more recent reviews (20+ at 4.3★ or higher) tend to win the map results."
    }`,
    fix: strong
      ? ""
      : "Set up a simple review request (a text or email with your review link after every job), reply to every review, and post photos and updates to your profile monthly.",
    weight: 10,
  };
}
