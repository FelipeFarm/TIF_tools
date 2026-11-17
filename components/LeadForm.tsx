"use client";

import { useState } from "react";
import { withBase, BOOKING_URL } from "@/lib/basePath";

interface Props {
  tool: "seo-plan-picker" | "ad-budget-estimator" | "website-grader" | "site-audit";
  heading: string;
  sub: string;
  cta: string;
  /** Tool answers/results sent along so the Account Lead has context in GHL */
  details: Record<string, unknown>;
  defaultWebsite?: string;
  /** Called after a successful submit (e.g. to unlock gated results) */
  onSuccess?: () => void;
  successTitle?: string;
  successBody?: string;
  id?: string;
}

export default function LeadForm({
  tool,
  heading,
  sub,
  cta,
  details,
  defaultWebsite = "",
  onSuccess,
  successTitle = "Thanks, we got it!",
  successBody = "Someone from our team will reach out within one business day. Want to skip the wait?",
  id,
}: Props) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fd.get("company_url")) return; // honeypot
    setState("sending");
    setError("");
    try {
      const res = await fetch(withBase("/api/lead"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool,
          firstName: fd.get("firstName"),
          lastName: fd.get("lastName"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          business: fd.get("business"),
          website: fd.get("website"),
          details,
          page: typeof window !== "undefined" ? window.location.href : "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "We couldn't send that right now. Please try again.");
      setState("done");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="card mt" id={id}>
        <div className="success">
          <h3>{successTitle}</h3>
          <p style={{ margin: "0 0 14px" }}>{successBody}</p>
          <a className="btn" href={BOOKING_URL} target="_top">
            Book a call now
          </a>
        </div>
      </div>
    );
  }

  return (
    <form className="card mt" onSubmit={onSubmit} id={id}>
      <h2>{heading}</h2>
      <p className="lede" style={{ fontSize: 16, marginBottom: 22 }}>
        {sub}
      </p>
      <div className="row2">
        <div className="field">
          <label htmlFor="firstName">First name</label>
          <input id="firstName" name="firstName" type="text" required autoComplete="given-name" />
        </div>
        <div className="field">
          <label htmlFor="lastName">Last name</label>
          <input id="lastName" name="lastName" type="text" autoComplete="family-name" />
        </div>
      </div>
      <div className="row2">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" />
        </div>
      </div>
      <div className="row2">
        <div className="field">
          <label htmlFor="business">Business name</label>
          <input id="business" name="business" type="text" autoComplete="organization" />
        </div>
        <div className="field">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" defaultValue={defaultWebsite} placeholder="yourbusiness.com" />
        </div>
      </div>
      {/* Honeypot: hidden from people, bots fill it */}
      <div className="sr" aria-hidden>
        <label htmlFor="company_url">Leave empty</label>
        <input id="company_url" name="company_url" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="actions">
        <button className="btn" type="submit" disabled={state === "sending"}>
          {state === "sending" ? <span className="spin" aria-label="Sending" /> : cta}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <p className="note">We&apos;ll only use your info to follow up about this. No spam.</p>
    </form>
  );
}
