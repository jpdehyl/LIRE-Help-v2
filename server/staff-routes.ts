import { Router } from "express";
import { db } from "./db.js";
import { staffUsers } from "../shared/schema.js";
import { eq, and } from "drizzle-orm";
import { hashPassword, safeUser } from "./helpers/authHelpers.js";
import { requireStaff } from "./middleware/auth.js";

const router = Router();

router.get("/", requireStaff, async (req, res) => {
  try {
    const sess = req.session as any;
    const isSuperadmin = sess.staffRole === "superadmin";
    const tenantId = sess.staffTenantId as string | undefined;
    const rows = isSuperadmin
      ? await db.select().from(staffUsers).orderBy(staffUsers.createdAt)
      : tenantId
        ? await db.select().from(staffUsers).where(eq(staffUsers.tenantId, tenantId)).orderBy(staffUsers.createdAt)
        : [];
    res.json(rows.map(safeUser));
  } catch (err) {
    res.status(500).json({ message: "Error fetching staff" });
  }
});

router.post("/", requireStaff, async (req, res) => {
  try {
    const sess = req.session as any;
    const isSuperadmin = sess.staffRole === "superadmin";
    const isOwner = sess.staffRole === "owner";
    if (!isSuperadmin && !isOwner) return res.status(403).json({ message: "Insufficient permissions" });

    let { email, password, name, role, tenantId, propertyId, whatsappNumber } = req.body;
    if (!email || !password || !name) return res.status(400).json({ message: "email, password and name required" });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

    if (!isSuperadmin) {
      tenantId = sess.staffTenantId;
      if (!["manager", "staff", "readonly"].includes(role ?? "")) role = "staff";
    }

    const passwordHash = await hashPassword(password);
    const [created] = await db.insert(staffUsers).values({
      email: email.toLowerCase().trim(),
      passwordHash,
      name: name.trim(),
      role: role ?? "readonly",
      tenantId: tenantId ?? null,
      propertyId: propertyId ?? null,
      whatsappNumber: whatsappNumber ?? null,
    }).returning();
    res.status(201).json(safeUser(created));
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ message: "User with that email already exists" });
    res.status(500).json({ message: "Error creating user" });
  }
});

router.patch("/:id", requireStaff, async (req, res) => {
  try {
    const sess = req.session as any;
    const isSuperadmin = sess.staffRole === "superadmin";
    const isOwner = sess.staffRole === "owner";
    if (!isSuperadmin && !isOwner) return res.status(403).json({ message: "Insufficient permissions" });

    const { name, role, tenantId, propertyId, isActive, password, whatsappNumber } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (isActive !== undefined) updates.isActive = isActive;
    if (whatsappNumber !== undefined) updates.whatsappNumber = whatsappNumber;
    if (isSuperadmin) {
      if (role !== undefined) updates.role = role;
      if (tenantId !== undefined) updates.tenantId = tenantId;
      if (propertyId !== undefined) updates.propertyId = propertyId;
    } else if (isOwner && role !== undefined) {
      if (!["manager", "staff", "readonly"].includes(role)) return res.status(403).json({ message: "Cannot assign that role" });
      updates.role = role;
    }
    if (password) {
      if (password.length < 8) return res.status(400).json({ message: "Minimum 8 characters" });
      updates.passwordHash = await hashPassword(password);
    }

    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!userId) return res.status(400).json({ message: "User id is required" });

    const where = isSuperadmin
      ? eq(staffUsers.id, userId)
      : and(eq(staffUsers.id, userId), eq(staffUsers.tenantId, sess.staffTenantId));
    const [updated] = await db.update(staffUsers).set(updates).where(where).returning();
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json(safeUser(updated));
  } catch (err) {
    res.status(500).json({ message: "Error updating user" });
  }
});

router.delete("/:id", requireStaff, async (req, res) => {
  try {
    const sess = req.session as any;
    const isSuperadmin = sess.staffRole === "superadmin";
    const isOwner = sess.staffRole === "owner";
    if (!isSuperadmin && !isOwner) return res.status(403).json({ message: "Insufficient permissions" });

    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!userId) return res.status(400).json({ message: "User id is required" });

    const where = isSuperadmin
      ? eq(staffUsers.id, userId)
      : and(eq(staffUsers.id, userId), eq(staffUsers.tenantId, sess.staffTenantId));
    const [updated] = await db.update(staffUsers).set({ isActive: false, updatedAt: new Date() }).where(where).returning();
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Error deactivating user" });
  }
});

export default router;
