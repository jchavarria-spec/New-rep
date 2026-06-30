import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { Field, useToast } from "../components/ui.jsx";

export default function Settings() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", brokerage: "" });
  const [health, setHealth] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({ name: user.name, brokerage: user.brokerage || "" });
    api.get("/health").then(setHealth).catch(() => {});
  }, [user]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { user: updated } = await api.patch("/auth/me", form);
      updateUser(updated);
      toast.success("Profile updated");
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="grid cols-2" style={{ alignItems: "start", gap: 18 }}>
      <div className="card">
        <div className="card-head"><h3>Profile</h3></div>
        <form className="card-pad" onSubmit={save}>
          <Field label="Full name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Brokerage" hint="Appears in your email signatures via {{brokerage}}">
            <input className="input" value={form.brokerage} onChange={(e) => setForm({ ...form, brokerage: e.target.value })} />
          </Field>
          <Field label="Email"><input className="input" value={user.email} disabled /></Field>
          <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
        </form>
      </div>

      <div className="grid" style={{ gap: 18 }}>
        <div className="card">
          <div className="card-head"><h3>Integrations</h3></div>
          <div className="card-pad grid" style={{ gap: 14 }}>
            <Integration icon="✉️" name="SendGrid (email)"
              live={health && !health.emailMockMode}
              desc="Sends campaign and nurture emails. Set SENDGRID_API_KEY to go live." />
            <Integration icon="📘" name="Facebook & Instagram"
              live={health && !health.socialMockMode}
              desc="Publishes scheduled posts. Set META tokens to go live." />
          </div>
        </div>
        <div className="card card-pad">
          <div className="section-title">Current plan</div>
          <div className="row between">
            <span className="badge purple" style={{ textTransform: "uppercase" }}>{user.plan}</span>
            <a href="/pricing" className="btn secondary sm">Change plan</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Integration({ icon, name, live, desc }) {
  return (
    <div className="row between" style={{ alignItems: "flex-start" }}>
      <div className="row gap-sm" style={{ alignItems: "flex-start" }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <div>
          <b>{name}</b>
          <div className="muted" style={{ fontSize: 12.5, maxWidth: 320 }}>{desc}</div>
        </div>
      </div>
      <span className={`badge ${live ? "green" : "amber"}`}>
        <span className="dot" />{live ? "Live" : "Mock"}
      </span>
    </div>
  );
}
