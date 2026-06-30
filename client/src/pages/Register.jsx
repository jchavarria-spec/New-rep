import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { Field, useToast } from "../components/ui.jsx";

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", brokerage: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await register(form);
      toast.success("Account created — welcome to Reltor!");
      nav("/");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <div className="logo-lg">🏡 Reltor</div>
        <div>
          <h2>Start marketing like a top-producing agent.</h2>
          <p>Create your free workspace in seconds. Your account comes pre-loaded
            with proven real-estate email templates.</p>
        </div>
        <div style={{ opacity: 0.7, fontSize: 13 }}>No credit card required</div>
      </div>
      <div className="auth-form-side">
        <div className="auth-card">
          <h1>Create your account</h1>
          <p className="sub">Get your marketing on autopilot.</p>
          <form onSubmit={submit}>
            <Field label="Full name">
              <input className="input" value={form.name} onChange={set("name")} required placeholder="Jordan Avery" />
            </Field>
            <Field label="Brokerage" hint="Used in your email signatures">
              <input className="input" value={form.brokerage} onChange={set("brokerage")} placeholder="Skyline Realty Group" />
            </Field>
            <Field label="Email">
              <input className="input" type="email" value={form.email} onChange={set("email")} required placeholder="you@brokerage.com" />
            </Field>
            <Field label="Password" hint="At least 6 characters">
              <input className="input" type="password" value={form.password} onChange={set("password")} required />
            </Field>
            <button className="btn block" disabled={busy}>
              {busy ? "Creating…" : "Create account"}
            </button>
          </form>
          <p className="muted" style={{ marginTop: 18, textAlign: "center" }}>
            Already have an account? <Link to="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
