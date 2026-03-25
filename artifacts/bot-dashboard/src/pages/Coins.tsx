import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/App";
import { useToast } from "@/hooks/use-toast";

function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    function update() {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ hours, minutes, seconds });
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return timeLeft;
}

function getNextClaimTime(): Date {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow;
}

export default function Coins() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const { data: pkgData } = useQuery({
    queryKey: ["xd-packages"],
    queryFn: () => api.coins.packages(),
  });

  const { data: txData } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => api.coins.transactions(),
  });

  const claimMut = useMutation({
    mutationFn: () => api.coins.claim(),
    onSuccess: (data) => {
      toast({ title: `🪙 Claimed ${data.claimed} XD coins! Balance: ${data.coins} XD` });
      if (user) setUser({ ...user, xd_coins: data.coins, last_claim_date: new Date().toISOString().split("T")[0] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: any) => toast({ title: "Already claimed", description: e.message, variant: "destructive" }),
  });

  const today = new Date().toISOString().split("T")[0];
  const canClaim = user?.last_claim_date !== today;
  const nextClaimTime = getNextClaimTime();
  const countdown = useCountdown(nextClaimTime);

  const packages = pkgData?.packages || [];
  const payment = pkgData?.payment;
  const transactions = txData?.transactions || [];

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6">XD Coins</h1>

      {/* Balance + Daily claim */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div className="bg-gradient-to-br from-purple-900/60 to-blue-900/40 border border-purple-500/30 rounded-2xl p-5">
          <div className="text-3xl md:text-4xl font-bold text-white mb-1">🪙 {user?.xd_coins}</div>
          <div className="text-purple-300 text-sm">XD Coins Balance</div>
          <div className="mt-3 text-xs text-gray-400">
            Each deployment costs <span className="text-white font-semibold">10 XD</span>
          </div>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5">
          <div className="text-sm font-medium text-white mb-1">🎁 Daily Claim</div>
          <p className="text-gray-400 text-xs mb-3">Get 10 free XD every day!</p>

          {canClaim ? (
            <button
              onClick={() => claimMut.mutate()}
              disabled={claimMut.isPending}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
            >
              {claimMut.isPending ? "Claiming..." : "🎁 Claim 10 XD Free"}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="w-full py-2 bg-gray-800 border border-gray-700 text-gray-500 rounded-xl text-sm font-medium text-center">
                ✅ Claimed Today
              </div>
              {/* Countdown */}
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Next claim in:</div>
                <div className="flex items-center justify-center gap-1">
                  {[
                    { v: countdown.hours, label: "hr" },
                    { v: countdown.minutes, label: "min" },
                    { v: countdown.seconds, label: "sec" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <div className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 min-w-[36px] text-center">
                        <div className="text-sm font-bold text-purple-400 font-mono">{pad(item.v)}</div>
                        <div className="text-[9px] text-gray-600">{item.label}</div>
                      </div>
                      {i < 2 && <span className="text-gray-600 font-bold text-xs">:</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Buy packages */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 md:p-5 mb-5">
        <h2 className="text-sm font-semibold text-white mb-4">💳 Buy XD Coins (M-Pesa)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {packages.map(pkg => (
            <button
              key={pkg.xd}
              onClick={() => navigate("/payments")}
              className="bg-gray-800 border border-gray-700 hover:border-purple-500/50 rounded-xl p-3 text-center transition-all group"
            >
              <div className="text-lg md:text-xl font-bold text-white group-hover:text-purple-300">{pkg.xd}</div>
              <div className="text-xs text-gray-400 mb-1">XD Coins</div>
              <div className="text-xs text-purple-400 font-medium">TZS {pkg.tzs.toLocaleString()}</div>
              {pkg.usd && <div className="text-xs text-green-400 font-medium">${pkg.usd.toFixed(2)}</div>}
            </button>
          ))}
        </div>

        {payment && (
          <div className="bg-gray-800 rounded-xl p-4 text-sm">
            <p className="text-white font-medium mb-2">📲 How to pay</p>
            <ol className="text-gray-400 text-xs space-y-1 list-decimal list-inside">
              <li>Send M-Pesa to <span className="text-white font-mono">{payment.mpesa}</span> ({payment.name})</li>
              <li>Go to <button onClick={() => navigate("/payments")} className="text-purple-400 underline">Payments</button> and submit your request</li>
              <li>Send screenshot to WhatsApp <span className="text-white font-mono">{payment.mpesa}</span></li>
              <li>Wait for approval (usually within 1 hour)</li>
            </ol>
          </div>
        )}
      </div>

      {/* Transaction history */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 md:p-5">
        <h2 className="text-sm font-semibold text-white mb-4">📊 Transactions</h2>
        {transactions.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No transactions yet</p>
        ) : (
          <div className="space-y-2 max-h-64 md:max-h-72 overflow-y-auto">
            {transactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div className="flex-1 min-w-0 mr-3">
                  <div className="text-sm text-gray-300 truncate">{tx.description}</div>
                  <div className="text-xs text-gray-600">{new Date(tx.created_at).toLocaleString()}</div>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                  {tx.amount > 0 ? `+${tx.amount}` : tx.amount} XD
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
