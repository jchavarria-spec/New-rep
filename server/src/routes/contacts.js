import { Router } from "express";
import { query } from "../db/pool.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

const router = Router();
router.use(requireAuth);

// List + filter (by stage, tag, free-text search)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { stage, tag, q } = req.query;
    const clauses = ["user_id = $1"];
    const params = [req.user.id];
    if (stage) {
      params.push(stage);
      clauses.push(`stage = $${params.length}`);
    }
    if (tag) {
      params.push([tag]);
      clauses.push(`tags && $${params.length}`);
    }
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      clauses.push(
        `(lower(first_name) LIKE $${params.length} OR lower(last_name) LIKE $${params.length} OR lower(email) LIKE $${params.length})`
      );
    }
    const { rows } = await query(
      `SELECT * FROM contacts WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC`,
      params
    );
    res.json({ contacts: rows });
  })
);

// Segment counts for the dashboard
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT stage, count(*)::int AS count
         FROM contacts WHERE user_id = $1 GROUP BY stage`,
      [req.user.id]
    );
    const byStage = Object.fromEntries(rows.map((r) => [r.stage, r.count]));
    const total = rows.reduce((s, r) => s + r.count, 0);
    res.json({ total, byStage });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { first_name, last_name, email, phone, stage, tags, source, notes } =
      req.body;
    if (!first_name || !email)
      throw new HttpError(400, "first_name and email are required");
    const { rows } = await query(
      `INSERT INTO contacts
         (user_id, first_name, last_name, email, phone, stage, tags, source, notes)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,'new'),COALESCE($7::text[],'{}'),$8,$9)
       ON CONFLICT (user_id, email) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name  = EXCLUDED.last_name,
         phone      = EXCLUDED.phone,
         updated_at = now()
       RETURNING *`,
      [
        req.user.id,
        first_name,
        last_name || null,
        email.toLowerCase(),
        phone || null,
        stage,
        tags,
        source || null,
        notes || null,
      ]
    );
    res.status(201).json({ contact: rows[0] });
  })
);

// Bulk import (CSV rows from the frontend)
router.post(
  "/bulk",
  asyncHandler(async (req, res) => {
    const list = Array.isArray(req.body.contacts) ? req.body.contacts : [];
    let imported = 0;
    for (const c of list) {
      if (!c.first_name || !c.email) continue;
      await query(
        `INSERT INTO contacts (user_id, first_name, last_name, email, phone, stage, tags, source)
         VALUES ($1,$2,$3,$4,$5,COALESCE($6,'new'),COALESCE($7::text[],'{}'),$8)
         ON CONFLICT (user_id, email) DO NOTHING`,
        [
          req.user.id,
          c.first_name,
          c.last_name || null,
          String(c.email).toLowerCase(),
          c.phone || null,
          c.stage || null,
          Array.isArray(c.tags) ? c.tags : null,
          c.source || "import",
        ]
      );
      imported++;
    }
    res.json({ imported });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { first_name, last_name, email, phone, stage, tags, source, notes } =
      req.body;
    const { rows } = await query(
      `UPDATE contacts SET
         first_name = COALESCE($3, first_name),
         last_name  = COALESCE($4, last_name),
         email      = COALESCE($5, email),
         phone      = COALESCE($6, phone),
         stage      = COALESCE($7, stage),
         tags       = COALESCE($8, tags),
         source     = COALESCE($9, source),
         notes      = COALESCE($10, notes),
         updated_at = now()
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [
        req.params.id,
        req.user.id,
        first_name ?? null,
        last_name ?? null,
        email ? email.toLowerCase() : null,
        phone ?? null,
        stage ?? null,
        tags ?? null,
        source ?? null,
        notes ?? null,
      ]
    );
    if (!rows[0]) throw new HttpError(404, "Contact not found");
    res.json({ contact: rows[0] });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await query("DELETE FROM contacts WHERE id = $1 AND user_id = $2", [
      req.params.id,
      req.user.id,
    ]);
    res.status(204).end();
  })
);

export default router;
