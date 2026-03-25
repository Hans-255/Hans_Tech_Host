import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/App";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const size = 200;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [deleteInput, setDeleteInput] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const CONFIRM_PHRASE = "delete my account";

  async function handleDeleteAccount() {
    if (deleteInput.toLowerCase() !== CONFIRM_PHRASE) return;
    setDeleting(true);
    try {
      await api.auth.deleteAccount();
      toast({ title: "Account deleted. Goodbye!" });
      logout();
      navigate("/login");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    setAvatarUploading(true);
    try {
      const compressed = await compressImage(file);
      const { user: updated } = await api.auth.updateProfile(compressed);
      setUser(updated);
      toast({ title: "Profile photo updated!" });
    } catch (err: any) {
      toast({ title: "Failed to update photo", description: err.message, variant: "destructive" });
    } finally {
      setAvatarUploading(false);
      // Reset file input so same file can be picked again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeAvatar() {
    setAvatarUploading(true);
    try {
      const { user: updated } = await api.auth.updateProfile(null);
      setUser(updated);
      toast({ title: "Profile photo removed" });
    } catch (err: any) {
      toast({ title: "Failed to remove photo", description: err.message, variant: "destructive" });
    } finally {
      setAvatarUploading(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/")} className="text-gray-400 hover:text-white transition-colors text-lg">←</button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 text-sm">Manage your account</p>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-base">👤</span> Account Info
        </h2>
        <div className="flex items-center gap-4">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.name}
              className="w-14 h-14 rounded-2xl object-cover flex-shrink-0 ring-2 ring-purple-500/40"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-white font-semibold text-lg">{user?.name}</div>
            <div className="text-gray-400 text-sm">{user?.email}</div>
            <div className="text-purple-400 text-xs mt-1 font-medium">🪙 {user?.xd_coins} XD Coins</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-center">
          <div className="bg-gray-800/60 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">Member since</div>
            <div className="text-sm text-white font-medium">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
            </div>
          </div>
          <div className="bg-gray-800/60 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">Account type</div>
            <div className="text-sm text-purple-400 font-medium">
              {user?.is_admin ? "⭐ Admin" : "👤 User"}
            </div>
          </div>
        </div>
      </div>

      {/* Change Profile Photo */}
      <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <span>📷</span> Profile Photo
        </h2>
        <div className="flex items-center gap-4">
          {/* Current avatar preview */}
          <div className="relative flex-shrink-0">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-16 h-16 rounded-full object-cover ring-2 ring-purple-500/40"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-2xl font-bold text-white">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
            )}
            {avatarUploading && (
              <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                <span className="animate-spin text-lg">🔄</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {avatarUploading ? "Uploading..." : "Change Profile Photo"}
            </button>
            {user?.avatar_url && (
              <button
                onClick={removeAvatar}
                disabled={avatarUploading}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-400 hover:text-red-400 rounded-xl text-sm transition-colors"
              >
                Remove photo
              </button>
            )}
            <p className="text-xs text-gray-500">JPG, PNG, GIF — auto-resized to 200×200</p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      {/* Preferences */}
      <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <span>⚙️</span> Preferences
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-800">
            <div>
              <div className="text-sm text-gray-300">Daily XD Coins Reminder</div>
              <div className="text-xs text-gray-500">Visit daily to claim free coins</div>
            </div>
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">Active</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-800">
            <div>
              <div className="text-sm text-gray-300">Bot Limit</div>
              <div className="text-xs text-gray-500">Maximum bots you can deploy</div>
            </div>
            <span className="text-xs text-white font-semibold">5 bots</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm text-gray-300">Deploy Cost</div>
              <div className="text-xs text-gray-500">XD coins per bot deployment</div>
            </div>
            <span className="text-xs text-white font-semibold">10 XD</span>
          </div>
        </div>
      </div>

      {/* Help & Support */}
      <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <span>💬</span> Help & Support
        </h2>
        <div className="space-y-3">
          <a
            href="https://wa.me/255753668403"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between py-2 border-b border-gray-800 hover:text-purple-400 transition-colors"
          >
            <div>
              <div className="text-sm text-gray-300">WhatsApp Support</div>
              <div className="text-xs text-gray-500">Chat with HansTz for help</div>
            </div>
            <span className="text-gray-500 text-xs">↗</span>
          </a>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm text-gray-300">Buy XD Coins via M-Pesa</div>
              <div className="text-xs text-gray-500">0753668403 · Zawadi Seifu</div>
            </div>
            <button
              onClick={() => navigate("/payments")}
              className="text-xs text-purple-400 hover:text-purple-300 underline"
            >
              Pay →
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-red-400 mb-1 flex items-center gap-2">
          <span>⚠️</span> Danger Zone
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Deleting your account is permanent. All bots, coins, and data will be erased.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium transition-colors"
        >
          🗑️ Delete My Account
        </button>
      </div>

      {/* Delete account modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-3xl text-center mb-3">⚠️</div>
            <h3 className="text-lg font-bold text-white text-center mb-2">Delete Account?</h3>
            <p className="text-gray-400 text-sm text-center mb-4">
              This will permanently delete your account, all bots, coins, and transaction history. This cannot be undone.
            </p>
            <div className="mb-4">
              <label className="text-xs text-gray-400 block mb-2">
                Type <span className="text-red-400 font-mono font-semibold">delete my account</span> to confirm:
              </label>
              <input
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder="delete my account"
                className="w-full bg-gray-800 border border-red-500/30 text-white px-3 py-2.5 rounded-xl text-sm outline-none focus:border-red-500 transition-colors font-mono"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteInput(""); }}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteInput.toLowerCase() !== CONFIRM_PHRASE || deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
              >
                {deleting ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
