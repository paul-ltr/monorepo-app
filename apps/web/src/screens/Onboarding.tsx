import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { Button, Card, ScreenHeader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { cn } from '@/lib/cn';
import { SitesAdmin } from './settings/SitesAdmin';
import { UsersAdmin } from './settings/UsersAdmin';

const ONBOARDING_DONE_KEY = 'pilotage-onboarding-done';

/** Marks onboarding complete so the wizard doesn't re-open. */
export function markOnboardingDone() {
  try {
    localStorage.setItem(ONBOARDING_DONE_KEY, '1');
  } catch {
    /* ignore */
  }
}
export function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_DONE_KEY) === '1';
  } catch {
    return true;
  }
}

type Mode = 'network' | 'single';

/**
 * First-run setup wizard. A network owner configures the group (sites, team,
 * connectors); a single-site owner sets up their shop. Reuses the sites and
 * users admin surfaces so onboarding and day-to-day settings stay consistent.
 */
export function Onboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode | null>(null);
  const [step, setStep] = useState(0);

  const steps = useMemo(
    () =>
      mode === 'network'
        ? ['Profil', 'Mot de passe', 'Sites', 'Équipe', 'Connecteurs']
        : ['Profil', 'Mot de passe', 'Mon magasin', 'Connecteurs'],
    [mode],
  );

  const finish = () => {
    markOnboardingDone();
    toast('Configuration terminée. Bienvenue sur LavoPilot !');
    navigate({ to: '/' });
  };

  return (
    <>
      <ScreenHeader crumbs={['LavoPilot', 'Onboarding']} title="Configurez votre espace" />
      <Card className="mx-auto max-w-[840px] p-[22px]">
        <StepRail current={step} labels={steps} />
        <div className="mt-6">
          {step === 0 && <ProfileStep mode={mode} onPick={setMode} />}
          {step === 1 && <PasswordStep />}
          {mode === 'network' && step === 2 && <SitesAdmin />}
          {mode === 'network' && step === 3 && <UsersAdmin />}
          {mode === 'single' && step === 2 && <SitesAdmin />}
          {isConnectorsStep(mode, step) && <ConnectorsStep />}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <Button variant="secondary" size="sm" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            Précédent
          </Button>
          {isLastStep(mode, step) ? (
            <Button variant="primary" size="sm" icon="check" onClick={finish}>
              Terminer
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled={step === 0 && !mode}
              onClick={() => setStep((s) => s + 1)}
            >
              Continuer
            </Button>
          )}
        </div>
      </Card>
    </>
  );
}

function isConnectorsStep(mode: Mode | null, step: number): boolean {
  return (mode === 'network' && step === 4) || (mode === 'single' && step === 3);
}
function isLastStep(mode: Mode | null, step: number): boolean {
  return isConnectorsStep(mode, step);
}

function StepRail({ current, labels }: { current: number; labels: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
      {labels.map((l, i) => (
        <span key={l} className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
              i < current ? 'bg-ok text-white' : i === current ? 'bg-primary text-primary-fg' : 'bg-surface-3 text-fg-subtle',
            )}
          >
            {i < current ? '✓' : i + 1}
          </span>
          <span className={cn(i === current ? 'font-semibold text-fg' : 'text-fg-subtle')}>{l}</span>
          {i < labels.length - 1 && <span className="mx-1 h-px w-4 bg-border" />}
        </span>
      ))}
    </div>
  );
}

function ProfileStep({ mode, onPick }: { mode: Mode | null; onPick: (m: Mode) => void }) {
  const opts: { key: Mode; icon: 'network' | 'washer'; title: string; desc: string }[] = [
    { key: 'network', icon: 'network', title: 'Propriétaire de réseau', desc: 'Plusieurs magasins, une équipe, un benchmark consolidé.' },
    { key: 'single', icon: 'washer', title: 'Propriétaire d’un magasin', desc: 'Un seul site à piloter, mise en route rapide.' },
  ];
  return (
    <div>
      <div className="mb-4 text-[13px] text-fg-muted">Quel type de compte configurez-vous ?</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {opts.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onPick(o.key)}
            className={cn(
              'flex flex-col items-start gap-2 rounded-[12px] border p-4 text-left transition-colors',
              mode === o.key ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:border-border-strong',
            )}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
              <Icon name={o.icon} size={18} />
            </span>
            <span className="text-[14px] font-bold">{o.title}</span>
            <span className="text-[12px] text-fg-subtle">{o.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PasswordStep() {
  const { completeNewPassword } = useAuth();
  const { toast } = useToast();
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const valid = pwd.length >= 8 && pwd === confirm;

  const submit = async () => {
    try {
      await completeNewPassword(pwd);
      setDone(true);
      toast('Mot de passe défini.');
    } catch (e) {
      toast((e as Error).message === 'weak_password' ? '8 caractères minimum.' : 'Impossible de définir le mot de passe.', 'danger');
    }
  };

  const field = 'h-[38px] w-full rounded-[9px] border border-border bg-surface px-3 text-[13px] outline-none focus:border-primary';
  return (
    <div className="max-w-[420px]">
      <div className="mb-4 text-[13px] text-fg-muted">Choisissez le mot de passe de votre compte.</div>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-fg-subtle">Mot de passe (8 caractères min.)</span>
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className={field} autoComplete="new-password" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-fg-subtle">Confirmation</span>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} autoComplete="new-password" />
        </label>
        <div className="flex items-center gap-3">
          <Button variant="primary" size="sm" icon="check" disabled={!valid} onClick={submit}>
            Définir le mot de passe
          </Button>
          {done && (
            <span className="flex items-center gap-1 text-[12px] font-semibold text-ok">
              <Icon name="check" size={14} /> Enregistré
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ConnectorsStep() {
  const navigate = useNavigate();
  return (
    <div className="max-w-[560px]">
      <div className="mb-3 text-[13px] text-fg-muted">
        Reliez vos outils (Enedis, GRDF, marques de machines, comptabilité) pour alimenter le pilotage. Vous pouvez
        aussi le faire plus tard depuis les paramètres.
      </div>
      <Button variant="secondary" size="sm" icon="gear" onClick={() => navigate({ to: '/settings' })}>
        Ouvrir les connecteurs
      </Button>
    </div>
  );
}
