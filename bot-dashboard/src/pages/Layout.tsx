import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/App";
import TechBackground from "@/components/TechBackground";

const baseNav = [
  { href: "/", label: "My Bots", icon: "🤖" },
  { href: "/deploy", label: "Deploy Bot", icon: "🚀" },
  { href: "/coins", label: "XD Coins", icon: "🪙" },
  { href: "/payments", label: "Payments", icon: "💳" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

const Logo = ({ size = 36 }: { size?: number }) => (
  <img
    src="/bot-dashboard/logo.jpg"
    alt="HANS_TECH-HOST"
    style={{ width: size, height: size }}
    className="rounded-full object-cover ring-2 ring-purple-500/50"
  />
);

function UserAvatar({ user, size = 32, className = "" }: { user: any; size?: number; className?: string }) {
  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.name}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={`rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
    >
      {user?.name?.charAt(0)?.toUpperCase()}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const nav = user?.is_admin
    ? [...baseNav, { href: "/admin", label: "Admin Panel", icon: "⭐" }]
    : baseNav;

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [location]);

  // Close sidebar on backdrop click / escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setSidebarOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
    setShowLogoutConfirm(false);
    setSidebarOpen(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white relative">
      <TechBackground />

      {/* ══════════════════════════════════════════
          MOBILE: Top header bar (ChatGPT-style)
      ══════════════════════════════════════════ */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800/80 h-14 flex items-center px-4 gap-3">
        {/* Hamburger button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-9 h-9 rounded-xl bg-gray-800/80 hover:bg-gray-700 flex items-center justify-center flex-shrink-0 transition-colors"
          aria-label="Open menu"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect y="3" width="18" height="2" rx="1" fill="white"/>
            <rect y="8" width="18" height="2" rx="1" fill="white"/>
            <rect y="13" width="18" height="2" rx="1" fill="white"/>
          </svg>
        </button>

        {/* Brand */}
        <div className="flex items-center gap-2 flex-1">
          <Logo size={28} />
          <span className="font-bold text-sm text-white tracking-tight">HANS_TECH-HOST</span>
        </div>

        {/* Right: coins + avatar */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-purple-400 font-semibold">🪙 {Number(user?.xd_coins).toLocaleString()}</span>
          <button onClick={() => navigate("/settings")} className="flex-shrink-0">
            <UserAvatar user={user} size={30} />
          </button>
        </div>
      </header>

      {/* ══════════════════════════════════════════
          MOBILE: Slide-in sidebar overlay
      ══════════════════════════════════════════ */}
      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={`md:hidden fixed top-0 left-0 h-full z-50 w-72 bg-gray-900 border-r border-gray-800 flex flex-col transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {/* Drawer header */}
        <div className="p-4 border-b border-gray-800 flex items-center gap-3">
          <Logo size={40} />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-sm">HANS_TECH-HOST</div>
            <div className="text-xs text-gray-500">Bot Management Platform</div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-7 h-7 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* User card */}
        <div className="mx-3 mt-3 bg-gray-800/60 rounded-xl p-3 flex items-center gap-3">
          <UserAvatar user={user} size={36} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{user?.name}</div>
            <div className="text-xs text-gray-500 truncate">{user?.email}</div>
          </div>
          <div className="text-xs text-purple-400 font-bold flex-shrink-0">🪙 {Number(user?.xd_coins).toLocaleString()}</div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto mt-2">
          {nav.map(item => (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all ${
                location === item.href
                  ? "bg-purple-500/20 text-purple-300 font-semibold"
                  : "text-gray-300 hover:text-white hover:bg-gray-800"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
              {location === item.href && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400" />}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-gray-800">
          <button
            onClick={() => { setSidebarOpen(false); setShowLogoutConfirm(true); }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/5 transition-all"
          >
            <span className="text-lg">🚪</span>
            Sign Out
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          DESKTOP: Fixed left sidebar
      ══════════════════════════════════════════ */}
      <aside className="hidden md:flex w-64 bg-gray-900/90 backdrop-blur border-r border-gray-800 flex-col fixed h-full z-20">
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <div>
              <div className="font-bold text-sm text-white">HANS_TECH-HOST</div>
              <div className="text-xs text-gray-500">Bot Management Platform</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(item => (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                location === item.href
                  ? "bg-purple-500/20 text-purple-300 font-semibold"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <UserAvatar user={user} size={32} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{user?.name}</div>
              <div className="text-xs text-purple-400 font-medium">🪙 {Number(user?.xd_coins).toLocaleString()}</div>
            </div>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full text-xs text-gray-500 hover:text-red-400 text-left transition-colors flex items-center gap-2"
          >
            <span>🚪</span> Sign out
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════ */}
      <main className="md:ml-64 pt-14 md:pt-0 min-h-screen">
        {children}
      </main>

      {/* ══════════════════════════════════════════
          LOGOUT CONFIRMATION MODAL
      ══════════════════════════════════════════ */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-xs shadow-2xl text-center">
            <div className="text-4xl mb-3">🚪</div>
            <h3 className="text-lg font-bold text-white mb-2">Sign Out?</h3>
            <p className="text-gray-400 text-sm mb-5">
              Are you sure you want to sign out of HANS_TECH-HOST?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
