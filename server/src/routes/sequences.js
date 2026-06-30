import { Router } from "express";
import { query, withTransaction } from "../db/pool.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

const router = Router();
router.use(requireAuth);

async function loadSequence(userId, id) {
  const { rows } = await query(
    "SELECT * FROM sequences WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  if (!rows[0]) throw new HttpError(404, "Sequence not found");
  const { rows: steps } = await query(
    "SELECT * FROM sequence_steps WHERE sequence_id = $1 ORDER BY step_order ASC",
    [id]
  );
  return { ...rows[0], steps };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT s.*,
              (SELECT count(*)::int FROM sequence_steps st WHERE st.sequence_id = s.id) AS step_count,
              (SELECT count(*)::int FROM enrollments e WHERE e.sequence_id = s.id AND e.status='active') AS active_enrollments
         FROM sequences s WHERE s.user_id = $1 ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    res.json({ sequences: rows });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ sequence: await loadSequence(req.user.id, req.params.id) });
  })
);

// Create a sequence together with its ordered steps.
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, description, trigger_stage, steps } = req.body;
    if (!name) throw new HttpError(400, "name is required");
    const list = Array.isArray(steps) ? steps : [];

    const sequence = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO sequences (user_id, name, description, trigger_stage)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [req.user.id, name, description || null, trigger_stage || null]
      );
      const seq = rows[0];
      let order = 0;
      for (const step of list) {
        await client.query(
          `INSERT INTO sequence_steps (sequence_id, step_order, delay_days, subject, body)
           VALUES ($1,$2,$3,$4,$5)`,
          [seq.id, order++, step.delay_days ?? 0, step.subject, step.body]
        );
      }
      return seq;
    });

    res.status(201).json({ sequence: await loadSequence(req.user.id, sequence.id) });
  })
);

// Replace steps / update meta.
router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { name, description, trigger_stage, is_active, steps } = req.body;
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE sequences SET
           name = COALESCE($3, name),
           description = COALESCE($4, description),
           trigger_stage = COALESCE($5, trigger_stage),
           is_active = COALESCE($6, is_active)
         WHERE id = $1 AND user_id = $2`,
        [req.params.id, req.user.id, name ?? null, description ?? null, trigger_stage ?? null, is_active ?? null]
      );
      if (Array.isArray(steps)) {
        await client.query("DELETE FROM sequence_steps WHERE sequence_id = $1", [
          req.params.id,
        ]);
        let order = 0;
        for (const step of steps) {
          await client.query(
            `INSERT INTO sequence_steps (sequence_id, step_order, delay_days, subject, body)
             VALUES ($1,$2,$3,$4,$5)`,
            [req.params.id, order++, step.delay_days ?? 0, step.subject, step.body]
          );
        }
      }
    });
    res.json({ sequence: await loadSequence(req.user.id, req.params.id) });
  })
);

// Enroll contacts. Accepts explicit contact_ids or a stage filter.
router.post(
  "/:id/enroll",
  asyncHandler(async (req, res) => {
    const seq = await loadSequence(req.user.id, req.params.id);
    if (!seq.steps.length)
      throw new HttpError(400, "Add at least one step before enrolling");

    let contacts = [];
    if (Array.isArray(req.body.contact_ids) && req.body.contact_ids.length) {
      const { rows } = await query(
        "SELECT * FROM contacts WHERE user_id = $1 AND id = ANY($2)",
        [req.user.id, req.body.contact_ids]
      );
      contacts = rows;
    } else if (req.body.stage) {
      const { rows } = await query(
        "SELECT * FROM contacts WHERE user_id = $1 AND stage = $2",
        [req.user.id, req.body.stage]
      );
      contacts = rows;
    }

    const firstDelay = seq.steps[0].delay_days || 0;
    let enrolled = 0;
    for (const c of contacts) {
      const { rowCount } = await query(
        `INSERT INTO enrollments (sequence_id, contact_id, current_step, next_send_at)
         VALUES ($1,$2,0, now() + ($3 || ' days')::interval)
         ON CONFLICT (sequence_id, contact_id) DO NOTHING`,
        [seq.id, c.id, firstDelay]
      );
      enrolled += rowCount;
    }
    res.json({ enrolled });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await query("DELETE FROM sequences WHERE id = $1 AND user_id = $2", [
      req.params.id,
      req.user.id,
    ]);
    res.status(204).end();
  })
);

export default router;
