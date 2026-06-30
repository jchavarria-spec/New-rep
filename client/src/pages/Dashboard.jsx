import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { api } from "../lib/api.js";
import { Stat, Loading, StatusBadge, Empty, useToast } from "../components/ui.jsx";

export default function Dashboard() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [posts, setPosts] = useState([]);

  const load = async () => {
    const [overview, c, s] = await Promise.all([
      api.get("/analytics/overview"),
      api.get("/campaigns"),
      api.get("/social"),
    ]);
    setData(overview);
    setCampaigns(c.campaigns);
    setPosts(s.posts);
  };

  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  if (!data) return <Loading />;

  const { email, counts, trend, mockMode } = data;
  const upcoming = posts.filter((p) => p.status === "scheduled");

  const simulate = async () => {
    await api.post("/analytics/simulate-engagement");
    toast.success("Engagement simulated");
    load();
  };

  return (
    <div className="grid" style={{ gap: 22 }}>
      {mockMode && (
        <div className="demo-note" style={{ margin: 0 }}>
          ⚙️ Running in <b>mock mode</b> (no SendGrid key set) — emails are simulated so you can demo the full flow.
          <button className="btn sm right" onClick={simulate}>Simulate opens & clicks</button>
        </div>
      )}

      <div className="grid cols-4">
        <Stat label="Contacts" value={counts.contacts} icon="👥" tint="blue" />
        <Stat label="Emails Sent" value={email.sent} icon="✉️" tint="purple" />
        <Stat label="Open Rate" value={`${email.openRate}%`} icon="👁️" tint="green"
          delta={`${email.opened} opens`} />
        <Stat label="Click Rate" value={`${email.clickRate}%`} icon="🖱️" tint="amber"
          delta={`${email.clicked} clicks`} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr", gap: 18 }}>
        <div className="card">
          <div className="card-head">
            <h3>Engagement — last 14 days</h3>
            <Link to="/analytics" className="btn ghost sm">View analytics →</Link>
          </div>
          <div className="card-pad" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: -18, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2f6df6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2f6df6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#18a957" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#18a957" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f5" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={11} stroke="#9aa1b3" tickLine={false} axisLine={false} />
                <YAxis fontSize={11} stroke="#9aa1b3" tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="opens" stroke="#2f6df6" strokeWidth={2} fill="url(#g1)" name="Opens" />
                <Area type="monotone" dataKey="clicks" stroke="#18a957" strokeWidth={2} fill="url(#g2)" name="Clicks" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid" style={{ gap: 18 }}>
          <div className="card card-pad">
            <div className="section-title">Quick actions</div>
            <div className="grid" style={{ gap: 9 }}>
              <Link to="/campaigns" className="btn block">✉️ New email campaign</Link>
              <Link to="/social" className="btn secondary block">📱 Schedule a post</Link>
              <Link to="/contacts" className="btn secondary block">👥 Add a lead</Link>
            </div>
          </div>
          <div className="card card-pad">
            <div className="section-title">Automation</div>
            <div className="row between" style={{ marginBottom: 10 }}>
              <span className="muted">Active nurture enrollments</span>
              <b>{counts.active_nurture}</b>
            </div>
            <div className="row between" style={{ marginBottom: 10 }}>
              <span className="muted">Scheduled social posts</span>
              <b>{counts.scheduled_posts}</b>
            </div>
            <div className="row between">
              <span className="muted">Campaigns sent</span>
              <b>{counts.campaigns_sent}</b>
            </div>
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-head">
            <h3>Recent campaigns</h3>
            <Link to="/campaigns" className="btn ghost sm">All →</Link>
          </div>
          {campaigns.length === 0 ? (
            <Empty icon="✉️" title="No campaigns yet" />
          ) : (
            <table className="table">
              <tbody>
                {campaigns.slice(0, 5).map((c) => {
                  const rate = c.delivered ? Math.round((c.opened / c.delivered) * 100) : 0;
                  return (
                    <tr key={c.id}>
                      <td className="name">{c.name}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td className="muted">{c.recipients} sent</td>
                      <td><b>{rate}%</b> <span className="muted">open</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Upcoming social posts</h3>
            <Link to="/social" className="btn ghost sm">Scheduler →</Link>
          </div>
          {upcoming.length === 0 ? (
            <Empty icon="📱" title="Nothing queued" />
          ) : (
            <div className="card-pad grid" style={{ gap: 12 }}>
              {upcoming.slice(0, 4).map((p) => (
                <div key={p.id} className="row" style={{ alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{p.caption.slice(0, 80)}{p.caption.length > 80 ? "…" : ""}</div>
                    <div className="row gap-sm" style={{ marginTop: 6 }}>
                      {p.platforms.map((pl) => (
                        <span key={pl} className="badge">{pl === "facebook" ? "📘" : "📸"} {pl}</span>
                      ))}
                      <span className="muted" style={{ fontSize: 12 }}>
                        {p.scheduled_at ? new Date(p.scheduled_at).toLocaleString() : ""}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
