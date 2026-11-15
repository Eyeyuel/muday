import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Eye, EyeOff, Lock, LogIn, Mail, Moon, Sun } from 'lucide-react';
import { loginAdmin } from '../../api/admin-api';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';

export function AdminLogin({ onSuccess }: { locale?: string; onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved =
        localStorage.getItem('mezgeb_admin_theme') || localStorage.getItem('muday_theme_mode');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // Ignore storage errors
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('mezgeb_admin_theme', theme);
      localStorage.setItem('muday_theme_mode', theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);

    try {
      await loginAdmin(email, password);
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to sign in. Please check your credentials.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-[var(--background)] overflow-hidden">
      {/* Top-Right Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-2xl border-[var(--border)] bg-[var(--card)]/80 text-[var(--foreground)] backdrop-blur-md shadow-sm cursor-pointer"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-slate-700" />
          )}
        </Button>
      </div>

      {/* Background Decorative Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[var(--primary)]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <Card className="relative w-full max-w-md border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-xl shadow-2xl rounded-3xl p-2 sm:p-4 z-10 transition-all duration-300">
        <CardHeader className="space-y-3 text-center pb-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-ivory)] border border-[var(--border-hairline)] shadow-sm p-2.5">
            <img
              src="/favicon.png"
              alt="Muday Logo"
              className="h-full w-full object-contain drop-shadow-xs"
            />
          </div>
          <div className="space-y-1">
            <span className="inline-block text-xs font-semibold tracking-wider uppercase text-[var(--muted-foreground)]">
              Muday • Admin Portal
            </span>
            <CardTitle className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
              Admin Sign In
            </CardTitle>
            <CardDescription className="text-sm text-[var(--muted-foreground)]">
              Enter your administrator credentials to access system analytics.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {error ? (
            <div
              className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm font-medium text-red-600 dark:text-red-400 animate-in fade-in-50"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="admin-email"
                className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                <Input
                  id="admin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@muday.et"
                  disabled={loading}
                  className="pl-10 h-11 bg-[var(--background)]/60 border-[var(--border)] focus-visible:ring-[var(--primary)]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="admin-password"
                className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                <Input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="pl-10 pr-10 h-11 bg-[var(--background)]/60 border-[var(--border)] focus-visible:ring-[var(--primary)]"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-1 rounded-md transition-colors cursor-pointer"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 text-sm font-semibold rounded-xl mt-2 bg-[var(--primary)] text-[var(--primary-foreground)] shadow-md hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Signing In...</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  <span>Sign In</span>
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
