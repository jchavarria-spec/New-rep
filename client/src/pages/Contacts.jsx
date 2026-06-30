import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Modal, Field, StatusBadge, Empty, Loading, useToast } from "../components/ui.jsx";

const STAGES = ["new", "nurturing", "active", "client", "past_client", "lost"];
const blank = { first_name: "", last_name: "", email: "", phone: "", stage: "new", tags: "", source: "", notes: "" };

export default function Contacts() {
  const toast = useToast();
  const [contacts, setContacts] = useState(null);
  const [stage, setStage] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    const params = new URLSearchParams();
    if (stage) params.set("stage", stage);
    if (q) params.set("q", q);
    const { contacts } = await api.get(`/contacts?${params}`);
    setContacts(contacts);
  };

  useEffect(() => { load().catch((e) => toast.error(e.message)); }, [stage, q]);

  const save = async (form) => {
    const payload = {
      ...form,
      tags: form.tags
        ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
    };
    try {
      if (form.id) await api.patch(`/contacts/${form.id}`, payload);
      else await api.post("/contacts", payload);
      toast.success("Contact saved");
      setEditing(null);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (id) => {
    if (!confirm("Delete this contact?")) return;
    await api.del(`/contacts/${id}`);
    toast.success("Contact deleted");
    load();
  };

  if (!contacts) return <Loading />;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row wrap between">
        <div className="row gap-sm wrap">
          <input className="input" style={{ width: 240 }} placeholder="🔍 Search name or email"
            value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="select" style={{ width: 170 }} value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">All stages</option>
            {STAGES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </div>
        <div className="row gap-sm">
          <button className="btn secondary" onClick={() => setImporting(true)}>⬆ Import CSV</button>
          <button className="btn" onClick={() => setEditing({ ...blank })}>+ Add contact</button>
        </div>
      </div>

      <div className="card">
        {contacts.length === 0 ? (
          <Empty icon="👥" title="No contacts found"
            action={<button className="btn" onClick={() => setEditing({ ...blank })}>Add your first lead</button>} />
        ) : (
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Stage</th><th>Tags</th><th>Source</th><th></th></tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td className="name">{c.first_name} {c.last_name}</td>
                  <td className="muted">{c.email}</td>
                  <td><StatusBadge status={c.stage} /></td>
                  <td>
                    <div className="row gap-sm wrap">
                      {c.tags.slice(0, 3).map((t) => <span key={t} className="tag-chip">{t}</span>)}
                    </div>
                  </td>
                  <td className="muted">{c.source || "—"}</td>
                  <td>
                    <div className="row gap-sm">
                      <button className="btn ghost sm" onClick={() => setEditing({
                        ...c, tags: (c.tags || []).join(", ")
                      })}>Edit</button>
                      <button className="btn ghost sm" onClick={() => remove(c.id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="muted">{contacts.length} contact{contacts.length === 1 ? "" : "s"}</p>

      {editing && (
        <ContactModal contact={editing} onClose={() => setEditing(null)} onSave={save} />
      )}
      {importing && (
        <ImportModal onClose={() => setImporting(false)} onDone={() => { setImporting(false); load(); }} />
      )}
    </div>
  );
}

function ContactModal({ contact, onClose, onSave }) {
  const [form, setForm] = useState(contact);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Modal title={form.id ? "Edit contact" : "Add contact"} onClose={onClose}
      footer={<>
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={() => onSave(form)}>Save contact</button>
      </>}>
      <div className="grid cols-2" style={{ gap: 14 }}>
        <Field label="First name"><input className="input" value={form.first_name} onChange={set("first_name")} /></Field>
        <Field label="Last name"><input className="input" value={form.last_name || ""} onChange={set("last_name")} /></Field>
      </div>
      <Field label="Email"><input className="input" type="email" value={form.email} onChange={set("email")} /></Field>
      <div className="grid cols-2" style={{ gap: 14 }}>
        <Field label="Phone"><input className="input" value={form.phone || ""} onChange={set("phone")} /></Field>
        <Field label="Stage">
          <select className="select" value={form.stage} onChange={set("stage")}>
            {STAGES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid cols-2" style={{ gap: 14 }}>
        <Field label="Tags" hint="Comma separated"><input className="input" value={form.tags || ""} onChange={set("tags")} placeholder="buyer, luxury" /></Field>
        <Field label="Source"><input className="input" value={form.source || ""} onChange={set("source")} placeholder="Zillow" /></Field>
      </div>
      <Field label="Notes"><textarea className="textarea" value={form.notes || ""} onChange={set("notes")} /></Field>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }) {
  const toast = useToast();
  const [text, setText] = useState("first_name,last_name,email,phone,stage\nAlex,Rivera,alex@example.com,555-2020,new");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const lines = text.trim().split("\n");
      const headers = lines[0].split(",").map((h) => h.trim());
      const rows = lines.slice(1).map((line) => {
        const cells = line.split(",");
        const obj = {};
        headers.forEach((h, i) => (obj[h] = (cells[i] || "").trim()));
        return obj;
      });
      const { imported } = await api.post("/contacts/bulk", { contacts: rows });
      toast.success(`Imported ${imported} contacts`);
      onDone();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal title="Import contacts (CSV)" onClose={onClose}
      footer={<>
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={run} disabled={busy}>{busy ? "Importing…" : "Import"}</button>
      </>}>
      <Field label="Paste CSV" hint="First row is the header. Columns: first_name, last_name, email, phone, stage, tags, source">
        <textarea className="textarea" style={{ minHeight: 180, fontFamily: "monospace", fontSize: 12.5 }}
          value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
    </Modal>
  );
}
