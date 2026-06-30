import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Modal, Field, StatusBadge, Empty, Loading, useToast } from "../components/ui.jsx";

const PLATFORMS = [
  { id: "facebook", label: "Facebook", icon: "📘" },
  { id: "instagram", label: "Instagram", icon: "📸" },
];

export default function Social() {
  const toast = useToast();
  const [posts, setPosts] = useState(null);
  const [mockMode, setMockMode] = useState(false);
  const [composing, setComposing] = useState(false);

  const load = async () => {
    const { posts, mockMode } = await api.get("/social");
    setPosts(posts);
    setMockMode(mockMode);
  };
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  const remove = async (id) => {
    if (!confirm("Delete this post?")) return;
    await api.del(`/social/${id}`);
    load();
  };

  if (!posts) return <Loading />;

  const groups = {
    scheduled: posts.filter((p) => p.status === "scheduled"),
    posted: posts.filter((p) => p.status === "posted"),
    failed: posts.filter((p) => p.status === "failed"),
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      {mockMode && (
        <div className="demo-note" style={{ margin: 0 }}>
          ⚙️ Social posting is in <b>mock mode</b> — add Meta Graph API tokens in <code>.env</code> to post live to Facebook & Instagram.
        </div>
      )}
      <div className="row between">
        <p className="muted">{posts.length} post{posts.length === 1 ? "" : "s"} in your queue</p>
        <button className="btn" onClick={() => setComposing(true)}>+ New post</button>
      </div>

      {posts.length === 0 ? (
        <div className="card"><Empty icon="📱" title="No posts yet"
          action={<button className="btn" onClick={() => setComposing(true)}>Compose a post</button>}>
          Queue content for Facebook and Instagram and we'll publish it on schedule.
        </Empty></div>
      ) : (
        <div className="grid" style={{ gap: 18 }}>
          {["scheduled", "posted", "failed"].map((key) =>
            groups[key].length ? (
              <div key={key}>
                <div className="section-title">{key} ({groups[key].length})</div>
                <div className="grid cols-3">
                  {groups[key].map((p) => (
                    <div key={p.id} className="card card-pad">
                      <div className="row between" style={{ marginBottom: 10 }}>
                        <div className="row gap-sm">
                          {p.platforms.map((pl) => {
                            const meta = PLATFORMS.find((x) => x.id === pl);
                            return <span key={pl} className="badge">{meta?.icon} {meta?.label}</span>;
                          })}
                        </div>
                        <StatusBadge status={p.status} />
                      </div>
                      {p.image_url && (
                        <img src={p.image_url} alt="" style={{ width: "100%", borderRadius: 9, marginBottom: 10, maxHeight: 150, objectFit: "cover" }} />
                      )}
                      <div style={{ fontSize: 13.5, lineHeight: 1.5, minHeight: 60 }}>{p.caption}</div>
                      <div className="row between mt">
                        <span className="muted" style={{ fontSize: 12 }}>
                          {p.status === "posted"
                            ? `Posted ${p.posted_at ? new Date(p.posted_at).toLocaleDateString() : ""}`
                            : p.scheduled_at ? new Date(p.scheduled_at).toLocaleString() : "No date"}
                        </span>
                        <button className="btn ghost sm" onClick={() => remove(p.id)}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}

      {composing && (
        <Composer onClose={() => setComposing(false)} onDone={() => { setComposing(false); load(); }} />
      )}
    </div>
  );
}

function Composer({ onClose, onDone }) {
  const toast = useToast();
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [platforms, setPlatforms] = useState(["facebook", "instagram"]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (id) =>
    setPlatforms((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = async (publishNow) => {
    if (!caption) return toast.error("Write a caption");
    if (!platforms.length) return toast.error("Pick at least one platform");
    setBusy(true);
    try {
      await api.post("/social", {
        caption, image_url: imageUrl || null, platforms,
        scheduled_at: scheduledAt || null, publish_now: publishNow,
      });
      toast.success(publishNow ? "Published!" : "Post scheduled");
      onDone();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal title="Compose social post" onClose={onClose}
      footer={<>
        <button className="btn secondary" disabled={busy} onClick={() => submit(false)}>Schedule</button>
        <button className="btn" disabled={busy} onClick={() => submit(true)}>Post now</button>
      </>}>
      <Field label="Platforms">
        <div className="row gap-sm">
          {PLATFORMS.map((p) => (
            <div key={p.id} className={`checkbox-row ${platforms.includes(p.id) ? "on" : ""}`} onClick={() => toggle(p.id)}>
              <span>{p.icon}</span> {p.label}
            </div>
          ))}
        </div>
      </Field>
      <Field label="Caption">
        <textarea className="textarea" style={{ minHeight: 120 }} value={caption}
          onChange={(e) => setCaption(e.target.value)} placeholder="✨ JUST LISTED ✨ ..." />
      </Field>
      <Field label="Image URL" hint="Required for Instagram posts">
        <input className="input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…/listing.jpg" />
      </Field>
      <Field label="Schedule for" hint="Leave blank and use 'Post now' to publish immediately">
        <input className="input" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
      </Field>
    </Modal>
  );
}
