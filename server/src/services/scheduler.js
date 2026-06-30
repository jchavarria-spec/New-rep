import cron from "node-cron";
import { query } from "../db/pool.js";
import { sendEmail } from "./email.js";
import { publishPost } from "./social.js";
import { sendCampaign } from "./campaignSender.js";
import { renderMerge, mergeVarsFor } from "../utils/merge.js";

// --- Nurture sequence engine: send due enrollment steps -----------------
async function processSequenceSteps() {
  const { rows: due } = await query(
    `SELECT e.*, c.email, c.first_name, c.last_name,
            u.id AS user_id, u.name AS agent_name, u.brokerage
       FROM enrollments e
       JOIN sequences s   ON s.id = e.sequence_id AND s.is_active = true
       JOIN contacts c    ON c.id = e.contact_id
       JOIN users u       ON u.id = s.user_id
      WHERE e.status = 'active'
        AND e.next_send_at IS NOT NULL
        AND e.next_send_at <= now()
      LIMIT 100`
  );

  for (const e of due) {
    const { rows: steps } = await query(
      `SELECT * FROM sequence_steps
        WHERE sequence_id = $1 ORDER BY step_order ASC`,
      [e.sequence_id]
    );
    const step = steps[e.current_step];
    if (!step) {
      await query(
        `UPDATE enrollments SET status='completed', completed_at=now(),
           next_send_at=NULL WHERE id=$1`,
        [e.id]
      );
      continue;
    }

    const vars = mergeVarsFor(
      { first_name: e.first_name, last_name: e.last_name },
      { name: e.agent_name, brokerage: e.brokerage }
    );
    try {
      await sendEmail({
        to: e.email,
        subject: renderMerge(step.subject, vars),
        html: renderMerge(step.body, vars),
        customArgs: { kind: "sequence", sequence_id: e.sequence_id },
      });
    } catch (err) {
      console.error(`[sequence] send failed for ${e.email}:`, err.message);
      continue; // retry on next tick
    }

    const nextIndex = e.current_step + 1;
    const nextStep = steps[nextIndex];
    if (nextStep) {
      await query(
        `UPDATE enrollments
            SET current_step=$2,
                next_send_at = now() + ($3 || ' days')::interval
          WHERE id=$1`,
        [e.id, nextIndex, nextStep.delay_days]
      );
    } else {
      await query(
        `UPDATE enrollments
            SET current_step=$2, status='completed',
                completed_at=now(), next_send_at=NULL
          WHERE id=$1`,
        [e.id, nextIndex]
      );
    }
  }
}

// --- Scheduled email campaigns -----------------------------------------
async function processScheduledCampaigns() {
  const { rows: campaigns } = await query(
    `SELECT c.*, u.name AS u_name, u.brokerage AS u_brokerage
       FROM campaigns c JOIN users u ON u.id = c.user_id
      WHERE c.status = 'scheduled'
        AND c.scheduled_at IS NOT NULL
        AND c.scheduled_at <= now()
      LIMIT 25`
  );
  for (const c of campaigns) {
    const user = { id: c.user_id, name: c.u_name, brokerage: c.u_brokerage };
    try {
      await sendCampaign(c, user);
    } catch (err) {
      console.error(`[campaign] scheduled send failed:`, err.message);
    }
  }
}

// --- Scheduled social posts --------------------------------------------
async function processScheduledPosts() {
  const { rows: posts } = await query(
    `SELECT * FROM social_posts
      WHERE status = 'scheduled'
        AND scheduled_at IS NOT NULL
        AND scheduled_at <= now()
      LIMIT 25`
  );
  for (const post of posts) {
    try {
      const { ok, results } = await publishPost({
        caption: post.caption,
        imageUrl: post.image_url,
        platforms: post.platforms,
      });
      await query(
        `UPDATE social_posts
            SET status=$2, posted_at=now(), results=$3
          WHERE id=$1`,
        [post.id, ok ? "posted" : "failed", JSON.stringify(results)]
      );
    } catch (err) {
      console.error("[social] scheduled post failed:", err.message);
      await query("UPDATE social_posts SET status='failed' WHERE id=$1", [
        post.id,
      ]);
    }
  }
}

async function tick() {
  try {
    await processSequenceSteps();
    await processScheduledCampaigns();
    await processScheduledPosts();
  } catch (err) {
    console.error("[scheduler] tick error:", err.message);
  }
}

export function startScheduler() {
  // Run every minute. Idempotent and safe for an MVP single instance.
  cron.schedule("* * * * *", tick);
  console.log("[scheduler] started (every minute)");
}
