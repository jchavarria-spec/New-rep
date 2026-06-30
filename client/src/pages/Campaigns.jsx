import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Modal, Field, StatusBadge, Empty, Loading, useToast } from "../components/ui.jsx";

const STAGES = ["new", "nurturing", "active", "client", "past_client", "lost"];

const SAMPLE_VARS = {
  first_name: "Olivia", last_name: "Reyes", agent_name: "Jordan Avery",
  brokerage: "Skyline Realty Group", property_address: "14 Maple Ave",
  price: "$549,000", open_house_time: "Sat 1–3pm",
};
function renderPreview(str) {
  return (str || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => SAMPLE_VARS[k] ?? `{{${k}}}`);
}

export default function Campaigns() {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [building, setBuilding] = useState(false);

  const load = async () => {
    const [c, t] = await Promise.all([api.get("/campaigns"), api.get("/templates")]);
    setCampaigns(c.campaigns);
    setTemplates(t.templates);
  };
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  const send = async (id) => {
    if (!confirm("Send this campaign now?")) return;
    try {
      const r = await api.post(`/campaigns/${id}/send`);
      toast.success(`Sent to ${r.sent} contacts`);
      load();
    } catch (e) { toast.error(e.message); }
  };
  const remove = async (id) => {
    if (!confirm("Delete this campaign?")) return;
    await api.del(`/campaigns/${id}`);
    load();
  };

  if (!campaigns) return <Loading />;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row between">
        <p className="muted">{campaigns.length} campaign{campaigns.length === 1 ? "" : "s"}</p>
        <button className="btn" onClick={() => setBuilding(true)}>+ New campaign</button>
      </div>

      <div className="card">
        {campaigns.length === 0 ? (
          <Empty icon="✉️" title="No campaigns yet"
            action={<button className="btn" onClick={() => setBuilding(true)}>Build your first campaign</button>}>
            Use a ready-made real estate template to send your first email in minutes.
          </Empty>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Campaign</th><th>Status</th><th>Recipients</th><th>Open rate</th><th>Click rate</th><th></th></tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const openRate = c.delivered ? Math.round((c.opened / c.delivered) * 100) : 0;
                const clickRate = c.delivered ? Math.round((c.clicked / c.delivered) * 100) : 0;
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="name">{c.name}</div>
                      <div className="muted" style={{ fontSize: 12.5 }}>{c.subject}</div>
                    </td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>{c.recipients}</td>
                    <td>{c.status === "sent" ? <b>{openRate}%</b> : "—"}</td>
                    <td>{c.status === "sent" ? <b>{clickRate}%</b> : "—"}</td>
                    <td>
                      <div className="row gap-sm">
                        {c.status !== "sent" && (
                          <button className="btn sm" onClick={() => send(c.id)}>Send</button>
                        )}
                        <button className="btn ghost sm" onClick={() => remove(c.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {building && (
        <Builder templates={templates}
          onClose={() => setBuilding(false)}
          onDone={() => { setBuilding(false); load(); }} />
      )}
    </div>
  );
}

function Builder({ templates, onClose, onDone }) {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "", subject: "", body: "", scenario: "",
    segment_stage: "", segment_tags: "", scheduled_at: "",
  });
  const [segmentCount, setSegmentCount] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const applyTemplate = (t) => setForm({
    ...form, subject: t.subject, body: t.body, scenario: t.scenario,
    name: form.name || t.name,
  });

  const previewSegment = async () => {
    const { count } = await api.post("/campaigns/preview-segment", {
      segment_stage: form.segment_stage || null,
      segment_tags: form.segment_tags ? form.segment_tags.split(",").map((s) => s.trim()) : null,
    });
    setSegmentCount(count);
  };
  useEffect(() => { if (step === 3) previewSegment().catch(() => {}); }, [step, form.segment_stage]);

  const buildPayload = () => ({
    name: form.name, subject: form.subject, body: form.body, scenario: form.scenario,
    segment_stage: form.segment_stage || null,
    segment_tags: form.segment_tags ? form.segment_tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
    scheduled_at: form.scheduled_at || null,
  });

  const create = async (thenSend) => {
    if (!form.name || !form.subject || !form.body) return toast.error("Add a name, subject and body");
    setBusy(true);
    try {
      const { campaign } = await api.post("/campaigns", buildPayload());
      if (thenSend) {
        const r = await api.post(`/campaigns/${campaign.id}/send`);
        toast.success(`Sent to ${r.sent} contacts`);
      } else if (form.scheduled_at) {
        toast.success("Campaign scheduled");
      } else {
        toast.success("Campaign saved as draft");
      }
      onDone();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal size="lg" title="Email campaign builder" onClose={onClose}
      footer={
        <div className="row between" style={{ width: "100%" }}>
          <div className="row gap-sm">
            {[1, 2, 3].map((n) => (
              <span key={n} className={`badge ${step === n ? "blue" : ""}`}>{n}. {["Template", "Content", "Audience"][n - 1]}</span>
            ))}
          </div>
          <div className="row gap-sm">
            {step > 1 && <button className="btn secondary" onClick={() => setStep(step - 1)}>Back</button>}
            {step < 3 && <button className="btn" onClick={() => setStep(step + 1)}>Next</button>}
            {step === 3 && (
              <>
                <button className="btn secondary" disabled={busy} onClick={() => create(false)}>
                  {form.scheduled_at ? "Schedule" : "Save draft"}
                </button>
                <button className="btn" disabled={busy} onClick={() => create(true)}>Send now</button>
              </>
            )}
          </div>
        </div>
      }>
      {step === 1 && (
        <>
          <Field label="Campaign name">
            <input className="input" value={form.name} onChange={set("name")} placeholder="Spring New Listing — 14 Maple Ave" />
          </Field>
          <div className="section-title mt">Start from a real-estate template</div>
          <div className="grid cols-2" style={{ gap: 12 }}>
            {templates.map((t) => (
              <div key={t.id} className="card card-pad" style={{ cursor: "pointer", borderColor: form.subject === t.subject ? "var(--primary)" : undefined }}
                onClick={() => applyTemplate(t)}>
                <div className="row between">
                  <b>{t.name}</b>
                  {t.is_system && <span className="badge blue">template</span>}
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{t.subject}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <Field label="Subject line"><input className="input" value={form.subject} onChange={set("subject")} /></Field>
          <Field label="Email body (HTML)" hint="Merge fields: {{first_name}}, {{agent_name}}, {{brokerage}}, {{property_address}}, {{price}}">
            <textarea className="textarea" style={{ minHeight: 180, fontFamily: "monospace", fontSize: 12.5 }}
              value={form.body} onChange={set("body")} />
          </Field>
          <div className="section-title mt">Live preview</div>
          <div className="email-preview">
            <div className="ep-head"><b>Subject:</b> {renderPreview(form.subject) || "—"}</div>
            <div className="ep-body" dangerouslySetInnerHTML={{ __html: renderPreview(form.body) || "<p class='muted'>Your email will appear here.</p>" }} />
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="grid cols-2" style={{ gap: 14 }}>
            <Field label="Send to lead stage" hint="Leave blank to send to all contacts">
              <select className="select" value={form.segment_stage} onChange={set("segment_stage")}>
                <option value="">All contacts</option>
                {STAGES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </Field>
            <Field label="Filter by tags" hint="Comma separated (optional)">
              <input className="input" value={form.segment_tags} onChange={set("segment_tags")} placeholder="buyer, luxury" onBlur={previewSegment} />
            </Field>
          </div>
          <div className="card card-pad" style={{ background: "var(--primary-soft)", borderColor: "transparent" }}>
            <b style={{ fontSize: 22 }}>{segmentCount ?? "…"}</b> <span className="muted">contacts will receive this campaign</span>
          </div>
          <Field label="Schedule for later (optional)" hint="Leave blank to save as draft or send now">
            <input className="input" type="datetime-local" value={form.scheduled_at} onChange={set("scheduled_at")} />
          </Field>
        </>
      )}
    </Modal>
  );
}
