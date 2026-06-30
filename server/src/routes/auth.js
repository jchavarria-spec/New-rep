import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db/pool.js";
import { signToken } from "../utils/jwt.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { systemTemplates } from "../data/templates.js";

const router = Router();

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    brokerage: u.brokerage,
    plan: u.plan,
  };
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { name, email, password, brokerage } = req.body;
    if (!name || !email || !password)
      throw new HttpError(400, "name, email and password are required");
    if (password.length < 6)
      throw new HttpError(400, "Password must be at least 6 characters");

    const exists = await query("SELECT id FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    if (exists.rows[0]) throw new HttpError(409, "Email already registered");

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, brokerage)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, email.toLowerCase(), hash, brokerage || null]
    );
    const user = rows[0];

    // Seed this agent's library with the system templates.
    for (const t of systemTemplates) {
      await query(
        `INSERT INTO templates (user_id, scenario, name, subject, body, is_system)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [user.id, t.scenario, t.name, t.subject, t.body]
      );
    }

    const token = signToken({ sub: user.id });
    res.status(201).json({ token, user: publicUser(user) });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      throw new HttpError(400, "email and password are required");
    const { rows } = await query("SELECT * FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      throw new HttpError(401, "Invalid email or password");

    const token = signToken({ sub: user.id });
    res.json({ token, user: publicUser(user) });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

router.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name, brokerage, plan } = req.body;
    const { rows } = await query(
      `UPDATE users SET
         name = COALESCE($2, name),
         brokerage = COALESCE($3, brokerage),
         plan = COALESCE($4, plan)
       WHERE id = $1 RETURNING *`,
      [req.user.id, name ?? null, brokerage ?? null, plan ?? null]
    );
    res.json({ user: publicUser(rows[0]) });
  })
);

export default router;
