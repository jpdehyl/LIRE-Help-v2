// Run:
//   DATABASE_URL=<your-url> \
//   BOOTSTRAP_ADMIN_EMAIL=<email> \
//   BOOTSTRAP_ADMIN_PASSWORD=<strong-password> \
//   BOOTSTRAP_ADMIN_NAME="Demo Admin" \
//   npx tsx scripts/seed-superadmin.ts

import postgres from "postgres";
import bcrypt from "bcrypt";

const ALLOWED_ROLES = new Set(["superadmin", "owner", "manager"]);

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} is required`);
    process.exit(1);
  }
  return value;
}

const DATABASE_URL = requireEnv("DATABASE_URL");

const sql = postgres(DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const email = requireEnv("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const password = requireEnv("BOOTSTRAP_ADMIN_PASSWORD");
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Demo Admin";
  const role = process.env.BOOTSTRAP_ADMIN_ROLE?.trim() || "superadmin";

  if (!ALLOWED_ROLES.has(role)) {
    console.error(`BOOTSTRAP_ADMIN_ROLE must be one of: ${Array.from(ALLOWED_ROLES).join(", ")}`);
    process.exit(1);
  }

  if (password.length < 12) {
    console.error("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Create staff_users table if not exists
  await sql`
    CREATE TABLE IF NOT EXISTS staff_users (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'readonly',
      tenant_id VARCHAR,
      property_id VARCHAR,
      is_active BOOLEAN NOT NULL DEFAULT true,
      whatsapp_number TEXT,
      last_login_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `;

  // Upsert bootstrap admin
  const [user] = await sql`
    INSERT INTO staff_users (email, password_hash, name, role)
    VALUES (${email}, ${passwordHash}, ${name}, ${role})
    ON CONFLICT (email) DO UPDATE SET
      password_hash = ${passwordHash},
      role = ${role},
      is_active = true,
      updated_at = now()
    RETURNING id, email, role
  `;

  console.log("Bootstrap admin ready:", user);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
