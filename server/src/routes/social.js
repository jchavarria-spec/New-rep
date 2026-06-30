import { Router } from "express";
import { query } from "../db/pool.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { publishPost } from "../services/social.js";
import { socialMockMode } from "../config.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      "SELECT * FROM social_posts WHERE user_id = $1 ORDER BY COALESCE(scheduled_at, created_at) DESC",
      [req.user.id]
    );
    res.json({ posts: rows, mockMode: socialMockMode });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { caption, image_url, platforms, scheduled_at, publish_now } =
      req.body;
    if (!caption) throw new HttpError(400, "caption is required");
    const plats = Array.isArray(platforms) ? platforms : [];
    if (!plats.length)
      throw new HttpError(400, "Select at least one platform");

    if (publish_now) {
      const { ok, results } = await publishPost({
        caption,
        imageUrl: image_url,
        platforms: plats,
      });
      const { rows } = await query(
        `INSERT INTO social_posts
           (user_id, caption, image_url, platforms, status, posted_at, results)
         VALUES ($1,$2,$3,$4,$5, now(), $6) RETURNING *`,
        [
          req.user.id,
          caption,
          image_url || null,
          plats,
          ok ? "posted" : "failed",
          JSON.stringify(results),
        ]
      );
      return res.status(201).json({ post: rows[0] });
    }

    const { rows } = await query(
      `INSERT INTO social_posts
         (user_id, caption, image_url, platforms, status, scheduled_at)
       VALUES ($1,$2,$3,$4,'scheduled',$5) RETURNING *`,
      [req.user.id, caption, image_url || null, plats, scheduled_at || null]
    );
    res.status(201).json({ post: rows[0] });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await query("DELETE FROM social_posts WHERE id = $1 AND user_id = $2", [
      req.params.id,
      req.user.id,
    ]);
    res.status(204).end();
  })
);

export default router;
