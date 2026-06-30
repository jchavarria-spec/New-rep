import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";

const NAV = [
  { section: "Workspace" },
  { to: "/", icon: "📊", label: "Dashboard", end: true },
  { to: "/analytics", icon: "📈", label: "Analytics" },
  { section: "Marketing" },
  { to: "/campaigns", icon: "✉️", label: "Email Campaigns" },
  { to: "/sequences", icon: "🔁", label: "Nurture Sequences" },
  { to: "/social", icon: "📱", label: "Social Scheduler" },
  { section: "CRM" },
  { to: "/contacts", icon: "👥", label: "Contacts & Leads" },
  { section: "Account" },
  { to: "/pricing", icon: "💎", label: "Plans & Pricing" },
  { to: "/settings", icon: "⚙️", label: "Settings" },
];

const TITLES = {
  "/": ["Dashboard", "Your marketing at a glance"],
  "/analytics": ["Analytics", "Open rates, clicks, and engagement"],
  "/campaigns": ["Email Campaigns", "Build and send beautiful emails"],
  "/sequences": ["Nurture Sequences", "Automated drip campaigns on autopilot"],
  "/social": ["Social Scheduler", "Queue posts to Facebook & Instagram"],
  "/contacts": ["Contacts & Leads", "Store, segment, and manage your pipeline"],
  "/pricing": ["Plans & Pricing", "Choose the plan that fits your business"],
  "/settings": ["Settings", "Manage your profile and brokerage"],
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [title, sub] = TITLES[pathname] || ["Reltor", ""];
  const initials = (user?.name || "A")
    .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">🏡</span>
          <b>Reltor</b>
        </div>
        <nav className="nav">
          {NAV.map((item, i) =>
            item.section ? (
              <div className="nav-label" key={i}>{item.section}</div>
            ) : (
              <NavLink key={item.to} to={item.to} end={item.end}>
                <span className="ico">{item.icon}</span>
                {item.label}
              </NavLink>
            )
          )}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="avatar">{initials}</div>
            <div className="meta">
              <b>{user?.name}</b>
              <span>{user?.brokerage || user?.email}</span>
            </div>
            <button className="x right" title="Log out" onClick={logout}>⏏</button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            <div className="sub">{sub}</div>
          </div>
          <div className="row gap-sm">
            <span className="badge purple" style={{ textTransform: "uppercase" }}>
              {user?.plan} plan
            </span>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
