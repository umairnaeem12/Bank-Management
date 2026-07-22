'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Landmark, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/use-auth-store';
import { useHydrated } from '@/hooks/use-hydrated';
import { toast } from '@/store/use-toast-store';
import { DEMO_CREDENTIALS } from '@/lib/auth/credentials';
import { ROLE_LABELS } from '@/lib/auth/permissions';
import { email as emailRule, required, validate, type ValidationErrors } from '@/lib/utils/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useAuthStore((s) => s.session);
  const signIn = useAuthStore((s) => s.signIn);
  const pending = useAuthStore((s) => s.pending);
  const authError = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [form, setForm] = useState<LoginForm>({ email: '', password: '' });
  const [errors, setErrors] = useState<ValidationErrors<LoginForm>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);

  // Someone already signed in shouldn't sit on the login screen.
  useEffect(() => {
    if (hydrated && session) router.replace('/dashboard');
  }, [hydrated, session, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();

    const nextErrors = validate(form, {
      email: (v) => required('Email')(v) ?? emailRule()(v),
      password: required('Password'),
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const ok = await signIn(form.email, form.password, remember);
    if (ok) {
      toast.success('Welcome back', 'You are now signed in to the management console.');
      router.replace('/dashboard');
    }
  };

  /** Fills the form from a demo card so a reviewer can sign in with one click. */
  const applyDemoCredential = (demoEmail: string, demoPassword: string) => {
    setForm({ email: demoEmail, password: demoPassword });
    setErrors({});
    clearError();
  };

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Brand panel — hidden on small screens where it would push the form below the fold. */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-900 p-12 text-white lg:flex xl:w-[55%]">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 20%, #1e46e8 0%, transparent 45%), radial-gradient(circle at 85% 75%, #0d9488 0%, transparent 50%), linear-gradient(140deg, #141d53 0%, #1b2d88 100%)',
          }}
          aria-hidden
        />

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Landmark className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <p className="text-base font-semibold">NorthBank</p>
            <p className="text-xs text-white/70">Management Console</p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Banking operations,
            <br />
            in one clear view.
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-white/75">
            Manage customers, accounts, transactions and service requests from a single console
            built for speed, clarity and control.
          </p>

          <dl className="mt-10 grid grid-cols-3 gap-6">
            {[
              ['48+', 'Customers'],
              ['420+', 'Transactions'],
              ['99.9%', 'Uptime'],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="text-2xl font-semibold tabular">{value}</dt>
                <dd className="mt-0.5 text-xs text-white/60">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-white/60">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Demo environment — data is stored locally in your browser.
        </p>
      </div>

      {/* Form */}
      <div className="flex w-full items-center justify-center px-4 py-10 sm:px-8 lg:w-1/2 xl:w-[45%]">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Landmark className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-primary-text">NorthBank</p>
              <p className="text-xs text-muted-text">Management Console</p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-primary-text">Sign in</h2>
          <p className="mt-1.5 text-sm text-muted-text">
            Enter your credentials to access the console.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
            <Input
              label="Email address"
              type="email"
              autoComplete="username"
              placeholder="you@northbank.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              error={errors.email}
              leftIcon={<Mail className="h-4 w-4" aria-hidden />}
              required
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              error={errors.password}
              leftIcon={<Lock className="h-4 w-4" aria-hidden />}
              required
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="rounded-md p-1.5 text-muted-text transition-colors hover:bg-surface-hover hover:text-primary-text"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              }
            />

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-secondary-text">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-border-strong text-brand-600 focus:ring-brand-500/30"
                />
                Keep me signed in
              </label>
              <button
                type="button"
                onClick={() =>
                  toast.info(
                    'Password recovery',
                    'Password resets are not available in this demo environment.',
                  )
                }
                className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                Forgot password?
              </button>
            </div>

            {authError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
              >
                {authError}
              </div>
            )}

            <Button type="submit" size="lg" fullWidth loading={pending}>
              {pending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="mt-8">
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border-subtle" />
              <span className="text-[10px] font-semibold tracking-wider text-muted-text uppercase">
                Demo accounts
              </span>
              <span className="h-px flex-1 bg-border-subtle" />
            </div>

            <div className="mt-4 grid gap-2">
              {DEMO_CREDENTIALS.map((credential) => (
                <button
                  key={credential.staffId}
                  type="button"
                  onClick={() => applyDemoCredential(credential.email, credential.password)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-left transition-colors hover:border-brand-300 hover:bg-surface-hover"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-primary-text">
                      {ROLE_LABELS[credential.role]}
                    </span>
                    <span className="block truncate text-[11px] text-muted-text">
                      {credential.email}
                    </span>
                  </span>
                  <span className="shrink-0 rounded bg-surface-sunken px-2 py-1 text-[10px] font-medium text-secondary-text">
                    Use
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-3 text-center text-[11px] text-muted-text">
              Each role sees a different set of permissions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
