"use client";

import { useState } from "react";
import LeadForm from "./LeadForm";
import { SEO_TIERS, type SeoTierId } from "@/lib/config";

interface Q {
  id: string;
  q: string;
  hint?: string;
  options: { label: string; points: number }[];
}

// Points push toward bigger plans. Max score = 15.
const QUESTIONS: Q[] = [
  {
    id: "business_type",
    q: "How does your business serve customers?",
    options: [
      { label: "One location, local customers", points: 0 },
      { label: "We travel to customers in a service area", points: 1 },
      { label: "Online / nationwide", points: 2 },
      { label: "Multiple locations", points: 3 },
    ],
  },
  {
    id: "competition",
    q: "How competitive is your market?",
    hint: "Think about how many competitors show up when you Google your main service.",
    options: [
      { label: "Not very, just a few competitors", points: 0 },
      { label: "Moderate, a handful of strong ones", points: 1 },
      { label: "Very, lots of businesses fighting for the top spots", points: 3 },
    ],
  },
  {
    id: "visibility",
    q: "Where do you show up on Google today?",
    options: [
      { label: "Top 3 for some of my main services", points: 0 },
      { label: "Page 2–3 for some services", points: 1 },
      { label: "Only when people search my business name", points: 1 },
      { label: "Not at all / not sure", points: 2 },
    ],
  },
  {
    id: "services",
    q: "How many different services or products do you want to rank for?",
    options: [
      { label: "1–2", points: 0 },
      { label: "3–5", points: 1 },
      { label: "6 or more", points: 2 },
    ],
  },
  {
    id: "goal",
    q: "What's your main goal with SEO?",
    options: [
      { label: "Get found locally and look credible", points: 0 },
      { label: "Outrank competitors and get steady leads", points: 1 },
      { label: "Own my category / expand into new areas", points: 3 },
    ],
  },
  {
    id: "timeline",
    q: "How soon do you want to see growth?",
    options: [
      { label: "No rush, building for the long term", points: 0 },
      { label: "Within the next 6 months", points: 1 },
      { label: "As fast as possible", points: 2 },
    ],
  },
];

function pickTier(score: number): SeoTierId {
  if (score >= 10) return "authority";
  if (score >= 5) return "growth";
  return "starter";
}

export default function SeoPicker() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const done = step >= QUESTIONS.length;

  if (done) {
    const score = QUESTIONS.reduce((s, q) => s + (q.options[answers[q.id]]?.points ?? 0), 0);
    const tier = SEO_TIERS[pickTier(score)];
    const readable = Object.fromEntries(QUESTIONS.map((q) => [q.q, q.options[answers[q.id]]?.label ?? ""]));

    return (
      <>
        <div className="card">
          <div className="result-head">
            <div>
              <span className="badge">Your recommended plan</span>
              <h2 style={{ fontSize: 34, margin: "10px 0 4px" }}>{tier.name}</h2>
              <p className="lede" style={{ fontSize: 16 }}>
                {tier.bestFor}
              </p>
            </div>
          </div>
          <div className="stats">
            <div className="stat">
              <div className="k">SEO articles / month</div>
              <div className="v">{tier.articlesPerMonth}</div>
            </div>
            <div className="stat">
              <div className="k">Investment</div>
              <div className="v" style={{ fontSize: 20 }}>
                {tier.priceLabel}
              </div>
            </div>
          </div>
          <h3>What&apos;s included</h3>
          <ul className="list">
            {tier.includes.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <div className="actions mt">
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setAnswers({});
                setStep(0);
              }}
            >
              Start over
            </button>
          </div>
        </div>
        <LeadForm
          tool="seo-plan-picker"
          heading={`Get your ${tier.name} plan proposal`}
          sub="Tell us where to send it. We'll review your site and come back with a custom quote and a 90-day game plan."
          cta="Send me my proposal"
          details={{ recommended_plan: tier.name, score, ...readable }}
        />
      </>
    );
  }

  const q = QUESTIONS[step];
  return (
    <div className="card">
      <div className="step-count">
        Question {step + 1} of {QUESTIONS.length}
      </div>
      <div className="progress" aria-hidden>
        <div style={{ width: `${(step / QUESTIONS.length) * 100}%` }} />
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="legend" style={{ fontSize: 20 }}>
          {q.q}
        </legend>
        {q.hint && <p className="hint">{q.hint}</p>}
        <div className="options" style={{ gridTemplateColumns: "1fr" }}>
          {q.options.map((o, i) => (
            <label className="opt" key={o.label}>
              <input
                type="radio"
                name={q.id}
                checked={answers[q.id] === i}
                onChange={() => {
                  setAnswers({ ...answers, [q.id]: i });
                  setTimeout(() => setStep((s) => s + 1), 180);
                }}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {step > 0 && (
        <div className="actions mt">
          <button className="btn ghost" type="button" onClick={() => setStep(step - 1)}>
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}
