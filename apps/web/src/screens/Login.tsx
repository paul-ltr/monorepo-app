import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { env } from '@/lib/env';

export function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(false);
    setBusy(true);
    try {
      await login(email, password);
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  const field =
    'h-[42px] w-full rounded-[9px] border border-border-strong bg-surface-2 px-3 text-[14px] text-fg outline-none focus:border-primary';

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 text-fg">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 flex items-center gap-[11px]">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[10px]"
            style={{ background: 'linear-gradient(135deg,#5B8DEF,#1B4DB3)' }}
          >
            <img src="/brand/mark-white.svg" alt="" width={22} height={22} />
          </div>
          <div className="text-[20px] font-extrabold tracking-[-0.4px]">
            Lavo<span className="text-primary">Pilot</span>
          </div>
        </div>

        <div className="rounded-[18px] border border-border bg-surface p-8 shadow-[0_24px_60px_-18px_rgba(16,24,40,.18)]">
          <h1 className="mb-1.5 text-[22px] font-extrabold tracking-[-0.6px]">{t('auth.title')}</h1>
          <p className="mb-6 text-[14px] text-fg-muted">{t('auth.subtitle')}</p>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-fg-muted">{t('auth.email')}</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="demo@lavopilot.com"
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-fg-muted">{t('auth.password')}</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={field}
              />
            </label>

            {error && (
              <div className="rounded-[9px] bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
                {t('auth.error')}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" disabled={busy} className="mt-1 w-full">
              {busy ? t('auth.signingIn') : t('auth.submit')}
            </Button>
          </form>

          {(env.useMocks || env.authDevBypass) && (
            <div className="mt-5 rounded-[9px] border border-dashed border-border-strong bg-surface-2 px-3 py-2 text-center text-[12px] text-fg-subtle">
              {t('auth.demoHint')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
