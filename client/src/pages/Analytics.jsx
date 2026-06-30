import { useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { api } from "../lib/api.js";
import { Stat, Loading, StatusBadge, Empty, useToast } from "../components/ui.jsx";

export default function Analytics() {
  const toast = useToast();
  const [overview, setOverview] = useState(null);
  const [rows, setRows] = useState([]);

  const load = async () => {
    const [o, c] = await Promise.all([
      api.get("/analytics/overview"),
      api.get("/analytics/campaigns"),
    ]);
    setOverview(o);
    setRows(c.campaigns);
  };
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  if (!overview) return <Loading />;
  const { email } = overview;

  const chartData = rows
    .filter((r) => r.sent > 0)
    .map((r) => ({
      name: r.name.length > 18 ? r.name.slice(0, 18) + "…" : r.name,
      open: r.sent ? Math.round((r.opened / r.sent) * 100) : 0,
      click: r.sent ? Math.round((r.clicked / r.sent) * 100) : 0,
    }));

  const simulate = async () => {
    await api.post("/analytics/simulate-engagement");
    toast.success("Engagement simulated");
    load();
  };

  return (
    <div className="grid" style={{ gap: 20 }}>
      {overview.mockMode && (
        <div className="demo-note" style={{ margin: 0 }}>
          ⚙️ Mock mode — open & click data is simulated.
          <button className="btn sm right" onClick={simulate}>Simulate engagement</button>
        </div>
      )}
      <div className="grid cols-4">
        <Stat label="Total Sent" value={email.sent} icon="✉️" tint="blue" />
        <Stat label="Unique Opens" value={email.opened} icon="👁️" tint="green" />
        <Stat label="Open Rate" value={`${email.openRate}%`} icon="📬" tint="purple" />
        <Stat label="Click Rate" value={`${email.clickRate}%`} icon="🖱️" tint="amber" />
      </div>

      <div className="card">
        <div className="card-head"><h3>Open & click rate by campaign</h3></div>
        <div className="card-pad" style={{ height: 320 }}>
          {chartData.length === 0 ? (
            <Empty icon="📊" title="No sent campaigns yet">Send a campaign to see performance here.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: -16, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f5" vertical={false} />
                <XAxis dataKey="name" fontSize={11} stroke="#9aa1b3" tickLine={false} axisLine={false} />
                <YAxis fontSize={11} stroke="#9aa1b3" tickLine={false} axisLine={false} unit="%" />
                <Tooltip />
                <Bar dataKey="open" name="Open %" radius={[5, 5, 0, 0]} fill="#2f6df6" />
                <Bar dataKey="click" name="Click %" radius={[5, 5, 0, 0]} fill="#18a957" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Campaign performance</h3></div>
        {rows.length === 0 ? (
          <Empty icon="📈" title="No campaigns yet" />
        ) : (
          <table className="table">
            <thead>
              <tr><th>Campaign</th><th>Status</th><th>Sent</th><th>Opened</th><th>Clicked</th><th>Open rate</th><th>Click rate</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="name">{r.name}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.sent}</td>
                  <td>{r.opened}</td>
                  <td>{r.clicked}</td>
                  <td><b>{r.sent ? Math.round((r.opened / r.sent) * 100) : 0}%</b></td>
                  <td><b>{r.sent ? Math.round((r.clicked / r.sent) * 100) : 0}%</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
