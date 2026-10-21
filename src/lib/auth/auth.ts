import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "@/lib/db";

import { DEMO_MERCHANT } from "@/lib/constants";
export { DEMO_MERCHANT };

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || "demo_merchant_secret_key_antigravity_32_chars_long",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  database: db
    ? drizzleAdapter(db, {
        provider: "pg",
        schema: {
          user: schema.user,
          session: schema.session,
          account: schema.account,
          verification: schema.verification,
        },
      })
    : undefined,
  emailAndPassword: {
    enabled: true,
  },
});
