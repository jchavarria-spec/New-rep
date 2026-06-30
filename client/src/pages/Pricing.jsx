import { useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useToast } from "../components/ui.jsx";

const PLANS = [
  {
    id: "starter", name: "Starter", price: 0, cadence: "free forever",
    blurb: "For new agents getting started.",
    features: ["Up to 250 contacts", "5 email campaigns / mo", "Real-estate templates", "Basic open & click analytics", "1 social account"],
  },
  {
    id: "pro", name: "Pro", price: 49, cadence: "per month", featured: true,
    blurb: "For producing agents who want to scale.",
    features: ["Up to 5,000 contacts", "Unlimited email campaigns", "Automated nurture sequences", "Facebook & Instagram scheduling", "Advanced analytics & segments", "Priority support"],
  },
  {
    id: "team", name: "Team", price: 129, cadence: "per month",
    blurb: "For teams and small brokerages.",
    features: ["Unlimited contacts", "Everything in Pro", "Up to 10 agent seats", "Shared template library", "Team performance dashboard", "Dedicated success manager"],
  },
];

export default function Pricing() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState("");

  const choose = async (planId) => {
    if (planId === user.plan) return;
    setBusy(planId);
    try {
      const { user: updated } = await api.patch("/auth/me", { plan: planId });
      updateUser(updated);
      toast.success(`You're now on the ${updated.plan} plan`);
    } catch (e) { toast.error(e.message); } finally { setBusy(""); }
  };

  return (
    <div className="grid" style={{ gap: 22 }}>
      <div style={{ textAlign: "center", maxWidth: 560, margin: "8px auto 0" }}>
        <h2 style={{ fontSize: 26 }}>Simple, transparent pricing</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          Start free and upgrade as you grow. Every plan includes our polished real-estate templates.
        </p>
      </div>

      <div className="price-grid">
        {PLANS.map((p) => {
          const current = user.plan === p.id;
          return (
            <div key={p.id} className={`card price-card ${p.featured ? "featured" : ""}`}>
              {p.featured && <span className="ribbon">Most popular</span>}
              <div className="tier">{p.name}</div>
              <div className="amt">${p.price}<small> /{p.cadence === "free forever" ? "mo" : "mo"}</small></div>
              <div className="muted" style={{ fontSize: 13 }}>{p.blurb}</div>
              <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
              <button
                className={`btn block ${p.featured ? "" : "secondary"}`}
                disabled={current || busy === p.id}
                onClick={() => choose(p.id)}
                style={{ marginTop: "auto" }}
              >
                {current ? "✓ Current plan" : busy === p.id ? "Updating…" : p.price === 0 ? "Get started" : `Choose ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="muted" style={{ textAlign: "center", fontSize: 13 }}>
        Prices in USD. Cancel anytime. Need something custom? <a href="#" style={{ color: "var(--primary)", fontWeight: 600 }}>Contact sales</a>.
      </p>
    </div>
  );
}
