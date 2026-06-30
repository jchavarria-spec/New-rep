import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Modal, Field, Empty, Loading, useToast } from "../components/ui.jsx";

const STAGES = ["new", "nurturing", "active", "client", "past_client", "lost"];

const newStep = () => ({ delay_days: 1, subject: "", body: "" });

export default function Sequences() {
  const toast = useToast();
  const [sequences, setSequences] = useState(null);
  const [editing, setEditing] = useState(null);
  const [enrolling, setEnrolling] = useState(null);

  const load = async () => {
    const { sequences } = await api.get("/sequences");
    setSequences(sequences);
  };
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  const remove = async (id) => {
    if (!confirm("Delete this sequence? Active enrollments will stop.")) return;
    await api.del(`/sequences/${id}`);
    load();
  };

  if (!sequences) return <Loading />;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row between">
        <p className="muted">{sequences.length} automated sequence{sequences.length === 1 ? "" : "s"}</p>
        <button className="btn" onClick={() => setEditing({ name: "", description: "", trigger_stage: "", steps: [newStep()] })}>+ New sequence</button>
      </div>

      {sequences.length === 0 ? (
        <div className="card"><Empty icon="🔁" title="No nurture sequences yet"
          action={<button className="btn" onClick={() => setEditing({ name: "", description: "", trigger_stage: "", steps: [newStep()] })}>Create a sequence</button>}>
          Build an automated drip — e.g. a 3-touch welcome for every new lead — and let it run on autopilot.
        </Empty></div>
      ) : (
        <div className="grid cols-2">
          {sequences.map((s) => (
            <div key={s.id} className="card card-pad">
              <div className="row between">
                <div>
                  <h3>{s.name}</h3>
                  <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{s.description || "No description"}</p>
                </div>
                <span className={`badge ${s.is_active ? "green" : ""}`}>
                  <span className="dot" />{s.is_active ? "active" : "paused"}
                </span>
              </div>
              <div className="row gap-sm wrap mt">
                <span className="tag-chip">📧 {s.step_count} steps</span>
                <span className="tag-chip">👤 {s.active_enrollments} enrolled</span>
                {s.trigger_stage && <span className="tag-chip">⚡ auto: {s.trigger_stage.replace("_", " ")}</span>}
              </div>
              <div className="row gap-sm mt-lg">
                <button className="btn sm" onClick={() => setEnrolling(s)}>Enroll contacts</button>
                <button className="btn secondary sm" onClick={async () => setEditing(await api.get(`/sequences/${s.id}`).then((r) => r.sequence))}>Edit</button>
                <button className="btn ghost sm right" onClick={() => remove(s.id)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <SequenceEditor seq={editing} onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); load(); }} />
      )}
      {enrolling && (
        <EnrollModal seq={enrolling} onClose={() => setEnrolling(null)}
          onDone={() => { setEnrolling(null); load(); }} />
      )}
    </div>
  );
}

function SequenceEditor({ seq, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: seq.name, description: seq.description || "", trigger_stage: seq.trigger_stage || "",
    steps: seq.steps?.length ? seq.steps.map((s) => ({ delay_days: s.delay_days, subject: s.subject, body: s.body })) : [newStep()],
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const setStep = (i, k, v) => {
    const steps = [...form.steps];
    steps[i] = { ...steps[i], [k]: v };
    setForm({ ...form, steps });
  };
  const addStep = () => setForm({ ...form, steps: [...form.steps, newStep()] });
  const removeStep = (i) => setForm({ ...form, steps: form.steps.filter((_, x) => x !== i) });

  const save = async () => {
    if (!form.name) return toast.error("Name your sequence");
    if (form.steps.some((s) => !s.subject || !s.body)) return toast.error("Every step needs a subject and body");
    setBusy(true);
    try {
      const payload = { ...form, trigger_stage: form.trigger_stage || null };
      if (seq.id) await api.patch(`/sequences/${seq.id}`, payload);
      else await api.post("/sequences", payload);
      toast.success("Sequence saved");
      onDone();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal size="lg" title={seq.id ? "Edit sequence" : "New nurture sequence"} onClose={onClose}
      footer={<>
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={save} disabled={busy}>Save sequence</button>
      </>}>
      <div className="grid cols-2" style={{ gap: 14 }}>
        <Field label="Sequence name"><input className="input" value={form.name} onChange={set("name")} placeholder="New Lead Welcome" /></Field>
        <Field label="Auto-enroll stage" hint="Optional">
          <select className="select" value={form.trigger_stage} onChange={set("trigger_stage")}>
            <option value="">Manual enrollment</option>
            {STAGES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Description"><input className="input" value={form.description} onChange={set("description")} /></Field>

      <div className="section-title mt">Email steps</div>
      <div className="grid" style={{ gap: 12 }}>
        {form.steps.map((s, i) => (
          <div key={i} className="card card-pad">
            <div className="row between" style={{ marginBottom: 10 }}>
              <b>Step {i + 1}</b>
              {form.steps.length > 1 && <button className="btn ghost sm" onClick={() => removeStep(i)}>Remove</button>}
            </div>
            <div className="row gap-sm" style={{ marginBottom: 10 }}>
              <span className="muted">Send</span>
              <input className="input" style={{ width: 70 }} type="number" min="0" value={s.delay_days}
                onChange={(e) => setStep(i, "delay_days", Number(e.target.value))} />
              <span className="muted">days after {i === 0 ? "enrollment" : "previous step"}</span>
            </div>
            <Field label="Subject"><input className="input" value={s.subject} onChange={(e) => setStep(i, "subject", e.target.value)} placeholder="Welcome, {{first_name}}!" /></Field>
            <Field label="Body (HTML)"><textarea className="textarea" value={s.body} onChange={(e) => setStep(i, "body", e.target.value)} placeholder="<p>Hi {{first_name}}…</p>" /></Field>
          </div>
        ))}
      </div>
      <button className="btn secondary mt" onClick={addStep}>+ Add step</button>
    </Modal>
  );
}

function EnrollModal({ seq, onClose, onDone }) {
  const toast = useToast();
  const [stage, setStage] = useState("new");
  const [busy, setBusy] = useState(false);

  const enroll = async () => {
    setBusy(true);
    try {
      const { enrolled } = await api.post(`/sequences/${seq.id}/enroll`, { stage });
      toast.success(`Enrolled ${enrolled} contact${enrolled === 1 ? "" : "s"}`);
      onDone();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal title={`Enroll contacts — ${seq.name}`} onClose={onClose}
      footer={<>
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={enroll} disabled={busy}>Enroll</button>
      </>}>
      <p className="muted" style={{ marginBottom: 16 }}>
        Enroll all contacts in a given stage. They'll start receiving the sequence on schedule. Already-enrolled contacts are skipped.
      </p>
      <Field label="Lead stage">
        <select className="select" value={stage} onChange={(e) => setStage(e.target.value)}>
          {STAGES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
      </Field>
    </Modal>
  );
}
