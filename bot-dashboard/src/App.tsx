import { useState, useEffect, createContext, useContext } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { api, type User, getToken } from "@/lib/api";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import DeployBot from "@/pages/DeployBot";
import BotDetail from "@/pages/BotDetail";
import Coins from "@/pages/Coins";
import Payments from "@/pages/Payments";
import Settings from "@/pages/Settings";
import AdminPanel from "@/pages/AdminPanel";
import Layout from "@/pages/Layout";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

interface AuthContextType {
  user: User | null;
  setUser: (u: User | null) => void;
  logout: () => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  logout: () => {},
  loading: true,
});

export function useAuth() { return useContext(AuthContext); }

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    api.auth.me()
      .then(d => setUser(d.user))
      .catch(() => localStorage.removeItem("bd_token"))
      .finally(() => setLoading(false));
  }, []);

  function logout() {
    localStorage.removeItem("bd_token");
    setUser(null);
    queryClient.clear();
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading]);
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
      <div className="text-center">
        <div className="text-4xl mb-3 animate-spin">⚡</div>
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    </div>
  );
  if (!user) return null;
  return <Layout><Component /></Layout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/deploy" component={() => <ProtectedRoute component={DeployBot} />} />
      <Route path="/bots/:id" component={() => <ProtectedRoute component={BotDetail} />} />
      <Route path="/coins" component={() => <ProtectedRoute component={Coins} />} />
      <Route path="/payments" component={() => <ProtectedRoute component={Payments} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route path="/admin" component={() => <ProtectedRoute component={AdminPanel} />} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
