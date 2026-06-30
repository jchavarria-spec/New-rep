import { createContext, useContext, useState, useCallback } from "react";

/* ---------- Toasts ---------- */
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = "default") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const toast = {
    success: (m) => push(m, "success"),
    error: (m) => push(m, "error"),
    info: (m) => push(m, "default"),
  };
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.type === "success" ? "✅" : t.type === "error" ? "⚠️" : "🔔"}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);

/* ---------- Modal ---------- */
export function Modal({ title, onClose, children, footer, size }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className={`modal ${size === "lg" ? "lg" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Badge ---------- */
const STATUS_COLORS = {
  draft: "", scheduled: "amber", sending: "blue", sent: "green", posted: "green",
  failed: "red", active: "green", completed: "blue", new: "blue",
  nurturing: "amber", client: "green", past_client: "purple", lost: "red",
};
export function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] ?? "";
  return (
    <span className={`badge ${color}`}>
      <span className="dot" />
      {String(status).replace("_", " ")}
    </span>
  );
}

/* ---------- Spinner / Loading ---------- */
export const Spinner = () => <div className="spinner" />;
export const Loading = () => (
  <div className="empty"><div className="spinner" style={{ margin: "0 auto" }} /></div>
);

/* ---------- Empty state ---------- */
export function Empty({ icon = "📭", title, children, action }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <h3 style={{ marginBottom: 6 }}>{title}</h3>
      {children && <p style={{ maxWidth: 360, margin: "0 auto 16px" }}>{children}</p>}
      {action}
    </div>
  );
}

/* ---------- Stat card ---------- */
export function Stat({ label, value, icon, tint = "blue", delta }) {
  const tints = {
    blue: ["var(--primary-soft)", "var(--primary)"],
    green: ["var(--success-soft)", "var(--success)"],
    amber: ["var(--warning-soft)", "var(--warning)"],
    purple: ["var(--purple-soft)", "var(--purple)"],
  };
  const [bg, fg] = tints[tint] || tints.blue;
  return (
    <div className="card stat">
      <div className="row between">
        <div className="label">{label}</div>
        <div className="icon" style={{ background: bg, color: fg }}>{icon}</div>
      </div>
      <div className="value">{value}</div>
      {delta && <div className="delta" style={{ color: fg }}>{delta}</div>}
    </div>
  );
}

/* ---------- Field helpers ---------- */
export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
