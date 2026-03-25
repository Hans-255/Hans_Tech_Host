import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type Tab = "users" | "bots" | "payments";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    online: "bg-green-500/20 text-green-400",
    pending: "bg-yellow-500/20 text-yellow-400",
    deploying: "bg-blue-500/20 text-blue-400",
    failed: "bg-red-500/20 text-red-400",
    offline: "bg-gray-500/20 text-gray-400",
    approved: "bg-green-500/20 text-green-400",
    rejected: "bg-red-500/20 text-red-400",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${map[status] || "bg-gray-700 text-gray-400"}`}>
      {status}
    </span>
  );
}

export default function AdminPanel() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("payments");
  const [grantModal, setGrantModal] = useState<{ id: number; name: string } | null>(null);
  const [grantAmount, setGrantAmount] = useState("");
  const [grantNote, setGrantNote] = useState("");
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const usersQ = useQuery({ queryKey: ["admin-users"], queryFn: () => api.admin.users(), enabled: tab === "users" });
  const botsQ = useQuery({ queryKey: ["admin-bots"], queryFn: () => api.admin.bots(), enabled: tab === "bots" });
  const paymentsQ = useQuery({ queryKey: ["admin-payments"], queryFn: () => api.admin.payments() });

  const approveMut = useMutation({
    mutationFn: (id: number) => api.admin.approvePayment(id),
    onSuccess: () => { toast({ title: "✅ Payment approved — coins sent!" }); qc.invalidateQueries({ queryKey: ["admin-payments"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const rejectMut = useMutation({
    mutationFn: (id: number) => api.admin.rejectPayment(id),
    onSuccess: () => { toast({ title: "❌ Payment rejected" }); qc.invalidateQueries({ queryKey: ["admin-payments"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const deleteUserMut = useMutation({
    mutationFn: (id: number) => api.admin.deleteUser(id),
    onSuccess: () => { toast({ title: "User deleted" }); qc.invalidateQueries({ queryKey: ["admin-users"] }); setDeleteUserId(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const grantMut = useMutation({
    mutationFn: ({ id, amount, note }: { id: number; amount: number; note: string }) =>
      api.admin.grantCoins(id, amount, note),
    onSuccess: () => {
      toast({ title: `🪙 Coins granted!` });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setGrantModal(null);
      setGrantAmount("");
      setGrantNote("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const users = usersQ.data?.users || [];
  const bots = botsQ.data?.bots || [];
  const payments = paymentsQ.data?.payments || [];
  const pending = payments.filter(p => p.status === "pending");

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/")} className="text-gray-400 hover:text-white transition-colors text-lg">←</button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            ⭐ Admin Panel
          </h1>
          <p className="text-gray-500 text-xs">Full control of the platform</p>
        </div>
        {pending.length > 0 && (
          <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold animate-pulse">
            {pending.length} pending
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Total Users", value: usersQ.data?.users.length ?? "—", icon: "👤" },
          { label: "Total Bots", value: botsQ.data?.bots.length ?? "—", icon: "🤖" },
          { label: "Pending Pay", value: pending.length, icon: "💳" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900/80 border border-gray-800 rounded-xl p-3 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-lg font-bold text-white">{s.value}</div>
            <div className="text-[10px] text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-4">
        {(["payments", "users", "bots"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg capitalize transition-all ${
              tab === t ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {t === "payments" && pending.length > 0 ? `Payments (${pending.length})` : t}
          </button>
        ))}
      </div>

      {/* Payments Tab */}
      {tab === "payments" && (
        <div className="space-y-3">
          {paymentsQ.isLoading && <p className="text-gray-500 text-sm text-center py-8">Loading...</p>}
          {payments.length === 0 && !paymentsQ.isLoading && (
            <p className="text-gray-500 text-sm text-center py-8">No payments yet</p>
          )}
          {payments.map(p => (
            <div key={p.id} className={`bg-gray-900/80 border rounded-xl p-4 ${p.status === "pending" ? "border-yellow-500/30" : "border-gray-800"}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="text-sm font-semibold text-white">{p.user_name}</div>
                  <div className="text-xs text-gray-500">{p.user_email}</div>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="flex items-center gap-4 text-sm mb-2">
                <span className="text-purple-400 font-bold">+{p.amount_xd} XD</span>
                <span className="text-gray-400">TZS {p.mpesa_amount.toLocaleString()}</span>
                <span className="text-gray-400">${(p.mpesa_amount / 2000).toFixed(2)}</span>
              </div>
              {p.screenshot_note && (
                <p className="text-xs text-gray-500 mb-2 italic">"{p.screenshot_note}"</p>
              )}
              <div className="text-xs text-gray-600 mb-3">{new Date(p.created_at).toLocaleString()}</div>
              {p.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => approveMut.mutate(p.id)}
                    disabled={approveMut.isPending}
                    className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    ✅ Approve
                  </button>
                  <button
                    onClick={() => rejectMut.mutate(p.id)}
                    disabled={rejectMut.isPending}
                    className="flex-1 py-2 bg-red-600/20 hover:bg-red-600/40 disabled:opacity-40 text-red-400 border border-red-500/30 rounded-lg text-xs font-medium transition-colors"
                  >
                    ❌ Reject
                  </button>
                </div>
              )}
              {p.admin_notes && p.status !== "pending" && (
                <p className="text-xs text-gray-500 mt-2">Note: {p.admin_notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Users Tab */}
      {tab === "users" && (
        <div className="space-y-3">
          {usersQ.isLoading && <p className="text-gray-500 text-sm text-center py-8">Loading...</p>}
          {users.map(u => (
            <div key={u.id} className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${u.is_admin ? "bg-gradient-to-br from-yellow-500 to-orange-500" : "bg-gradient-to-br from-purple-600 to-blue-600"}`}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{u.name}</span>
                    {u.is_admin && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">admin</span>}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{u.email}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-purple-400">🪙 {u.xd_coins}</div>
                  <div className="text-[10px] text-gray-600">{new Date(u.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setGrantModal({ id: u.id, name: u.name })}
                  className="flex-1 py-1.5 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-lg transition-colors"
                >
                  🪙 Grant Coins
                </button>
                {!u.is_admin && (
                  <button
                    onClick={() => setDeleteUserId(u.id)}
                    className="flex-1 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors"
                  >
                    🗑️ Delete
                  </button>
                )}
              </div>
            </div>
          ))}
          {users.length === 0 && !usersQ.isLoading && (
            <p className="text-gray-500 text-sm text-center py-8">No users yet</p>
          )}
        </div>
      )}

      {/* Bots Tab */}
      {tab === "bots" && (
        <div className="space-y-3">
          {botsQ.isLoading && <p className="text-gray-500 text-sm text-center py-8">Loading...</p>}
          {bots.map(b => (
            <div key={b.id} className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-white">{b.bot_name}</span>
                <StatusBadge status={b.status} />
              </div>
              <div className="text-xs text-gray-500 mb-1">Owner: {b.user_name} ({b.user_email})</div>
              {b.heroku_app_name && <div className="text-xs text-purple-400/70">☁️ Cloud server active</div>}
              <div className="text-xs text-gray-600 mt-1">{new Date(b.created_at).toLocaleDateString()}</div>
            </div>
          ))}
          {bots.length === 0 && !botsQ.isLoading && (
            <p className="text-gray-500 text-sm text-center py-8">No bots deployed yet</p>
          )}
        </div>
      )}

      {/* Grant Coins Modal */}
      {grantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-purple-500/30 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-1">Grant Coins</h3>
            <p className="text-gray-400 text-sm mb-4">to {grantModal.name}</p>
            <input
              type="number"
              value={grantAmount}
              onChange={e => setGrantAmount(e.target.value)}
              placeholder="Amount (e.g. 100)"
              className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2.5 rounded-xl text-sm outline-none focus:border-purple-500 mb-3"
            />
            <input
              value={grantNote}
              onChange={e => setGrantNote(e.target.value)}
              placeholder="Note (optional)"
              className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2.5 rounded-xl text-sm outline-none focus:border-purple-500 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setGrantModal(null)} className="flex-1 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm font-medium">Cancel</button>
              <button
                onClick={() => grantMut.mutate({ id: grantModal.id, amount: Number(grantAmount), note: grantNote })}
                disabled={!grantAmount || grantMut.isPending}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
              >
                {grantMut.isPending ? "Granting..." : "🪙 Grant"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {deleteUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-6 w-full max-w-xs text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <h3 className="text-lg font-bold text-white mb-2">Delete User?</h3>
            <p className="text-gray-400 text-sm mb-5">This deletes the user, all their bots, coins, and history permanently.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteUserId(null)} className="flex-1 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm">Cancel</button>
              <button
                onClick={() => deleteUserMut.mutate(deleteUserId)}
                disabled={deleteUserMut.isPending}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium"
              >
                {deleteUserMut.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
