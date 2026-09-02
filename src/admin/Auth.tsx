import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import './admin.css';

type User = { id: string; email: string; name: string; role: 'admin' };
const AuthContext = createContext<{
  user: User | null; loading: boolean; error: string;
  refresh: () => Promise<void>; login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
} | null>(null);

export async function adminFetch(path: string, init?: RequestInit) {
  const response = await fetch(`/.netlify/functions/${path}`, { credentials: 'same-origin', cache: 'no-store', ...init });
  const body = await response.json().catch(() => ({ error: 'The server returned an unexpected response.' }));
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('irl-session-expired'));
    throw new Error(body.error || 'Unable to complete the request. Please try again.');
  }
  return body;
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/.netlify/functions/admin-auth', { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 401) { setUser(null); return; }
      if (!response.ok) throw new Error('Unable to check your sign-in. Please try again.');
      setUser((await response.json()).user);
    } catch (error) { setUser(null); setError((error as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const expired = () => { setUser(null); };
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('irl-session-expired', expired);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      window.removeEventListener('irl-session-expired', expired);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', visible);
      window.clearInterval(timer);
    };
  }, [refresh]);
  async function login(email: string, password: string) {
    const body = await adminFetch('admin-auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'login', email, password }) });
    setUser(body.user); setError('');
  }
  async function logout() {
    await adminFetch('admin-auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    setUser(null);
  }
  return <AuthContext.Provider value={{ user, loading, error, refresh, login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext)!; }
export function RequireAdmin() {
  const { user, loading, error, refresh } = useAuth();
  const location = useLocation();
  if (loading) return <main className="admin-state" role="status">Checking your sign-in…</main>;
  if (error) return <main className="admin-state"><p role="alert">{error}</p><button className="irl-button irl-button--primary" onClick={() => void refresh()}>Try again</button></main>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <Outlet />;
}
export function LoginPage() {
  const { user, login, loading } = useAuth();
  const location = useLocation();
  const requested = new URLSearchParams(location.search).get('next') || '/admin';
  const next = /^\/(admin(?:\/|\?|$)|screening(?:\/|$)|rate-engine(?:\/|$)|profiles\/curiocity-green-point$)/.test(requested) ? requested : '/admin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (user) return <Navigate to={next} replace />;
  return <main className="admin-login admin-ui"><Link to="/" className="admin-wordmark">IRL</Link>
    <form className="irl-card admin-login-card" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('');
      try { await login(email, password); } catch (error) { setError((error as Error).message); }
      finally { setBusy(false); setPassword(''); }
    }}>
      <p className="irl-eyebrow">IRL administration</p><h1>Sign in</h1><p>Review completed brand and operator profiles.</p>
      <label>Email<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={512} /></label>
      {error && <p role="alert">{error}</p>}
      <button className="irl-button irl-button--primary" disabled={busy || loading}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <p className="admin-muted">Access is for invited IRL administrators. Contact your IRL administrator for an account or password reset.</p>
    </form><Link to="/">Back to IRL</Link></main>;
}
export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <div className="admin-ui"><header className="admin-header"><Link to="/" className="admin-wordmark">IRL</Link>
    <nav aria-label="Administration"><Link to="/admin">Submissions</Link><a href="/screening">Screening</a><a href="/rate-engine">Rate engine</a></nav>
    <span>{user?.name}</span><button className="irl-button irl-button--secondary" disabled={busy} onClick={async () => {
      setBusy(true); setError('');
      try { await logout(); navigate('/login', { replace: true }); } catch (error) { setError((error as Error).message); }
      finally { setBusy(false); }
    }}>{busy ? 'Signing out…' : 'Sign out'}</button>
  </header>{error && <p className="admin-state" role="alert">{error}</p>}<Outlet /></div>;
}
