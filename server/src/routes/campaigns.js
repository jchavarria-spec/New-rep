import { Router } from "express";
import { query } from "../db/pool.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { sendCampaign, resolveSegment } from "../services/campaignSender.js";

const router = Router();
router.use(requireAuth);

// List campaigns with aggregated performance metrics.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT c.*,
              COUNT(r.id)::int AS recipients,
              COUNT(r.id) FILTER (WHERE r.status <> 'failed')::int AS delivered,
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

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      "SELECT * FROM campaigns WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (!rows[0]) throw new HttpError(404, "Campaign not found");
    const { rows: recipients } = await query(
      `SELECT r.*, c.first_name, c.last_name
         FROM campaign_recipients r
         JOIN contacts c ON c.id = r.contact_id
        WHERE r.campaign_id = $1 ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    res.json({ campaign: rows[0], recipients });
  })
);

// Preview how many contacts a segment will reach.
router.post(
  "/preview-segment",
  asyncHandler(async (req, res) => {
    const contacts = await resolveSegment(req.user.id, {
      segment_stage: req.body.segment_stage,
      segment_tags: req.body.segment_tags,
    });
    res.json({ count: contacts.length });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      name,
      subject,
      body,
      scenario,
      segment_stage,
      segment_tags,
      scheduled_at,
    } = req.body;
    if (!name || !subject || !body)
      throw new HttpError(400, "name, subject and body are required");
    const status = scheduled_at ? "scheduled" : "draft";
    const { rows } = await query(
      `INSERT INTO campaigns
         (user_id, name, subject, body, scenario, status, segment_stage, segment_tags, scheduled_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::text[],'{}'),$9) RETURNING *`,
      [
        req.user.id,
        name,
        subject,
        body,
        scenario || null,
        status,
        segment_stage || null,
        segment_tags || null,
        scheduled_at || null,
      ]
    );
    res.status(201).json({ campaign: rows[0] });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const fields = ["name", "subject", "body", "scenario", "segment_stage", "scheduled_at"];
    const sets = [];
    const params = [req.params.id, req.user.id];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        params.push(req.body[f]);
        sets.push(`${f} = $${params.length}`);
      }
    }
    if (req.body.segment_tags !== undefined) {
      params.push(req.body.segment_tags);
      sets.push(`segment_tags = $${params.length}`);
    }
    if (req.body.scheduled_at !== undefined) {
      sets.push(`status = ${req.body.scheduled_at ? "'scheduled'" : "'draft'"}`);
    }
    if (!sets.length) throw new HttpError(400, "No fields to update");
    const { rows } = await query(
      `UPDATE campaigns SET ${sets.join(", ")}
        WHERE id = $1 AND user_id = $2 AND status IN ('draft','scheduled')
        RETURNING *`,
      params
    );
    if (!rows[0]) throw new HttpError(404, "Campaign not found or already sent");
    res.json({ campaign: rows[0] });
  })
);

// Send immediately.
router.post(
  "/:id/send",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      "SELECT * FROM campaigns WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    const campaign = rows[0];
    if (!campaign) throw new HttpError(404, "Campaign not found");
    if (campaign.status === "sent")
      throw new HttpError(400, "Campaign already sent");
    const result = await sendCampaign(campaign, req.user);
    res.json({ ok: true, ...result });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await query("DELETE FROM campaigns WHERE id = $1 AND user_id = $2", [
      req.params.id,
      req.user.id,
    ]);
    res.status(204).end();
  })
);

export default router;
