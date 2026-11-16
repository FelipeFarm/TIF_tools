"use client";

import { useMemo, useState } from "react";
import LeadForm from "./LeadForm";
import { INDUSTRIES, MARKETS, MIN_SPEND, ESTIMATE_SPREAD } from "@/lib/config";

type Goal = "calls" | "leads" | "awareness";
type Mode = "budget" | "leads";
type Channel = "google" | "meta" | "lsa";

const GOALS: Record<Goal, { label: string; mix: Record<Channel, number> }> = {
  calls: { label: "More phone calls", mix: { google: 0.5, lsa: 0.4, meta: 0.1 } },
  leads: { label: "More form leads / bookings", mix: { google: 0.5, meta: 0.35, lsa: 0.15 } },
  awareness: { label: "More people knowing my brand", mix: { google: 0.3, meta: 0.7, lsa: 0 } },
};

const CHANNEL_LABEL: Record<Channel, string> = {
  google: "Google Search Ads",
  meta: "Meta (Facebook & Instagram)",
  lsa: "Google Local Services Ads",
};

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const num = (n: number) => Math.round(n).toLocaleString("en-US");
const range = (n: number, f: (x: number) => string) =>
  `${f(n * (1 - ESTIMATE_SPREAD))} – ${f(n * (1 + ESTIMATE_SPREAD))}`;

export default function AdEstimator() {
  const [industry, setIndustry] = useState("");
  const [market, setMarket] = useState("mid");
  const [goal, setGoal] = useState<Goal>("leads");
  const [mode, setMode] = useState<Mode>("budget");
  const [amount, setAmount] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const result = useMemo(() => {
    const ind = INDUSTRIES[industry];
    const value = Number(amount);
    if (!ind || !value || value <= 0) return null;
    const m = MARKETS[market].multiplier;

    // Cost per lead by channel
    const cpc = ind.googleCpc * m;
    const cpl: Record<Channel, number | null> = {
      google: cpc / ind.googleConvRate,
      meta: ind.metaCpl * m,
      lsa: ind.lsaCpl === null ? null : ind.lsaCpl * m,
    };

    // Channel mix, dropping LSA where it isn't available
    const raw = { ...GOALS[goal].mix };
    if (cpl.lsa === null) raw.lsa = 0;
    const total = raw.google + raw.meta + raw.lsa;
    const mix = { google: raw.google / total, meta: raw.meta / total, lsa: raw.lsa / total };

    // Blended cost per lead (weighted harmonic)
    const leadsPerDollar = (Object.keys(mix) as Channel[]).reduce(
      (s, c) => s + (mix[c] > 0 && cpl[c] ? mix[c] / (cpl[c] as number) : 0),
      0
    );
    const blendedCpl = 1 / leadsPerDollar;
    const budget = mode === "budget" ? value : value * blendedCpl;

    const rows = (Object.keys(mix) as Channel[])
      .filter((c) => mix[c] > 0 && cpl[c])
      .map((c) => {
        const spend = budget * mix[c];
        return {
          channel: c,
          spend,
          leads: spend / (cpl[c] as number),
          cpl: cpl[c] as number,
          clicks: c === "google" ? spend / cpc : null,
          belowMin: spend < MIN_SPEND[c],
        };
      });

    return {
      budget,
      leads: budget * leadsPerDollar,
      blendedCpl,
      rows,
      lsaUnavailable: cpl.lsa === null,
    };
  }, [industry, market, goal, mode, amount]);

  const canSubmit = Boolean(industry && Number(amount) > 0);

  return (
    <>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) setSubmitted(true);
        }}
      >
        <div className="field">
          <label htmlFor="industry">Your industry</label>
          <select id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} required>
            <option value="">Choose one…</option>
            {Object.entries(INDUSTRIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="legend">Where are your customers?</span>
          <div className="options">
            {Object.entries(MARKETS).map(([k, v]) => (
              <label className="opt" key={k}>
                <input type="radio" name="market" checked={market === k} onChange={() => setMarket(k)} />
                <span>{v.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="legend">What do you want most from ads?</span>
          <div className="options">
            {(Object.keys(GOALS) as Goal[]).map((g) => (
              <label className="opt" key={g}>
                <input type="radio" name="goal" checked={goal === g} onChange={() => setGoal(g)} />
                <span>{GOALS[g].label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="legend">Start from…</span>
          <div className="options">
            <label className="opt">
              <input type="radio" name="mode" checked={mode === "budget"} onChange={() => setMode("budget")} />
              <span>My monthly budget</span>
            </label>
            <label className="opt">
              <input type="radio" name="mode" checked={mode === "leads"} onChange={() => setMode("leads")} />
              <span>How many leads I want</span>
            </label>
          </div>
        </div>

        <div className="field">
          <label htmlFor="amount">
            {mode === "budget" ? "Monthly ad budget (USD)" : "Leads you want per month"}
          </label>
          <input
            id="amount"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder={mode === "budget" ? "e.g. 3000" : "e.g. 40"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="actions">
          <button className="btn" type="submit" disabled={!canSubmit}>
            See my estimate
          </button>
        </div>
      </form>

      {submitted && result && (
        <>
          <div className="card mt" aria-live="polite">
            <span className="badge">Your estimate</span>
            <div className="stats">
              <div className="stat">
                <div className="k">Monthly ad spend</div>
                <div className="v">{mode === "budget" ? usd(result.budget) : range(result.budget, usd)}</div>
              </div>
              <div className="stat">
                <div className="k">Estimated leads / month</div>
                <div className="v">{range(result.leads, num)}</div>
              </div>
              <div className="stat">
                <div className="k">Avg. cost per lead</div>
                <div className="v">{range(result.blendedCpl, usd)}</div>
              </div>
            </div>

            <h3>Suggested channel split</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>Monthly spend</th>
                    <th>Est. leads</th>
                    <th>Est. cost / lead</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.channel}>
                      <td>
                        {CHANNEL_LABEL[r.channel]}
                        {r.belowMin && (
                          <div className="note" style={{ marginTop: 4 }}>
                            Below our recommended {usd(MIN_SPEND[r.channel])}/mo minimum. Consider putting this into
                            fewer channels.
                          </div>
                        )}
                      </td>
                      <td>{usd(r.spend)}</td>
                      <td>{range(r.leads, num)}</td>
                      <td>{usd(r.cpl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.lsaUnavailable && (
              <p className="note">Google Local Services Ads aren&apos;t available for this industry, so it&apos;s left out.</p>
            )}
            <p className="note">
              Ballpark figures based on typical industry costs, for ad spend only (management fees not included).
              Real results depend on your offer, website, competition and tracking. We install and test tracking before
              any spend.
            </p>
          </div>

          <LeadForm
            tool="ad-budget-estimator"
            heading="Get a custom ad plan"
            sub="We'll look at your market and competitors and send a real plan with targeting, budget and expected results."
            cta="Send me my ad plan"
            details={{
              industry: INDUSTRIES[industry].label,
              market: MARKETS[market].label,
              goal: GOALS[goal].label,
              input: mode === "budget" ? `Budget ${usd(Number(amount))}/mo` : `${amount} leads/mo`,
              est_budget: Math.round(result.budget),
              est_leads: Math.round(result.leads),
              est_cpl: Math.round(result.blendedCpl),
              split: result.rows.map((r) => `${CHANNEL_LABEL[r.channel]}: ${usd(r.spend)}`).join(", "),
            }}
          />
        </>
      )}
    </>
  );
}
