import { query } from "../db/pool.js";
import { sendEmail } from "./email.js";
import { renderMerge, mergeVarsFor } from "../utils/merge.js";

// Resolve the contacts that match a campaign's segment for a given user.
export async function resolveSegment(userId, { segment_stage, segment_tags }) {
  const clauses = ["user_id = $1"];
  const params = [userId];
  if (segment_stage) {
    params.push(segment_stage);
    clauses.push(`stage = $${params.length}`);
  }
  if (segment_tags && segment_tags.length) {
    params.push(segment_tags);
    clauses.push(`tags && $${params.length}`);
  }
  const { rows } = await query(
    `SELECT * FROM contacts WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC`,
    params
  );
  return rows;
}

/**
 * Send a campaign now: expands the segment, emails each contact with merged
 * content, and records a recipient row per contact for analytics.
 */
export async function sendCampaign(campaign, user) {
  const contacts = await resolveSegment(user.id, campaign);

  await query("UPDATE campaigns SET status = 'sending' WHERE id = $1", [
    campaign.id,
  ]);

  let sent = 0;
  for (const contact of contacts) {
    const vars = mergeVarsFor(contact, user);
    const subject = renderMerge(campaign.subject, vars);
    const html = renderMerge(campaign.body, vars);
    try {
      const { messageId } = await sendEmail({
        to: contact.email,
        subject,
        html,
        customArgs: { kind: "campaign", campaign_id: campaign.id },
      });
      await query(
        `INSERT INTO campaign_recipients
           (campaign_id, contact_id, email, status, message_id, sent_at)
         VALUES ($1, $2, $3, 'sent', $4, now())`,
        [campaign.id, contact.id, contact.email, messageId]
      );
      sent++;
    } catch (err) {
      await query(
        `INSERT INTO campaign_recipients
           (campaign_id, contact_id, email, status)
         VALUES ($1, $2, $3, 'failed')`,
        [campaign.id, contact.id, contact.email]
      );
      console.error(`[campaign] send failed for ${contact.email}:`, err.message);
    }
  }

  await query(
    "UPDATE campaigns SET status = 'sent', sent_at = now() WHERE id = $1",
    [campaign.id]
  );
  return { recipients: contacts.length, sent };
}
