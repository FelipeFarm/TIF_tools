/**
 * Custom brand icons for the three tools.
 * Strokes use currentColor (set by the container); the gold accent uses --icon-accent.
 */
export type ToolIconName = "seo" | "ads" | "grader";

const common = {
  viewBox: "0 0 32 32",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};
const accent = "var(--icon-accent, #eec04d)";

export default function ToolIcon({ name, size = 26 }: { name: ToolIconName; size?: number }) {
  if (name === "seo") {
    // Three rising plan steps with a sprout growing from the top one
    return (
      <svg {...common} width={size} height={size}>
        <path d="M4 27h24" />
        <rect x="5" y="21" width="6" height="6" rx="1.2" />
        <rect x="13" y="17" width="6" height="10" rx="1.2" />
        <rect x="21" y="13" width="6" height="14" rx="1.2" />
        <path d="M24 13V8.5" />
        <path d="M24 9.5c-2.6.2-4.6-1.3-5-4 2.6-.2 4.6 1.3 5 4Z" fill={accent} stroke={accent} />
        <path d="M24 8c.3-2.4 2.2-3.9 4.6-3.7-.3 2.4-2.2 3.9-4.6 3.7Z" fill={accent} stroke={accent} />
      </svg>
    );
  }
  if (name === "ads") {
    // Dollar coin with a rising arrow
    return (
      <svg {...common} width={size} height={size}>
        <circle cx="13" cy="18" r="9" />
        <path d="M15.6 14.6c-.5-1-1.5-1.6-2.8-1.6-1.6 0-2.8.9-2.8 2.2 0 3.1 5.8 1.6 5.8 4.6 0 1.3-1.2 2.2-2.9 2.2-1.4 0-2.5-.7-2.9-1.8" />
        <path d="M13 11.4v1.6M13 23v1.6" />
        <path d="M19.5 9.5 27 3" stroke={accent} strokeWidth={2.2} />
        <path d="M22 3h5v5" stroke={accent} strokeWidth={2.2} />
      </svg>
    );
  }
  // grader: browser window with a score gauge
  return (
    <svg {...common} width={size} height={size}>
      <rect x="3" y="5" width="26" height="22" rx="3" />
      <path d="M3 10h26" />
      <circle cx="6.6" cy="7.5" r=".6" fill="currentColor" stroke="none" />
      <circle cx="9" cy="7.5" r=".6" fill="currentColor" stroke="none" />
      <path d="M9.5 22.5a6.5 6.5 0 0 1 13 0" />
      <path d="M16 22.5 20 16.8" stroke={accent} strokeWidth={2.2} />
      <circle cx="16" cy="22.5" r="1.4" fill={accent} stroke={accent} />
    </svg>
  );
}
