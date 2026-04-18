import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const queryClient = postgres(process.env.DATABASE_URL, {
  max: 10,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(queryClient, { schema });

export const pgClient = queryClient;
