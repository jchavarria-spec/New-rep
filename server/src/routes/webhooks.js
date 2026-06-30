import { Router } from "express";
import { query } from "../db/pool.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

/**
 * SendGrid Event Webhook — records opens and clicks for analytics.
 * Configure SendGrid to POST events to /api/webhooks/sendgrid.
 * https://docs.sendgrid.com/for-developers/tracking-events/event
 */
router.post(
  "/sendgrid",
  asyncHandler(async (req, res) => {
    const events = Array.isArray(req.body) ? req.body : [];
    for (const ev of events) {
      const messageId = ev.sg_message_id?.split(".")[0] || ev.smtp_id;
      if (!messageId) continue;
      if (ev.event === "open") {
        await query(
          `UPDATE campaign_recipients
              SET status = CASE WHEN status='clicked' THEN status ELSE 'opened' END,
                  opened_at = COALESCE(opened_at, to_timestamp($2))
            WHERE message_id LIKE $1 || '%'`,
          [messageId, ev.timestamp]
        );
      } else if (ev.event === "click") {
        await query(
          `UPDATE campaign_recipients
              SET status='clicked',
                  opened_at = COALESCE(opened_at, to_timestamp($2)),
                  clicked_at = COALESCE(clicked_at, to_timestamp($2))
            WHERE message_id LIKE $1 || '%'`,
          [messageId, ev.timestamp]
        );
      } else if (ev.event === "bounce" || ev.event === "dropped") {
        await query(
          `UPDATE campaign_recipients SET status='bounced'
            WHERE message_id LIKE $1 || '%'`,
          [messageId]
        );
      }
    }
    res.json({ received: events.length });
  })
);

export default router;
