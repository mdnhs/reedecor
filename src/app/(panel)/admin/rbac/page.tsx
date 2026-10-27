"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/skeleton-patterns";
import { useAuth } from "@/lib/auth/auth-context";
import { UserRole, UserStatus } from "@/lib/supabase/auth-service";
import {
  ShieldCheck,
  Trash2,
  Lock,
  UserPlus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import type { MerchantPlan } from "@/lib/assets/types";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  plan: MerchantPlan;
  createdAt: string;
}

export default function AdminRbacPage() {
  const { user: currentUser, isSaasAdmin, isLoading: authLoading, demoMode, switchDemoRole } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("merchant");
  const [creatingUser, setCreatingUser] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      if (json.success && json.data) {
        setUsers(json.data);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      if (!isSaasAdmin) return;
      try {
        const res = await fetch("/api/admin/users");
        const json = await res.json();
        if (!ignore && json.success && json.data) {
          setUsers(json.data);
        }
      } catch (err) {
        console.error("Failed to load users:", err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, [isSaasAdmin]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!confirm(`Change this user's role to ${newRole.replace("_", " ")}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const json = await res.json();
      if (json.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
        showToast(`User role updated to ${newRole}`);
      } else {
        showToast(json.error || "Failed to update role", "error");
      }
    } catch {
      showToast("Network error updating role", "error");
    }
  };

  const handlePlanChange = async (userId: string, plan: MerchantPlan) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (json.success) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, plan } : u)));
        showToast(`Merchant plan set to ${plan}`);
      } else {
        showToast(json.error || "Failed to update plan", "error");
      }
    } catch {
      showToast("Network error updating plan", "error");
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: UserStatus) => {
    const nextStatus: UserStatus = currentStatus === "active" ? "suspended" : "active";
    if (nextStatus === "suspended" && !confirm("Suspend this user? They will be signed out of the studio.")) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (json.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status: nextStatus } : u))
        );
        showToast(`User account ${nextStatus === "suspended" ? "suspended" : "reactivated"}`);
      } else {
        showToast(json.error || "Failed to update status", "error");
      }
    } catch {
      showToast("Network error updating status", "error");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        showToast("User successfully removed");
      } else {
        showToast(json.error || "Failed to delete user", "error");
      }
    } catch {
      showToast("Network error deleting user", "error");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowCreateModal(false);
        setNewUserName("");
        setNewUserEmail("");
        setNewUserPassword("");
        fetchUsers();
        showToast(`User ${json.data.name} created as ${newUserRole}`);
      } else {
        showToast(json.error || "Creation failed", "error");
      }
    } catch {
      showToast("Network error creating user", "error");
    } finally {
      setCreatingUser(false);
    }
  };

  if (authLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  if (!isSaasAdmin) {
    return (
      <Card className="mx-auto my-12 max-w-md space-y-4 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-600">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="font-display text-lg font-bold text-stone-900">Admins only</h2>
          <p className="text-sm text-stone-500">
            You are signed in as <strong>{currentUser?.name || "User"}</strong>.
          </p>
        </div>
        {demoMode && (
          <Button onClick={() => switchDemoRole("saas_admin")} className="gap-2 bg-gradient-brand text-white">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>Switch to admin</span>
          </Button>
        )}
      </Card>
    );
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalAdmins = users.filter((u) => u.role === "saas_admin").length;
  const totalMerchants = users.filter((u) => u.role === "merchant").length;
  const totalCustomers = users.filter((u) => u.role === "customer").length;
  const selectClass =
    "h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-stone-900 disabled:opacity-50";

  return (
    <div className="max-w-6xl space-y-6">
        {notification && (
          <div
            role={notification.type === "error" ? "alert" : "status"}
            className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
              notification.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-stone-900">
              {loading ? "Users" : `${users.length} ${users.length === 1 ? "user" : "users"}`}
            </h2>
            <p className="text-sm text-stone-500">
              {loading
                ? "Loading..."
                : `${totalAdmins} admin · ${totalMerchants} merchant · ${totalCustomers} customer`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              <span>Refresh</span>
            </Button>
            <Button size="sm" onClick={() => setShowCreateModal(true)} className="gap-1.5 bg-gradient-brand text-white">
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Add user</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
            <Input
              type="search"
              aria-label="Search users by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              className="pl-9"
            />
          </div>
          <select
            aria-label="Filter by role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={selectClass}
          >
            <option value="all">All roles</option>
            <option value="saas_admin">SaaS admins</option>
            <option value="merchant">Merchants</option>
            <option value="customer">Customers</option>
          </select>
        </div>

        {loading ? (
          <TableSkeleton rows={5} />
        ) : filteredUsers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-200 py-12 text-center text-sm text-stone-500">
            {users.length === 0 ? "No users yet." : "No matches."}
          </p>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-176 text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs text-stone-500">
                  <th scope="col" className="px-4 py-3 font-medium">User</th>
                  <th scope="col" className="px-4 py-3 font-medium">Role</th>
                  <th scope="col" className="px-4 py-3 font-medium">Plan</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredUsers.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-medium text-stone-900">
                          <span>{u.name}</span>
                          {isSelf && (
                            <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-stone-500">{u.email}</div>
                      </td>

                      <td className="px-4 py-3">
                        <select
                          aria-label={`Role for ${u.name}`}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          disabled={isSelf}
                          className={selectClass}
                        >
                          <option value="saas_admin">SaaS Admin</option>
                          <option value="merchant">Merchant</option>
                          <option value="customer">Customer</option>
                        </select>
                      </td>

                      <td className="px-4 py-3">
                        {u.role === "merchant" ? (
                          <select
                            aria-label={`Plan for ${u.name}`}
                            value={u.plan}
                            onChange={(e) => handlePlanChange(u.id, e.target.value as MerchantPlan)}
                            className={selectClass}
                          >
                            <option value="free">Free</option>
                            <option value="pro">Pro</option>
                          </select>
                        ) : (
                          <span className="text-stone-500">None</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            u.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {u.status === "active" ? "Active" : "Suspended"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusToggle(u.id, u.status)}
                            aria-label={`${u.status === "active" ? "Suspend" : "Reactivate"} ${u.name}`}
                          >
                            {u.status === "active" ? "Suspend" : "Reactivate"}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={isSelf}
                            onClick={() => handleDeleteUser(u.id)}
                            className="h-8 w-8 text-stone-500 hover:text-rose-600 disabled:opacity-30"
                            title={isSelf ? "Cannot delete yourself" : "Delete user"}
                            aria-label={`Delete ${u.name}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}

        {showCreateModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-xs"
            onKeyDown={(e) => e.key === "Escape" && setShowCreateModal(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-user-title"
              className="glass-panel studio-card-shadow w-full max-w-md space-y-4 rounded-2xl bg-white p-5 sm:p-6"
            >
              <div>
                <h2 id="create-user-title" className="font-display text-lg font-bold text-stone-900">
                  Add user
                </h2>
              </div>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="new-user-name" className="text-sm font-medium text-stone-700">Full name</label>
                  <Input
                    id="new-user-name"
                    autoFocus
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="e.g. John Doe"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="new-user-email" className="text-sm font-medium text-stone-700">Email</label>
                  <Input
                    id="new-user-email"
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="new-user-password" className="text-sm font-medium text-stone-700">Password</label>
                  <Input
                    id="new-user-password"
                    type="password"
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="new-user-role" className="text-sm font-medium text-stone-700">Role</label>
                  <select
                    id="new-user-role"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className={`${selectClass} w-full`}
                  >
                    <option value="merchant">Merchant</option>
                    <option value="customer">Customer</option>
                    <option value="saas_admin">SaaS Admin</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={creatingUser} className="bg-gradient-brand text-white">
                    {creatingUser ? "Creating..." : "Add user"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
  );
}
