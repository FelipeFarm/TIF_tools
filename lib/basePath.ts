/**
 * Webflow Cloud mounts the app at a sub-path (e.g. /tools).
 * <Link>, next/image and the router add it automatically,
 * but manual fetch() calls need it — use withBase() for those.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

export function withBase(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

export const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL || "https://theideafarm.net/contact";
