import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type XdPackage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const XD_PACKAGES: XdPackage[] = [
  { xd: 50,  tzs: 2000,  usd: 1.00 },
  { xd: 100, tzs: 3500,  usd: 1.75 },
  { xd: 200, tzs: 6000,  usd: 3.00 },
  { xd: 500, tzs: 13000, usd: 6.50 },
];

const TZS_PER_USD = 2000;
const PAYMENT_INFO = { mpesa: "0753668403", name: "Zawadi Seifu" };

function usdFromTzs(tzs: number) {
  return (tzs / TZS_PER_USD).toFixed(2);
}

export default function Payments() {
  const { toast } = useToast();
  const [selectedPkg, setSelectedPkg] = useState<XdPackage | null>(null);
  const [screenshotNote, setScreenshotNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: paymentsData, refetch } = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.payments.list(),
  });

  const submitMut = useMutation({
    mutationFn: () =>
      api.payments.submit({
        amount_xd: selectedPkg!.xd,
        mpesa_amount: selectedPkg!.tzs,
        screenshot_note: screenshotNote,
      }),
    onSuccess: (data) => {
      toast({ title: "Payment request submitted!", description: data.message });
      setSubmitted(true);
      setSelectedPkg(null);
      setScreenshotNote("");
      refetch();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const payments = paymentsData?.payments || [];

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6">💳 Payments</h1>

      {/* Exchange rate note */}
      <div className="flex items-center gap-2 bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-2.5 mb-5 text-xs text-gray-400">
        <span>💱</span>
        <span>Rate: <span className="text-white font-semibold">TZS 2,000 = $1.00 USD</span> · Pay via M-Pesa or card equivalent</span>
      </div>

      {/* Package selector */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-5 mb-5">
        <h2 className="text-sm font-semibold text-white mb-4">📦 Select Package</h2>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {XD_PACKAGES.map(pkg => (
            <button
              key={pkg.xd}
              onClick={() => { setSelectedPkg(pkg); setSubmitted(false); }}
              className={`border rounded-xl p-4 text-center transition-all ${
                selectedPkg?.xd === pkg.xd
                  ? "bg-purple-600/20 border-purple-500 text-white"
                  : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600"
              }`}
            >
              <div className="text-xl md:text-2xl font-bold">🪙 {pkg.xd}</div>
              <div className="text-xs md:text-sm font-medium mt-0.5 text-gray-400">XD Coins</div>
              <div className="text-purple-400 font-medium mt-2 text-sm">TZS {pkg.tzs.toLocaleString()}</div>
              <div className="text-green-400 font-semibold text-sm">${pkg.usd.toFixed(2)} USD</div>
            </button>
          ))}
        </div>

        {selectedPkg && !submitted && (
          <div className="space-y-4">
            {/* Selected package summary */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 flex items-center justify-between">
              <div className="text-sm text-white font-semibold">🪙 {selectedPkg.xd} XD Coins</div>
              <div className="text-right">
                <div className="text-purple-300 font-bold text-sm">TZS {selectedPkg.tzs.toLocaleString()}</div>
                <div className="text-green-400 font-bold text-sm">${selectedPkg.usd.toFixed(2)} USD</div>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <p className="font-medium text-blue-300 text-sm mb-3">📲 M-Pesa Steps</p>
              <ol className="text-gray-400 text-xs space-y-2 list-decimal list-inside">
                <li>
                  Send{" "}
                  <span className="text-white font-bold">TZS {selectedPkg.tzs.toLocaleString()}</span>
                  {" "}(<span className="text-green-400 font-bold">${selectedPkg.usd.toFixed(2)}</span>){" "}
                  via M-Pesa to:
                  <div className="bg-gray-900 rounded-lg px-3 py-2 mt-1.5 font-mono text-white text-sm font-medium">
                    📱 {PAYMENT_INFO.mpesa} · {PAYMENT_INFO.name}
                  </div>
                </li>
                <li>Take a screenshot of the M-Pesa confirmation</li>
                <li>Send screenshot to WhatsApp: <span className="text-white font-mono">{PAYMENT_INFO.mpesa}</span></li>
                <li>Submit the request below and wait for approval</li>
              </ol>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1.5">
                M-Pesa Reference (optional — speeds up approval)
              </label>
              <input
                value={screenshotNote}
                onChange={e => setScreenshotNote(e.target.value)}
                placeholder="e.g. QA7XXXXXYZ"
                className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2.5 rounded-lg text-sm outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <button
              onClick={() => submitMut.mutate()}
              disabled={submitMut.isPending}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl font-medium transition-colors"
            >
              {submitMut.isPending
                ? "Submitting..."
                : `Submit · 🪙 ${selectedPkg.xd} XD · TZS ${selectedPkg.tzs.toLocaleString()} / $${selectedPkg.usd.toFixed(2)}`}
            </button>
          </div>
        )}

        {submitted && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-green-400 font-medium">Request submitted!</p>
            <p className="text-gray-400 text-xs mt-1">
              Send M-Pesa screenshot to WhatsApp{" "}
              <span className="text-white font-mono">{PAYMENT_INFO.mpesa}</span> for faster approval.
            </p>
          </div>
        )}
      </div>

      {/* Payment history */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-5">
        <h2 className="text-sm font-semibold text-white mb-4">📋 Payment History</h2>
        {payments.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No payment requests yet</p>
        ) : (
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="flex items-start justify-between py-3 border-b border-gray-800 last:border-0 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white font-semibold">🪙 {p.amount_xd} XD Coins</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-purple-400">TZS {p.mpesa_amount.toLocaleString()}</span>
                    <span className="text-gray-600 text-xs">·</span>
                    <span className="text-xs text-green-400">${usdFromTzs(p.mpesa_amount)} USD</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{new Date(p.created_at).toLocaleString()}</div>
                  {p.admin_notes && <div className="text-xs text-gray-400 mt-0.5 italic">{p.admin_notes}</div>}
                </div>
                <span className={`text-xs font-semibold whitespace-nowrap flex-shrink-0 ${
                  p.status === "approved" ? "text-green-400" : p.status === "rejected" ? "text-red-400" : "text-yellow-400"
                }`}>
                  {p.status === "approved" ? "✅" : p.status === "rejected" ? "❌" : "⏳"} {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
