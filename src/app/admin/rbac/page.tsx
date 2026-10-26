"use client";

import React, { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/auth-context";
import { UserRole, UserStatus } from "@/lib/supabase/auth-service";
import {
  ShieldCheck,
  Users,
  Store,
  ShoppingBag,
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
  const { user: currentUser, isSaasAdmin, demoMode, switchDemoRole } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // New user creation modal state
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

  // If NOT SaaS Admin, display permission restriction guard
  if (!isSaasAdmin) {
    return (
      <DashboardLayout
        title="RBAC Management — Access Denied"
        subtitle="SaaS Admin privilege required to view or configure access controls"
      >
        <Card className="max-w-lg mx-auto my-12 border-rose-200 bg-rose-50/40 text-center p-8 space-y-5">
          <div className="h-14 w-14 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <Lock className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <Badge variant="destructive" className="text-xs">
              SaaS Admin Privilege Required
            </Badge>
            <h2 className="text-lg font-bold text-stone-900">
              Access Restricted
            </h2>
            <p className="text-xs text-stone-600">
              You are currently authenticated as <strong>{currentUser?.name || "User"}</strong> with the role:{" "}
              <Badge variant="secondary" className="uppercase font-mono text-[10px]">
                {currentUser?.role || "guest"}
              </Badge>
              . Only SaaS Administrators can manage Role-Based Access Control (RBAC).
            </p>
          </div>

          {demoMode && (
          <div className="pt-2">
            <Button
              onClick={() => switchDemoRole("saas_admin")}
              className="gap-2 bg-stone-900 hover:bg-stone-800 text-white shadow-xs"
            >
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              <span>Switch to SaaS Admin Account</span>
            </Button>
          </div>
          )}
        </Card>
      </DashboardLayout>
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

  return (
    <DashboardLayout
      title="SaaS Admin — RBAC Control Center"
      subtitle="Manage global user accounts, role-based access permissions, and account statuses"
    >
      <div className="space-y-6 max-w-6xl">
        {/* Toast Notification */}
        {notification && (
          <div
            className={`p-3 rounded-xl flex items-center gap-2 text-xs font-semibold shadow-xs animate-in fade-in duration-200 ${
              notification.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-rose-50 border border-rose-200 text-rose-800"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Global Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="border-stone-200/80 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                Total Accounts
              </span>
              <Users className="h-4 w-4 text-stone-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold tracking-tight text-stone-900">
                  {users.length}
                </div>
              )}
              <p className="text-xs text-stone-500 mt-1">Across all role tiers</p>
            </CardContent>
          </Card>

          <Card className="border-stone-200/80 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                SaaS Admins
              </span>
              <ShieldCheck className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold tracking-tight text-stone-900">
                  {totalAdmins}
                </div>
              )}
              <p className="text-xs text-stone-500 mt-1">Full system privilege</p>
            </CardContent>
          </Card>

          <Card className="border-stone-200/80 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                Merchants
              </span>
              <Store className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold tracking-tight text-stone-900">
                  {totalMerchants}
                </div>
              )}
              <p className="text-xs text-stone-500 mt-1">3D Studio & GLB Creators</p>
            </CardContent>
          </Card>

          <Card className="border-stone-200/80 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                Customers
              </span>
              <ShoppingBag className="h-4 w-4 text-stone-400" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold tracking-tight text-stone-900">
                  {totalCustomers}
                </div>
              )}
              <p className="text-xs text-stone-500 mt-1">View-only storefront access</p>
            </CardContent>
          </Card>
        </div>

        {/* User Search & Action Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3 rounded-xl border border-stone-200/80 shadow-2xs">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="h-3.5 w-3.5 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search user by name or email..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-stone-900 bg-stone-50/50"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 focus:outline-hidden bg-stone-50/50 text-stone-700"
            >
              <option value="all">All Roles</option>
              <option value="saas_admin">SaaS Admins</option>
              <option value="merchant">Merchants</option>
              <option value="customer">Customers</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUsers}
              disabled={loading}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="gap-1.5 text-xs bg-stone-900 text-white hover:bg-stone-800"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Add User</span>
            </Button>
          </div>
        </div>

        {/* Users Table */}
        <Card className="border-stone-200/80 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-stone-900">
              User Directory & RBAC Assignment
            </CardTitle>
            <CardDescription className="text-xs">
              Change user roles dynamically via dropdown or manage account authorization status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-xs text-stone-400">
                No users found matching search criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th className="pb-3 font-semibold">User</th>
                      <th className="pb-3 font-semibold">Current Role</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Assigned Role (RBAC)</th>
                      <th className="pb-3 font-semibold">Plan</th>
                      <th className="pb-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredUsers.map((u) => {
                      const isSelf = u.id === currentUser?.id;
                      return (
                        <tr key={u.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                  u.role === "saas_admin"
                                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                                    : u.role === "merchant"
                                    ? "bg-stone-900 text-stone-50"
                                    : "bg-stone-100 text-stone-700"
                                }`}
                              >
                                {u.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                                  <span>{u.name}</span>
                                  {isSelf && (
                                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                      You
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[11px] text-stone-500 font-mono">
                                  {u.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3">
                            <Badge
                              variant={
                                u.role === "saas_admin"
                                  ? "destructive"
                                  : u.role === "merchant"
                                  ? "processing"
                                  : "secondary"
                              }
                              className="capitalize text-[11px] font-semibold"
                            >
                              {u.role.replace("_", " ")}
                            </Badge>
                          </td>

                          <td className="py-3">
                            <button
                              onClick={() => handleStatusToggle(u.id, u.status)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                                u.status === "active"
                                  ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                  : "bg-rose-100 text-rose-800 hover:bg-rose-200"
                              }`}
                            >
                              {u.status === "active" ? "● Active" : "✕ Suspended"}
                            </button>
                          </td>

                          <td className="py-3">
                            <select
                              value={u.role}
                              onChange={(e) =>
                                handleRoleChange(u.id, e.target.value as UserRole)
                              }
                              disabled={isSelf}
                              className="px-2.5 py-1 text-xs rounded-lg border border-stone-200 focus:outline-hidden focus:ring-1 focus:ring-stone-900 bg-white font-medium text-stone-800 disabled:opacity-50"
                            >
                              <option value="saas_admin">👑 SaaS Admin</option>
                              <option value="merchant">🏪 Furniture Merchant</option>
                              <option value="customer">🛍️ Customer Account</option>
                            </select>
                          </td>

                          <td className="py-3">
                            {u.role === "merchant" ? (
                              <select
                                value={u.plan}
                                onChange={(e) => handlePlanChange(u.id, e.target.value as MerchantPlan)}
                                className="px-2.5 py-1 text-xs rounded-lg border border-stone-200 focus:outline-hidden focus:ring-1 focus:ring-stone-900 bg-white font-medium text-stone-800"
                              >
                                <option value="free">Free</option>
                                <option value="pro">Pro</option>
                              </select>
                            ) : (
                              <span className="text-stone-400">n/a</span>
                            )}
                          </td>

                          <td className="py-3 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={isSelf}
                              onClick={() => handleDeleteUser(u.id)}
                              className="h-7 w-7 text-stone-400 hover:text-rose-600 disabled:opacity-30"
                              title={isSelf ? "Cannot delete yourself" : "Delete User"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs">
            <Card className="w-full max-w-md bg-white border-stone-200 shadow-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-stone-900">
                  Add New User Account
                </CardTitle>
                <CardDescription className="text-xs">
                  Create a user with specific initial RBAC permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-700">Full Name</label>
                    <input
                      type="text"
                      required
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-stone-900 bg-stone-50/50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-700">Email Address</label>
                    <input
                      type="email"
                      required
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-stone-900 bg-stone-50/50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-700">Password</label>
                    <input
                      type="password"
                      required
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-stone-900 bg-stone-50/50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-700">Assigned Role</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-stone-900 bg-stone-50/50"
                    >
                      <option value="merchant">🏪 Merchant (Upload & Generate 3D)</option>
                      <option value="customer">🛍️ Customer (View Only)</option>
                      <option value="saas_admin">👑 SaaS Admin (Full RBAC Privilege)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreateModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={creatingUser}
                      className="bg-stone-900 text-white hover:bg-stone-800"
                    >
                      {creatingUser ? "Creating..." : "Save User"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
