import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { api, type Bot } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

function StatusBadge({ status }: { status: Bot["status"] }) {
  const cfg: Record<string, string> = {
    online: "bg-green-500/20 text-green-400",
    deploying: "bg-blue-500/20 text-blue-400",
    pending: "bg-yellow-500/20 text-yellow-400",
    failed: "bg-red-500/20 text-red-400",
    offline: "bg-gray-500/20 text-gray-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg[status] || cfg.offline}`}>
      {status.toUpperCase()}
    </span>
  );
}

export default function BotDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const logRef = useRef<HTMLDivElement>(null);

  const { data, refetch } = useQuery({
    queryKey: ["bot", id],
    queryFn: () => api.bots.get(Number(id)),
    refetchInterval: (query) => {
      const status = (query.state.data as any)?.bot?.status;
      return status === "deploying" || status === "pending" ? 3000 : false;
    },
  });

  const { data: logsData } = useQuery({
    queryKey: ["bot-logs", id],
    queryFn: () => api.bots.logs(Number(id)),
    refetchInterval: 5000,
  });

  const bot = data?.bot;
  const [env, setEnv] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"env" | "logs">("env");

  useEffect(() => {
    if (bot?.env_config) setEnv({ ...bot.env_config });
  }, [bot?.id]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logsData?.logs]);

  const updateEnvMut = useMutation({
    mutationFn: () => api.bots.updateEnv(Number(id), env),
    onSuccess: () => {
      toast({ title: "Environment variables updated" });
      qc.invalidateQueries({ queryKey: ["bot", id] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.bots.delete(Number(id)),
    onSuccess: () => {
      toast({ title: "Bot deleted" });
      navigate("/");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!bot) return (
    <div className="p-4 md:p-6 text-gray-400">
      <div className="animate-pulse space-y-3">
        <div className="h-8 bg-gray-800 rounded w-48" />
        <div className="h-64 bg-gray-900 rounded-xl" />
      </div>
    </div>
  );

  const envKeys = Object.keys(env).filter(k => k !== "HEROKU_API_KEY");

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Back */}
      <button onClick={() => navigate("/")} className="text-gray-400 hover:text-white text-sm mb-4 flex items-center gap-1">
        ← Back
      </button>

      {/* Bot header card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-5 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-xl font-bold flex-shrink-0">
            {bot.bot_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-lg md:text-xl font-bold text-white">{bot.bot_name}</h1>
              <StatusBadge status={bot.status} />
            </div>
            {bot.heroku_app_name && (
              <span className="text-xs text-purple-400">☁️ Cloud server active</span>
            )}
          </div>
        </div>

        {/* Action buttons — full width row on mobile */}
        <div className="flex gap-2 mt-4">
          {bot.status === "online" && bot.heroku_app_name && (
            <a
              href={`https://${bot.heroku_app_name}.herokuapp.com`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-2 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
            >
              View Live Bot ↗
            </a>
          )}
          <button
            onClick={() => { if (confirm(`Delete ${bot.bot_name}?`)) deleteMut.mutate(); }}
            className="flex-1 py-2 text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
          >
            Delete Bot
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-900 border border-gray-800 rounded-xl p-1">
        {(["env", "logs"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {tab === "env" ? "⚙️ Settings" : "📋 Logs"}
          </button>
        ))}
      </div>

      {activeTab === "env" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-5">
          <p className="text-xs text-gray-500 mb-4">
            Changes sync to the cloud server and restart the bot automatically.
          </p>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 mb-4">
            {envKeys.map(key => (
              <div key={key}>
                <label className="text-xs text-gray-400 block mb-1">{key}</label>
                <input
                  value={env[key] || ""}
                  onChange={e => setEnv(prev => ({ ...prev, [key]: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded-lg text-xs font-mono outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => updateEnvMut.mutate()}
            disabled={updateEnvMut.isPending}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {updateEnvMut.isPending ? "Saving..." : "💾 Save & Sync to Cloud"}
          </button>
        </div>
      )}

      {activeTab === "logs" && (
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">Auto-refreshes every 5s</p>
            <button onClick={() => refetch()} className="text-xs text-gray-500 hover:text-white">↻ Refresh</button>
          </div>
          <div
            ref={logRef}
            className="font-mono text-xs text-green-400 bg-black rounded-lg p-3 h-64 md:h-96 overflow-y-auto whitespace-pre-wrap leading-5"
          >
            {logsData?.logs || "No logs yet..."}
          </div>
        </div>
      )}
    </div>
  );
}
