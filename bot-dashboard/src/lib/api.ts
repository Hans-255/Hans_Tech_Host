const API = "/api";

function getToken() {
  return localStorage.getItem("bd_token");
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data as T;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: User; isNew: boolean }>("/bd/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    register: (email: string, password: string, name: string, avatar_url?: string) =>
      request<{ token: string; user: User; isNew: boolean }>("/bd/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, name, avatar_url }),
      }),
    google: (credential: string) =>
      request<{ token: string; user: User; isNew: boolean }>("/bd/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential }),
      }),
    me: () => request<{ user: User }>("/bd/auth/me"),
    logout: () => request("/bd/auth/logout", { method: "POST" }),
    deleteAccount: () => request("/bd/auth/account", { method: "DELETE" }),
    updateProfile: (avatar_url: string | null) =>
      request<{ user: User }>("/bd/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ avatar_url }),
      }),
  },
  coins: {
    claim: () => request<{ success: boolean; coins: number; claimed: number }>("/bd/coins/claim", { method: "POST" }),
    packages: () => request<{ packages: XdPackage[]; payment: PaymentInfo }>("/bd/coins/packages"),
    transactions: () => request<{ transactions: Transaction[] }>("/bd/coins/transactions"),
  },
  bots: {
    list: () => request<{ bots: Bot[] }>("/bd/bots"),
    checkName: (name: string) => request<{ available: boolean; reason: string }>(`/bd/bots/check-name?name=${encodeURIComponent(name)}`),
    deploy: (data: { bot_name: string; env_config: Record<string, string> }) =>
      request<{ bot: Bot; message: string }>("/bd/bots", { method: "POST", body: JSON.stringify(data) }),
    get: (id: number) => request<{ bot: Bot }>(`/bd/bots/${id}`),
    updateEnv: (id: number, env_config: Record<string, string>) =>
      request<{ success: boolean; env_config: Record<string, string> }>(`/bd/bots/${id}/env`, {
        method: "PUT",
        body: JSON.stringify({ env_config }),
      }),
    delete: (id: number) => request<{ success: boolean }>(`/bd/bots/${id}`, { method: "DELETE" }),
    logs: (id: number) => request<{ logs: string; status: string }>(`/bd/bots/${id}/logs`),
  },
  payments: {
    submit: (data: { amount_xd: number; mpesa_amount: number; screenshot_note?: string }) =>
      request<{ payment: PaymentRequest; message: string }>("/bd/payments", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    list: () => request<{ payments: PaymentRequest[] }>("/bd/payments"),
  },
  config: {
    envDefaults: () =>
      request<{ defaults: Record<string, string>; deployInfo: DeployInfo }>("/bd/config/env-defaults"),
  },
  admin: {
    users: () => request<{ users: AdminUser[] }>("/bd/admin/users"),
    deleteUser: (id: number) => request<{ success: boolean }>(`/bd/admin/users/${id}`, { method: "DELETE" }),
    grantCoins: (id: number, amount: number, note?: string) =>
      request<{ success: boolean }>(`/bd/admin/users/${id}/coins`, { method: "PATCH", body: JSON.stringify({ amount, note }) }),
    bots: () => request<{ bots: AdminBot[] }>("/bd/admin/bots"),
    payments: () => request<{ payments: AdminPayment[] }>("/bd/admin/payments/all"),
    approvePayment: (id: number, notes?: string) =>
      request<{ success: boolean }>(`/bd/admin/payments/${id}/approve`, { method: "POST", body: JSON.stringify({ notes }) }),
    rejectPayment: (id: number, notes?: string) =>
      request<{ success: boolean }>(`/bd/admin/payments/${id}/reject`, { method: "POST", body: JSON.stringify({ notes }) }),
  },
};

export interface User {
  id: number;
  email: string;
  name: string;
  xd_coins: number;
  last_claim_date: string | null;
  is_admin: boolean;
  created_at: string;
  avatar_url?: string | null;
}

export interface DeployInfo {
  cost: number;
  maxBots: number;
  globalTotal: number;
  globalMax: number;
  serverFull: boolean;
}

export interface Bot {
  id: number;
  user_id: number;
  bot_name: string;
  heroku_app_name: string;
  env_config: Record<string, string>;
  status: "pending" | "deploying" | "online" | "failed" | "offline";
  deploy_logs: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: number;
  user_id: number;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

export interface PaymentRequest {
  id: number;
  user_id: number;
  amount_xd: number;
  mpesa_amount: number;
  screenshot_note: string;
  status: "pending" | "approved" | "rejected";
  admin_notes: string;
  created_at: string;
}

export interface XdPackage {
  xd: number;
  tzs: number;
  usd: number;
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  xd_coins: number;
  is_admin: boolean;
  last_claim_date: string | null;
  created_at: string;
}

export interface AdminBot {
  id: number;
  user_id: number;
  bot_name: string;
  heroku_app_name: string;
  status: string;
  created_at: string;
  user_email: string;
  user_name: string;
}

export interface AdminPayment {
  id: number;
  user_id: number;
  amount_xd: number;
  mpesa_amount: number;
  screenshot_note: string;
  status: "pending" | "approved" | "rejected";
  admin_notes: string;
  created_at: string;
  user_email: string;
  user_name: string;
}

export interface PaymentInfo {
  mpesa: string;
  name: string;
}

export { getToken };
