import { Router } from "express";
import { query } from "../db/pool.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT * FROM templates WHERE user_id = $1
       ORDER BY is_system DESC, created_at DESC`,
      [req.user.id]
    );
    res.json({ templates: rows });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { scenario, name, subject, body } = req.body;
    if (!name || !subject || !body)
      throw new HttpError(400, "name, subject and body are required");
    const { rows } = await query(
      `INSERT INTO templates (user_id, scenario, name, subject, body, is_system)
       VALUES ($1, $2, $3, $4, $5, false) RETURNING *`,
      [req.user.id, scenario || "custom", name, subject, body]
    );
    res.status(201).json({ template: rows[0] });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { name, subject, body, scenario } = req.body;
    const { rows } = await query(
      `UPDATE templates SET
         name = COALESCE($3, name),
         subject = COALESCE($4, subject),
         body = COALESCE($5, body),
         scenario = COALESCE($6, scenario)
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id, name ?? null, subject ?? null, body ?? null, scenario ?? null]
    );
    if (!rows[0]) throw new HttpError(404, "Template not found");
    res.json({ template: rows[0] });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await query(
      "DELETE FROM templates WHERE id = $1 AND user_id = $2 AND is_system = false",
      [req.params.id, req.user.id]
    );
    res.status(204).end();
  })
);

export default router;
