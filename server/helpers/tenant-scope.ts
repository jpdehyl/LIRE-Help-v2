import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import { properties, type Property } from "../../shared/schema.js";

export class PropertyScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PropertyScopeError";
  }
}

export async function assertPropertyInTenant(propertyId: string, tenantId: string): Promise<Property> {
  const [row] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new PropertyScopeError("Property not found or not in tenant scope");
  return row;
}
