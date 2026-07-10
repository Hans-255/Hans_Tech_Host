import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { GoogleLogin } from "@react-oauth/google";
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
        // Crop to square from center
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

export default function Login() {
  const { user, setUser } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (user) navigate("/"); }, [user]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    try {
      const compressed = await compressImage(file);
      setAvatarPreview(compressed);
      setAvatarBase64(compressed);
    } catch {
      toast({ title: "Could not process image", variant: "destructive" });
    }
  }

  async function handleGoogleSuccess(credential: string) {
    setLoading(true);
    try {
      const data = await api.auth.google(credential);
      localStorage.setItem("bd_token", data.token);
      setUser(data.user);
      toast({
        title: data.isNew ? "Welcome! You got 10 free XD coins!" : `Welcome back, ${data.user.name}!`,
      });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Google sign-in failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data =
        mode === "login"
          ? await api.auth.login(email, password)
          : await api.auth.register(email, password, name, avatarBase64 || undefined);

      localStorage.setItem("bd_token", data.token);
      setUser(data.user);
      toast({
        title: data.isNew ? "Welcome! You got 10 free XD coins!" : `Welcome back, ${data.user.name}!`,
      });
      navigate("/");
    } catch (err: any) {
      toast({ title: mode === "login" ? "Login failed" : "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-gray-950 to-blue-900/20" />
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md px-4 py-8">
        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 md:p-8 shadow-2xl">
          {/* Site logo + brand */}
          <div className="flex flex-col items-center mb-6">
            <div className="mb-3 ring-4 ring-purple-500/40 rounded-full shadow-xl shadow-purple-500/20">
              <img
                src="/bot-dashboard/logo.jpg"
                alt="HANS_TECH-HOST"
                className="w-16 h-16 rounded-full object-cover"
              />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">HANS_TECH-HOST</h1>
            <p className="text-gray-400 text-xs mt-1">Deploy & manage WhatsApp bots</p>
          </div>

          {/* Tab toggle */}
          <div className="flex rounded-xl bg-gray-800 p-1 mb-5">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "login" ? "bg-purple-600 text-white shadow" : "text-gray-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "register" ? "bg-purple-600 text-white shadow" : "text-gray-400 hover:text-white"
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── REGISTER ONLY: profile photo picker ── */}
            {mode === "register" && (
              <>
                {/* Avatar picker */}
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs text-gray-400 self-start">Profile Photo</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="relative group"
                    title="Choose profile photo"
                  >
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Your photo"
                        className="w-20 h-20 rounded-full object-cover ring-4 ring-purple-500/50 group-hover:ring-purple-400 transition-all"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gray-800 border-2 border-dashed border-gray-600 group-hover:border-purple-500 flex flex-col items-center justify-center gap-1 transition-all">
                        <span className="text-2xl">📷</span>
                        <span className="text-[10px] text-gray-500 group-hover:text-purple-400">Tap to add</span>
                      </div>
                    )}
                    {/* Overlay edit icon when photo is set */}
                    {avatarPreview && (
                      <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-white text-lg">✏️</span>
                      </div>
                    )}
                  </button>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={() => { setAvatarPreview(null); setAvatarBase64(null); }}
                      className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                    >
                      Remove photo
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>

                {/* Name field */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1.5">Your Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    placeholder="e.g. HansTz"
                    className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2.5 rounded-xl text-sm outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </>
            )}

            {/* Email */}
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2.5 rounded-xl text-sm outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Min. 6 characters"
                className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2.5 rounded-xl text-sm outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><span className="animate-spin inline-block">🔄</span> {mode === "login" ? "Signing in..." : "Creating account..."}</>
              ) : mode === "login" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-500">or</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={(cred) => cred.credential && handleGoogleSuccess(cred.credential)}
              onError={() => toast({ title: "Google sign-in failed", variant: "destructive" })}
              theme="filled_black"
              shape="pill"
            />
          </div>

          <div className="mt-6 pt-5 border-t border-gray-800">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-purple-400">5</div>
                <div className="text-xs text-gray-500">Bots max</div>
              </div>
              <div>
                <div className="text-xl font-bold text-blue-400">10</div>
                <div className="text-xs text-gray-500">Free XD coins</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-400">∞</div>
                <div className="text-xs text-gray-500">Daily claim</div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-4">
          By signing in you agree to use this platform responsibly.
        </p>
      </div>
    </div>
  );
}
