import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import type { StaffUser } from "../../shared/schema.js";
import { tenants } from "../../shared/schema.js";
import { db } from "../db.js";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function setStaffSession(req: Request, user: StaffUser): Promise<void> {
  (req.session as any).staffId = user.id;
  (req.session as any).staffRole = user.role;
  (req.session as any).staffTenantId = user.tenantId ?? null;
  (req.session as any).staffPropertyId = user.propertyId ?? null;

  let tenantSlug: string | null = null;
  if (user.tenantId) {
    const [tenantRow] = await db
      .select({ slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.id, user.tenantId))
      .limit(1);
    tenantSlug = tenantRow?.slug ?? null;
  }
  (req.session as any).staffTenantSlug = tenantSlug;
}

export function safeUser(user: StaffUser): Omit<StaffUser, "passwordHash"> {
  const { passwordHash: _ph, ...safe } = user;
  return safe;
}
