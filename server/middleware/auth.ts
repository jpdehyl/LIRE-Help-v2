import type { Request, Response, NextFunction } from "express";

const ADMIN_ROLES = ["superadmin", "owner", "manager"] as const;

function getSessionRole(req: Request): string | null {
  const sess = req.session as any;
  return typeof sess?.staffRole === "string" ? sess.staffRole : null;
}

function isAllowedRole(req: Request, allowedRoles: readonly string[]) {
  const role = getSessionRole(req);
  return role !== null && allowedRoles.includes(role);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const sess = req.session as any;
  if (!sess?.staffId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (isAllowedRole(req, ADMIN_ROLES)) {
    return next();
  }
  return res.status(403).json({ message: "Insufficient permissions" });
}

export function requireStaffRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const sess = req.session as any;
    if (!sess?.staffId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(sess.staffRole)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  const sess = req.session as any;
  if (!sess?.staffId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}
