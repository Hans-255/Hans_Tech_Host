import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api, type DeployInfo } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/App";

const REQUIRED_KEYS = ["SESSION_ID", "OWNER_NUMBER"];
const HIDDEN_KEYS = ["HEROKU_APP_NAME", "BRANCH"];
const HEROKU_DEPLOY_URL =
  "https://dashboard.heroku.com/new?team=team-bots-23&template=https%3A%2F%2Fgithub.com%2FHans-255%2FVortex-Xmd-Bot";

function CapacityBar({ info }: { info: DeployInfo }) {
  const pct = Math.min(100, Math.round((info.globalTotal / info.globalMax) * 100));
  const color =
    pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-orange-500" : pct >= 60 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">Cloud server capacity</span>
        <span className={pct >= 100 ? "text-red-400 font-bold" : "text-gray-400"}>
          {info.globalTotal}/{info.globalMax} slots
        </span>
      </div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

type NameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export default function DeployBot() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: configData } = useQuery({
    queryKey: ["env-defaults"],
    queryFn: () => api.config.envDefaults(),
  });

  const defaults = configData?.defaults || {};
  const deployInfo: DeployInfo = configData?.deployInfo || {
    cost: 10, maxBots: 5, globalTotal: 0, globalMax: 100, serverFull: false,
  };

  const [botName, setBotName] = useState("");
  const [envConfig, setEnvConfig] = useState<Record<string, string>>({});
  const [nameStatus, setNameStatus] = useState<NameStatus>("idle");
  const [nameReason, setNameReason] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (defaults && Object.keys(envConfig).length === 0) {
      setEnvConfig({ ...defaults });
    }
  }, [defaults]);

  // Debounced name check
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!botName || botName.length < 3) {
      setNameStatus("idle");
      setNameReason("");
      return;
    }
    setNameStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.bots.checkName(botName);
        setNameStatus(res.available ? "available" : "taken");
        setNameReason(res.reason);
      } catch {
        setNameStatus("idle");
      }
    }, 700);
  }, [botName]);

  const deployMut = useMutation({
    mutationFn: () => api.bots.deploy({ bot_name: botName, env_config: envConfig }),
    onSuccess: (data) => {
      toast({ title: "🚀 Bot deployment started!", description: data.message });
      qc.invalidateQueries({ queryKey: ["bots"] });
      qc.invalidateQueries({ queryKey: ["env-defaults"] });
      window.open(HEROKU_DEPLOY_URL, "_blank");
      navigate("/");
    },
    onError: (e: any) => {
      const msg: string = e.message || "";
      if (msg.includes("server_at_capacity") || msg.includes("slots are currently full")) {
        toast({
          title: "⛔ Server at capacity",
          description: "All 100 cloud server slots are full. Please try again another time.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Deploy failed", description: msg, variant: "destructive" });
      }
    },
  });

  const canDeploy = (user?.xd_coins ?? 0) >= deployInfo.cost;
  const missingRequired = REQUIRED_KEYS.filter(k => !envConfig[k]);
  const envKeys = Object.keys(envConfig).filter(k => !HIDDEN_KEYS.includes(k));
  const serverFull = deployInfo.serverFull;

  function handleEnvChange(key: string, value: string) {
    setEnvConfig(prev => ({ ...prev, [key]: value }));
  }

  // Name status indicator
  const nameIndicator = () => {
    if (!botName || botName.length < 3) return null;
    if (nameStatus === "checking") return <span className="text-gray-400 text-xs">⏳ Checking...</span>;
    if (nameStatus === "available") return <span className="text-green-400 text-xs font-medium">✅ {nameReason}</span>;
    if (nameStatus === "taken") return <span className="text-red-400 text-xs font-medium">❌ {nameReason}</span>;
    if (nameStatus === "invalid") return <span className="text-orange-400 text-xs font-medium">⚠️ {nameReason}</span>;
    return null;
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate("/")} className="text-gray-400 hover:text-white transition-colors text-lg">←</button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Deploy New Bot</h1>
          <p className="text-gray-400 text-sm">VORTEX-XMD · Costs {deployInfo.cost} XD coins</p>
        </div>
      </div>

      {user?.is_admin && (
        serverFull ? (
          <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-5 mb-5 text-center">
            <div className="text-3xl mb-2">⛔</div>
            <h3 className="text-red-400 font-bold text-base mb-1">Server at Full Capacity</h3>
            <p className="text-gray-400 text-sm mb-3">
              All <span className="text-white font-semibold">100</span> cloud server slots are currently taken.
            </p>
            <CapacityBar info={deployInfo} />
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
            <CapacityBar info={deployInfo} />
          </div>
        )
      )}

      {!user?.is_admin && serverFull && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-5 mb-5 text-center">
          <div className="text-3xl mb-2">⛔</div>
          <h3 className="text-red-400 font-bold text-base mb-1">Service Unavailable</h3>
          <p className="text-gray-400 text-sm">All cloud server slots are currently full. Please try again another time.</p>
        </div>
      )}

      {!canDeploy && !serverFull && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5">
          <p className="text-red-400 text-sm font-medium">❌ Not enough XD coins</p>
          <p className="text-gray-400 text-xs mt-1">
            You have {user?.xd_coins} XD — need {deployInfo.cost} XD.{" "}
            <button onClick={() => navigate("/coins")} className="text-purple-400 underline">Get coins →</button>
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* Bot name + Heroku name */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-5">
          <h2 className="text-sm font-semibold text-white mb-3">🤖 App Name (Heroku ID)</h2>
          <div className="relative">
            <input
              value={botName}
              onChange={e => setBotName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30))}
              placeholder="e.g. hansbot"
              disabled={serverFull}
              className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2.5 rounded-lg text-sm outline-none focus:border-purple-500 transition-colors font-mono disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs text-gray-500">Lowercase letters, numbers, hyphens — 3 to 30 chars</p>
            {nameIndicator()}
          </div>
          {botName.length >= 3 && (
            <div className="mt-2 bg-gray-800/60 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">Heroku app:</span>
              <code className="text-xs text-purple-300 font-mono">{botName}-xxxx.herokuapp.com</code>
              <span className="text-xs text-gray-600 ml-auto">suffix added for uniqueness</span>
            </div>
          )}
        </div>

        {/* Pre-configured notice */}
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-sm">
          <p className="font-medium text-green-300 mb-0.5">✅ Cloud server is pre-configured</p>
          <p className="text-gray-400 text-xs">No API key needed — just fill in your bot settings and deploy.</p>
        </div>

        {/* ENV vars */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-5">
          <h2 className="text-sm font-semibold text-white mb-1">⚙️ Bot Settings</h2>
          <p className="text-xs text-gray-500 mb-4">
            Fields with <span className="text-red-400">*</span> are required.
          </p>
          <div className="space-y-3 max-h-80 md:max-h-96 overflow-y-auto pr-1">
            {envKeys.map(key => (
              <div key={key}>
                <label className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                  {key}
                  {REQUIRED_KEYS.includes(key) && <span className="text-red-400">*</span>}
                </label>
                <input
                  value={envConfig[key] || ""}
                  onChange={e => handleEnvChange(key, e.target.value)}
                  disabled={serverFull}
                  placeholder={
                    key === "SESSION_ID" ? "Paste your SESSION_ID (starts with HansTz&...)"
                    : key === "OWNER_NUMBER" ? "e.g. 255712345678"
                    : `Enter ${key}`
                  }
                  className={`w-full bg-gray-800 border text-white px-3 py-2 rounded-lg text-xs font-mono outline-none focus:border-purple-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    REQUIRED_KEYS.includes(key) && !envConfig[key] && !serverFull ? "border-red-500/50" : "border-gray-700"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* SESSION_ID help */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-xs text-gray-400">
          <p className="font-medium text-blue-300 mb-2">ℹ️ How to get SESSION_ID</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Visit <a href="https://hans-sessions.replit.app" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Hans Sessions</a></li>
            <li>Enter your WhatsApp number</li>
            <li>Use code <span className="font-bold text-white">HANSTECH</span> in WhatsApp</li>
            <li>Copy the SESSION_ID (starts with <span className="text-white font-bold">HansTz&</span>) and paste above</li>
          </ol>
        </div>

        {/* Deploy button */}
        {serverFull ? (
          <div className="w-full py-3.5 bg-gray-800 border border-gray-700 text-gray-500 rounded-xl font-medium text-center text-sm cursor-not-allowed">
            ⛔ Server Full — Try Again Another Time
          </div>
        ) : (
          <button
            onClick={() => deployMut.mutate()}
            disabled={!botName || botName.length < 3 || missingRequired.length > 0 || !canDeploy || deployMut.isPending}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            {deployMut.isPending
              ? <><span className="animate-spin">🔄</span> Deploying...</>
              : <><span>🚀</span> Deploy Bot ({deployInfo.cost} XD)</>}
          </button>
        )}

        {missingRequired.length > 0 && botName && !serverFull && (
          <p className="text-xs text-red-400 text-center">
            Required: {missingRequired.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
