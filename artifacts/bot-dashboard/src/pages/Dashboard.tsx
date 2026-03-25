import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api, type Bot } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/App";

function StatusBadge({ status }: { status: Bot["status"] }) {
  const cfg: Record<string, string> = {
    online: "bg-green-500/20 text-green-400 border-green-500/30",
    deploying: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    failed: "bg-red-500/20 text-red-400 border-red-500/30",
    offline: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  const icons: Record<string, string> = {
    online: "🟢", deploying: "🔄", pending: "⏳", failed: "❌", offline: "⚫",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${cfg[status] || cfg.offline}`}>
      {icons[status]} {status}
    </span>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["bots"], queryFn: () => api.bots.list() });
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [deleteTarget, setDeleteTarget] = useState<Bot | null>(null);
  const [deleteInput, setDeleteInput] = useState("");

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.bots.delete(id),
    onSuccess: () => {
      toast({ title: "Bot deleted" });
      qc.invalidateQueries({ queryKey: ["bots"] });
      setDeleteTarget(null);
      setDeleteInput("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openDelete(bot: Bot) {
    setDeleteTarget(bot);
    setDeleteInput("");
  }

  function closeDelete() {
    setDeleteTarget(null);
    setDeleteInput("");
  }

  const bots = data?.bots || [];
  const canDeploy = bots.length < 5;
  const deleteMatch = deleteInput.toLowerCase() === deleteTarget?.bot_name?.toLowerCase();

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">My Bots</h1>
          <p className="text-gray-400 text-sm mt-0.5">{bots.length}/5 bots deployed</p>
        </div>
        <button
          onClick={() => navigate("/deploy")}
          disabled={!canDeploy}
          className="flex items-center gap-1.5 px-3 py-2 md:px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
        >
          🚀 <span className="hidden sm:inline">Deploy New Bot</span><span className="sm:hidden">Deploy</span>
        </button>
      </div>

      {/* XD Coins banner */}
      <div className="flex items-center gap-3 bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 md:p-4 mb-4 md:mb-6">
        <span className="text-xl md:text-2xl">🪙</span>
        <div className="flex-1 min-w-0">
          <span className="text-purple-300 font-semibold">{user?.xd_coins} XD Coins</span>
          <span className="text-gray-400 text-xs md:text-sm ml-1.5 md:ml-2 hidden sm:inline">· Each deployment costs 10 XD</span>
        </div>
        <button
          onClick={() => navigate("/coins")}
          className="text-xs text-purple-400 hover:text-purple-300 underline whitespace-nowrap flex-shrink-0"
        >
          Get more →
        </button>
      </div>

      {/* Bot list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-24 bg-gray-900 rounded-xl animate-pulse" />)}
        </div>
      ) : bots.length === 0 ? (
        <div className="text-center py-12 md:py-16 text-gray-500">
          <div className="text-5xl mb-4">🤖</div>
          <p className="text-lg font-medium text-gray-400">No bots deployed yet</p>
          <p className="text-sm mt-2">Deploy your first WhatsApp bot for 10 XD coins</p>
          <button
            onClick={() => navigate("/deploy")}
            className="mt-4 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            🚀 Deploy First Bot
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {bots.map(bot => (
            <div
              key={bot.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-5 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {bot.bot_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-white truncate">{bot.bot_name}</h3>
                    <StatusBadge status={bot.status} />
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {bot.heroku_app_name ? `☁️ Cloud server active` : "Not yet deployed"}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {new Date(bot.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => navigate(`/bots/${bot.id}`)}
                  className="flex-1 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors font-medium"
                >
                  Manage
                </button>
                <button
                  onClick={() => openDelete(bot)}
                  className="flex-1 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-3xl text-center mb-3">🗑️</div>
            <h3 className="text-lg font-bold text-white text-center mb-2">Delete Bot?</h3>
            <p className="text-gray-400 text-sm text-center mb-4">
              This will permanently stop and remove <span className="text-white font-semibold">{deleteTarget.bot_name}</span> from the cloud server. This cannot be undone.
            </p>
            <div className="mb-4">
              <label className="text-xs text-gray-400 block mb-2">
                Type <span className="text-red-400 font-mono font-semibold">{deleteTarget.bot_name}</span> to confirm:
              </label>
              <input
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder={deleteTarget.bot_name}
                className="w-full bg-gray-800 border border-red-500/30 text-white px-3 py-2.5 rounded-xl text-sm outline-none focus:border-red-500 transition-colors font-mono"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={closeDelete}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(deleteTarget.id)}
                disabled={!deleteMatch || deleteMut.isPending}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
              >
                {deleteMut.isPending ? "Deleting..." : "Delete Bot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
