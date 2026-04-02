import { Router } from "express";
import { db } from "./db.js";
import { staffUsers } from "../shared/schema.js";
import { eq } from "drizzle-orm";
import { verifyPassword, setStaffSession, safeUser } from "./helpers/authHelpers.js";
import { requireStaff } from "./middleware/auth.js";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const [user] = await db.select().from(staffUsers).where(eq(staffUsers.email, email.toLowerCase().trim()));
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    await db.update(staffUsers)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(staffUsers.id, user.id));

    setStaffSession(req, user);
    req.session.save((err) => {
      if (err) {
        console.error("[auth] session save error:", err);
        return res.status(500).json({ message: "Session error" });
      }
      return res.json({ user: safeUser(user) });
    });
  } catch (err) {
    console.error("[auth] login error:", err);
    return res.status(500).json({ message: "Login error" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    const isDev = process.env.NODE_ENV !== "production";
    res.clearCookie("connect.sid", {
      domain: process.env.COOKIE_DOMAIN || undefined,
    });
    res.json({ ok: true });
  });
});

router.get("/me", requireStaff, async (req, res) => {
  try {
    const sess = req.session as any;
    const [user] = await db.select().from(staffUsers).where(eq(staffUsers.id, sess.staffId));
    if (!user) return res.status(401).json({ message: "Invalid session" });
    return res.json({ user: safeUser(user) });
  } catch (err) {
    return res.status(500).json({ message: "Session error" });
  }
});

export default router;
