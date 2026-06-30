import { verifyToken } from "../utils/jwt.js";
import { query } from "../db/pool.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const payload = verifyToken(token);
    const { rows } = await query(
      "SELECT id, name, email, brokerage, plan FROM users WHERE id = $1",
      [payload.sub]
    );
    if (!rows[0]) return res.status(401).json({ error: "Invalid session" });
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
