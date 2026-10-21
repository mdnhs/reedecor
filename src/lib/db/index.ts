import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

// Re-use connection in serverless / dev hot-reload environment
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

export const client = connectionString
  ? globalForDb.conn ??
    postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false, // Recommended for Supabase transaction pooler (pgbouncer)
    })
  : (undefined as unknown as postgres.Sql);

if (process.env.NODE_ENV !== "production" && client) {
  globalForDb.conn = client;
}

export const db = client ? drizzle(client, { schema }) : null;
export { schema };
