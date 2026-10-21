import { getSupabaseClient } from "./db";
import { hashPassword, verifyPassword } from "../auth/password";
import crypto from "node:crypto";

export type UserRole = "saas_admin" | "merchant" | "customer";
export type UserStatus = "active" | "suspended";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export class AuthService {
  private get client() {
    return getSupabaseClient();
  }

  /**
   * Seed the 3 default users (SaaS Admin, Merchant, Customer) if not already in Supabase
   */
  async ensureSeedUsers(): Promise<void> {
    if (!this.client) return;

    const seedUsers = [
      {
        id: "user-admin",
        email: "admin@artisanstudio.com",
        name: "SaaS Admin (Superuser)",
        role: "saas_admin" as UserRole,
        password: "admin123",
      },
      {
        id: "user-merchant",
        email: "merchant@artisanstudio.com",
        name: "Luxury Oak Merchant",
        role: "merchant" as UserRole,
        password: "merchant123",
      },
      {
        id: "user-customer",
        email: "customer@artisanstudio.com",
        name: "Sophia Rahman (Customer)",
        role: "customer" as UserRole,
        password: "customer123",
      },
    ];

    for (const seed of seedUsers) {
      const { data: existing } = await this.client
        .from("app_users")
        .select("id")
        .eq("email", seed.email)
        .maybeSingle();

      if (!existing) {
        const passwordHash = hashPassword(seed.password);
        await this.client.from("app_users").insert({
          id: seed.id,
          email: seed.email,
          name: seed.name,
          role: seed.role,
          status: "active",
          password_hash: passwordHash,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Register a new user
   */
  async createUser(
    email: string,
    passwordPlain: string,
    name: string,
    role: UserRole = "customer"
  ): Promise<AppUser> {
    if (!this.client) {
      throw new Error("Supabase client is not initialized");
    }

    const { data: existing } = await this.client
      .from("app_users")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (existing) {
      throw new Error("An account with this email already exists");
    }

    const id = `user-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const passwordHash = hashPassword(passwordPlain);

    const { data, error } = await this.client
      .from("app_users")
      .insert({
        id,
        email: email.toLowerCase().trim(),
        name: name.trim(),
        role,
        status: "active",
        password_hash: passwordHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Failed to create user");
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role as UserRole,
      status: data.status as UserStatus,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Verify credentials for login
   */
  async verifyCredentials(email: string, passwordPlain: string): Promise<AppUser | null> {
    if (!this.client) return null;

    // Ensure seeds exist if table was newly created
    await this.ensureSeedUsers();

    const { data: user, error } = await this.client
      .from("app_users")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (error || !user) return null;
    if (user.status === "suspended") {
      throw new Error("This account has been suspended by the SaaS Admin");
    }

    const isValid = verifyPassword(passwordPlain, user.password_hash);
    if (!isValid) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      status: user.status as UserStatus,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  /**
   * Create session token in Supabase
   */
  async createSession(userId: string): Promise<string> {
    if (!this.client) throw new Error("Supabase client is not available");

    const token = crypto.randomBytes(32).toString("hex");
    const id = `sess-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    await this.client.from("app_sessions").insert({
      id,
      user_id: userId,
      token,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    });

    return token;
  }

  /**
   * Validate session token and return user
   */
  async validateSession(token: string): Promise<AppUser | null> {
    if (!this.client || !token) return null;

    const { data: session, error } = await this.client
      .from("app_sessions")
      .select("*, app_users(*)")
      .eq("token", token)
      .maybeSingle();

    if (error || !session) return null;

    // Check expiry
    if (new Date(session.expires_at) < new Date()) {
      await this.client.from("app_sessions").delete().eq("token", token);
      return null;
    }

    const user = session.app_users;
    if (!user || user.status === "suspended") return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      status: user.status as UserStatus,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  /**
   * Destroy session token (logout)
   */
  async deleteSession(token: string): Promise<void> {
    if (!this.client || !token) return;
    await this.client.from("app_sessions").delete().eq("token", token);
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<AppUser | null> {
    if (!this.client) return null;
    const { data: user } = await this.client
      .from("app_users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      status: user.status as UserStatus,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  // -------------------------------------------------------------------------
  // RBAC Operations (SaaS Admin Exclusive)
  // -------------------------------------------------------------------------

  /**
   * Get all registered users (RBAC Dashboard)
   */
  async getAllUsers(): Promise<AppUser[]> {
    if (!this.client) return [];
    await this.ensureSeedUsers();

    const { data, error } = await this.client
      .from("app_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    return data.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role as UserRole,
      status: u.status as UserStatus,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
    }));
  }

  /**
   * Change user role (saas_admin can assign saas_admin, merchant, or customer)
   */
  async updateUserRole(userId: string, newRole: UserRole): Promise<AppUser | null> {
    if (!this.client) return null;

    const { data, error } = await this.client
      .from("app_users")
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("*")
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role as UserRole,
      status: data.status as UserStatus,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Change user status (active / suspended)
   */
  async updateUserStatus(userId: string, status: UserStatus): Promise<AppUser | null> {
    if (!this.client) return null;

    const { data, error } = await this.client
      .from("app_users")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("*")
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role as UserRole,
      status: data.status as UserStatus,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<boolean> {
    if (!this.client) return false;
    const { error } = await this.client.from("app_users").delete().eq("id", userId);
    return !error;
  }
}

export const authService = new AuthService();
