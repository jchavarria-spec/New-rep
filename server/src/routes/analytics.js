import { Router } from "express";
import { query } from "../db/pool.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { emailMockMode } from "../config.js";

const router = Router();
router.use(requireAuth);

// Overview metrics for the dashboard.
router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const uid = req.user.id;

    const totals = await query(
      `SELECT
         COUNT(r.id)::int AS sent,
         COUNT(r.id) FILTER (WHERE r.opened_at IS NOT NULL)::int AS opened,
         COUNT(r.id) FILTER (WHERE r.clicked_at IS NOT NULL)::int AS clicked
       FROM campaign_recipients r
       JOIN campaigns c ON c.id = r.campaign_id
      WHERE c.user_id = $1`,
      [uid]
    );

    const counts = await query(
      `SELECT
         (SELECT count(*)::int FROM contacts  WHERE user_id=$1) AS contacts,
         (SELECT count(*)::int FROM campaigns WHERE user_id=$1) AS campaigns,
         (SELECT count(*)::int FROM campaigns WHERE user_id=$1 AND status='sent') AS campaigns_sent,
         (SELECT count(*)::int FROM social_posts WHERE user_id=$1 AND status='scheduled') AS scheduled_posts,
         (SELECT count(*)::int FROM enrollments e JOIN sequences s ON s.id=e.sequence_id
            WHERE s.user_id=$1 AND e.status='active') AS active_nurture`,
      [uid]
    );

    // 14-day open/click trend.
    const trend = await query(
      `SELECT to_char(d::date, 'YYYY-MM-DD') AS date,
              COALESCE(o.opens, 0)::int AS opens,
              COALESCE(cl.clicks, 0)::int AS clicks
         FROM generate_series(now()::date - interval '13 days', now()::date, interval '1 day') d
         LEFT JOIN (
           SELECT opened_at::date AS day, count(*) AS opens
             FROM campaign_recipients r JOIN campaigns c ON c.id=r.campaign_id
            WHERE c.user_id=$1 AND opened_at IS NOT NULL GROUP BY 1
         ) o ON o.day = d::date
         LEFT JOIN (
           SELECT clicked_at::date AS day, count(*) AS clicks
             FROM campaign_recipients r JOIN campaigns c ON c.id=r.campaign_id
            WHERE c.user_id=$1 AND clicked_at IS NOT NULL GROUP BY 1
         ) cl ON cl.day = d::date
        ORDER BY d`,
      [uid]
    );

    const t = totals.rows[0];
    const openRate = t.sent ? Math.round((t.opened / t.sent) * 1000) / 10 : 0;
    const clickRate = t.sent ? Math.round((t.clicked / t.sent) * 1000) / 10 : 0;

    res.json({
      email: { ...t, openRate, clickRate },
      counts: counts.rows[0],
      trend: trend.rows,
      mockMode: emailMockMode,
    });
  })
);

// Per-campaign performance table.
router.get(
  "/campaigns",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT c.id, c.name, c.sent_at, c.status,
              COUNT(r.id)::int AS sent,
              COUNT(r.id) FILTER (WHERE r.opened_at IS NOT NULL)::int AS opened,
              COUNT(r.id) FILTER (WHERE r.clicked_at IS NOT NULL)::int AS clicked
         FROM campaigns c
         LEFT JOIN campaign_recipients r ON r.campaign_id = c.id
        WHERE c.user_id = $1
        GROUP BY c.id
        ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json({ campaigns: rows });
  })
);

// Demo helper: simulate realistic opens & clicks on sent recipients.
// Useful when running in email mock mode (no live SendGrid webhook events).
router.post(
  "/simulate-engagement",
  asyncHandler(async (req, res) => {
    const uid = req.user.id;
    const opened = await query(
      `UPDATE campaign_recipients r
          SET status='opened', opened_at = now() - (random() * interval '10 days')
         FROM campaigns c
        WHERE r.campaign_id = c.id AND c.user_id = $1
          AND r.status = 'sent' AND random() < 0.55`,
      [uid]
    );
    const clicked = await query(
      `UPDATE campaign_recipients r
          SET status='clicked', clicked_at = COALESCE(r.opened_at, now()) + interval '2 minutes'
         FROM campaigns c
        WHERE r.campaign_id = c.id AND c.user_id = $1
          AND r.opened_at IS NOT NULL AND r.clicked_at IS NULL AND random() < 0.4`,
      [uid]
    );
    res.json({ opened: opened.rowCount, clicked: clicked.rowCount });
  })
);

export default router;
