import bcrypt from "bcryptjs";
import { pool, query } from "./pool.js";
import { systemTemplates } from "../data/templates.js";

const DEMO_EMAIL = "demo@reltor.app";
const DEMO_PASSWORD = "demo1234";

const firstNames = ["Olivia", "Liam", "Emma", "Noah", "Ava", "Ethan", "Sophia", "Mason", "Isabella", "Lucas", "Mia", "Henry", "Charlotte", "Jack", "Amelia", "James", "Harper", "Daniel", "Evelyn", "Michael"];
const lastNames = ["Reyes", "Patel", "Nguyen", "Johnson", "Garcia", "Smith", "Kim", "Brown", "Martinez", "Lee", "Davis", "Lopez", "Wilson", "Anderson", "Thomas"];
const stages = ["new", "nurturing", "active", "client", "past_client"];
const tagPool = ["buyer", "seller", "investor", "first-time", "luxury", "relocation", "downsizing"];
const sources = ["Zillow", "Open House", "Referral", "Website", "Facebook Ad"];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sample = (arr, n) => [...arr].sort(() => 0.5 - Math.random()).slice(0, n);

async function reset() {
  await query("DELETE FROM users WHERE email = $1", [DEMO_EMAIL]);
}

async function seed() {
  console.log("[seed] resetting demo account...");
  await reset();

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const { rows: userRows } = await query(
    `INSERT INTO users (name, email, password_hash, brokerage, plan)
     VALUES ($1,$2,$3,$4,'pro') RETURNING *`,
    ["Jordan Avery", DEMO_EMAIL, hash, "Skyline Realty Group"]
  );
  const user = userRows[0];

  // Templates
  for (const t of systemTemplates) {
    await query(
      `INSERT INTO templates (user_id, scenario, name, subject, body, is_system)
       VALUES ($1,$2,$3,$4,$5,true)`,
      [user.id, t.scenario, t.name, t.subject, t.body]
    );
  }

  // Contacts
  const contacts = [];
  for (let i = 0; i < 48; i++) {
    const fn = rand(firstNames);
    const ln = rand(lastNames);
    const email = `${fn}.${ln}${i}@example.com`.toLowerCase();
    const { rows } = await query(
      `INSERT INTO contacts (user_id, first_name, last_name, email, phone, stage, tags, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        user.id, fn, ln, email,
        `(555) ${100 + i}-${1000 + i}`,
        rand(stages),
        sample(tagPool, 1 + Math.floor(Math.random() * 2)),
        rand(sources),
      ]
    );
    contacts.push(rows[0]);
  }
  console.log(`[seed] ${contacts.length} contacts`);

  // Campaigns (sent) with recipients + engagement
  const campaignDefs = [
    { name: "Spring New Listing — 14 Maple Ave", scenario: "new_listing", days: 9 },
    { name: "Buyer Follow-Up Blast", scenario: "follow_up", days: 6 },
    { name: "Open House Invites — Saturday", scenario: "open_house", days: 3 },
    { name: "Just Sold Neighborhood Update", scenario: "just_sold", days: 1 },
  ];
  for (const def of campaignDefs) {
    const tpl = systemTemplates.find((t) => t.scenario === def.scenario);
    const { rows } = await query(
      `INSERT INTO campaigns (user_id, name, subject, body, scenario, status, sent_at, created_at)
       VALUES ($1,$2,$3,$4,$5,'sent', now() - ($6||' days')::interval, now() - ($6||' days')::interval)
       RETURNING *`,
      [user.id, def.name, tpl.subject, tpl.body, def.scenario, def.days]
    );
    const campaign = rows[0];
    const recipients = sample(contacts, 25 + Math.floor(Math.random() * 15));
    for (const c of recipients) {
      const opened = Math.random() < 0.58;
      const clicked = opened && Math.random() < 0.42;
      await query(
        `INSERT INTO campaign_recipients
           (campaign_id, contact_id, email, status, message_id, sent_at, opened_at, clicked_at)
         VALUES ($1,$2,$3,$4,$5,
                 now() - ($6||' days')::interval,
                 $7, $8)`,
        [
          campaign.id, c.id, c.email,
          clicked ? "clicked" : opened ? "opened" : "sent",
          `seed-${campaign.id.slice(0, 8)}-${c.id.slice(0, 8)}`,
          def.days,
          opened ? new Date(Date.now() - (def.days - 0.2) * 86400000) : null,
          clicked ? new Date(Date.now() - (def.days - 0.25) * 86400000) : null,
        ]
      );
    }
    console.log(`[seed] campaign "${def.name}" -> ${recipients.length} recipients`);
  }

  // Social posts
  const socialDefs = [
    { caption: "✨ JUST LISTED ✨ Stunning 4BR colonial in the heart of Oakwood. Swipe for the full tour! #JustListed #DreamHome", platforms: ["facebook", "instagram"], status: "posted", offset: -2 },
    { caption: "Open House this Saturday 1–3pm at 22 Birchwood Ln. Come say hi! 🏡☕", platforms: ["facebook"], status: "scheduled", offset: 2 },
    { caption: "5 staging tips that help homes sell faster 🧵 #RealEstateTips", platforms: ["instagram"], status: "scheduled", offset: 4 },
  ];
  for (const s of socialDefs) {
    await query(
      `INSERT INTO social_posts (user_id, caption, platforms, status, scheduled_at, posted_at, results)
       VALUES ($1,$2,$3,$4,
               now() + ($5||' days')::interval,
               $6, $7)`,
      [
        user.id, s.caption, s.platforms, s.status, s.offset,
        s.status === "posted" ? new Date() : null,
        s.status === "posted" ? JSON.stringify({ facebook: { ok: true, mock: true } }) : "{}",
      ]
    );
  }
  console.log(`[seed] ${socialDefs.length} social posts`);

  // Nurture sequence: New Lead Welcome (3 steps) with active enrollments
  const { rows: seqRows } = await query(
    `INSERT INTO sequences (user_id, name, description, trigger_stage)
     VALUES ($1,$2,$3,'new') RETURNING *`,
    [user.id, "New Lead Welcome", "Automatic 3-touch welcome for brand-new leads."]
  );
  const seq = seqRows[0];
  const steps = [
    { delay_days: 0, subject: "Welcome, {{first_name}}! 👋", body: "<p>Hi {{first_name}}, thanks for connecting! I'm {{agent_name}} with {{brokerage}}. I'll help you find the perfect home.</p>" },
    { delay_days: 2, subject: "A few homes you might love", body: "<p>Hi {{first_name}}, I hand-picked a few listings I think you'll like. Want me to send them over?</p>" },
    { delay_days: 5, subject: "Quick question, {{first_name}}", body: "<p>What's most important to you in your next home — location, space, or budget? Reply and I'll tailor your search.</p>" },
  ];
  let order = 0;
  for (const st of steps) {
    await query(
      `INSERT INTO sequence_steps (sequence_id, step_order, delay_days, subject, body)
       VALUES ($1,$2,$3,$4,$5)`,
      [seq.id, order++, st.delay_days, st.subject, st.body]
    );
  }
  const newLeads = contacts.filter((c) => c.stage === "new").slice(0, 8);
  for (const c of newLeads) {
    await query(
      `INSERT INTO enrollments (sequence_id, contact_id, current_step, next_send_at)
       VALUES ($1,$2,1, now() + interval '1 day')
       ON CONFLICT DO NOTHING`,
      [seq.id, c.id]
    );
  }
  console.log(`[seed] nurture sequence with ${newLeads.length} active enrollments`);

  console.log(`\n✅ Seed complete.\n   Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}\n`);
  await pool.end();
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
