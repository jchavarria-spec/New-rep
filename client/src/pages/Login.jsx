import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { Field, useToast } from "../components/ui.jsx";

function Hero() {
  return (
    <div className="auth-hero">
      <div className="logo-lg">🏡 Reltor</div>
      <div>
        <h2>Marketing automation built for real estate agents.</h2>
        <p>
          Win more listings and nurture every lead — email campaigns, social
          scheduling, and automated follow-ups in one polished platform.
        </p>
        <div className="auth-features">
          {[
            "Email campaigns with real-estate templates",
            "Facebook & Instagram scheduling",
            "Automated nurture sequences",
            "Open & click analytics in real time",
          ].map((f) => (
            <div key={f}><span className="chk">✓</span>{f}</div>
          ))}
        </div>
      </div>
      <div style={{ opacity: 0.7, fontSize: 13 }}>© {new Date().getFullYear()} Reltor</div>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [email, setEmail] = useState("demo@reltor.app");
  const [password, setPassword] = useState("demo1234");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      nav("/");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <Hero />
      <div className="auth-form-side">
        <div className="auth-card">
          <h1>Welcome back</h1>
          <p className="sub">Log in to your marketing workspace.</p>
          <div className="demo-note">
            🎬 <b>Demo account</b> is pre-filled — just click Log in to explore seeded data.
          </div>
          <form onSubmit={submit}>
            <Field label="Email">
              <input className="input" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password">
              <input className="input" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <button className="btn block" disabled={busy}>
              {busy ? "Signing in…" : "Log in"}
            </button>
          </form>
          <p className="muted" style={{ marginTop: 18, textAlign: "center" }}>
            New here? <Link to="/register" style={{ color: "var(--primary)", fontWeight: 600 }}>Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
