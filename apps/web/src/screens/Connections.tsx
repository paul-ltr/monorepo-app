import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, ScreenHeader, SectionCard } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { ConnectPilot } from '@/components/ConnectPilot';
import { useApi } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { cn } from '@/lib/cn';
import { fmtBytes } from '@/lib/format';

/**
 * Connections — the one place to link every data source LavoPilot can draw on.
 * Kept deliberately simple for now (we iterate later): Enedis, GRDF ADICT,
 * Wi-Line, Pennylane, and a free-form "Autre" card, plus a per-user document
 * context drop-zone and the assistant's memory.
 */
export function Connections() {
  return (
    <>
      <ScreenHeader
        crumbs={['LavoPilot', 'Connexions']}
        title="Connexions"
        actions={
          <span className="text-[12.5px] text-fg-subtle">
            Secrets chiffrés · AWS Secrets Manager
          </span>
        }
      />

      <div className="mb-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        <ConnectorCard
          icon="bolt"
          iconClass="text-warn"
          title="Enedis"
          subtitle="Électricité · Data Connect (PDL/PRM)"
        >
          <ConnectPilot provider="enedis" />
        </ConnectorCard>

        <ConnectorCard
          icon="flame"
          iconClass="text-danger"
          title="GRDF ADICT"
          subtitle="Gaz · connexion d’un PCE"
        >
          <ConnectPilot provider="grdf" />
        </ConnectorCard>

        <ConnectorCard
          icon="droplet"
          iconClass="text-info"
          title="Wi-Line"
          subtitle="www.wi-line.fr · identifiants"
        >
          <WilineForm />
        </ConnectorCard>

        <ConnectorCard
          icon="bank"
          iconClass="text-primary"
          title="Pennylane"
          subtitle="Comptabilité · OAuth 2.0"
        >
          <PennylaneForm />
        </ConnectorCard>
      </div>

      <div className="mb-[18px]">
        <OtherCard />
      </div>

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-2">
        <DocumentsPanel />
        <MemoryPanel />
      </div>
    </>
  );
}

function ConnectorCard({
  icon,
  iconClass,
  title,
  subtitle,
  children,
}: {
  icon: IconName;
  iconClass: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-[18px_20px]">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-2">
          <Icon name={icon} size={17} className={iconClass} strokeWidth={2} />
        </span>
        <div>
          <div className="text-[14px] font-bold">{title}</div>
          <div className="text-[11.5px] text-fg-subtle">{subtitle}</div>
        </div>
      </div>
      {children}
    </Card>
  );
}

const fieldCls =
  'h-[36px] rounded-[9px] border border-border bg-surface-2 px-2.5 text-[13px] outline-none focus:border-primary';

function WilineForm() {
  const api = useApi();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const connect = useMutation({
    mutationFn: () => api.wilineConnect({ username, password }),
    onSuccess: (r) => {
      setDone(r.ok);
      toast(r.message, r.ok ? 'ok' : 'danger');
    },
  });
  if (done)
    return (
      <div className="flex items-center gap-1.5 rounded-[10px] bg-ok-soft/40 px-3 py-2.5 text-[12.5px] font-semibold text-ok">
        <Icon name="check" size={15} strokeWidth={2.4} /> Wi-Line connecté pour « {username} ».
      </div>
    );
  return (
    <div className="flex flex-col gap-2.5">
      <input
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Identifiant Wi-Line"
        className={fieldCls}
      />
      <input
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Mot de passe"
        className={fieldCls}
      />
      <Button
        variant="primary"
        size="sm"
        icon="power"
        className="self-start"
        disabled={!username || !password || connect.isPending}
        onClick={() => connect.mutate()}
      >
        {connect.isPending ? 'Connexion…' : 'Connecter'}
      </Button>
    </div>
  );
}

function PennylaneForm() {
  const api = useApi();
  const { toast } = useToast();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['pennylane'], queryFn: () => api.pennylaneStatus() });
  const connect = useMutation({
    mutationFn: async () => {
      const a = await api.pennylaneAuthorize();
      if (a.authorizeUrl.startsWith('http')) {
        window.location.href = a.authorizeUrl;
        return null;
      }
      return api.pennylaneComplete({ state: a.state });
    },
    onSuccess: (r) => {
      if (r) toast(r.message, 'ok');
      qc.invalidateQueries({ queryKey: ['pennylane'] });
    },
  });
  const disconnect = useMutation({
    mutationFn: () => api.pennylaneDisconnect(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pennylane'] }),
  });

  if (status.data?.connected)
    return (
      <div className="flex items-center justify-between gap-2 rounded-[10px] bg-ok-soft/40 px-3 py-2.5 text-[12.5px]">
        <span className="flex items-center gap-1.5 font-semibold text-ok">
          <Icon name="check" size={15} strokeWidth={2.4} />{' '}
          {status.data.company ?? 'Société connectée'}
        </span>
        <button
          onClick={() => disconnect.mutate()}
          className="text-[11.5px] font-semibold text-danger hover:underline"
        >
          Déconnecter
        </button>
      </div>
    );
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[12px] text-fg-muted">
        Connectez votre comptabilité Pennylane en un clic (OAuth).
      </p>
      <Button
        variant="primary"
        size="sm"
        icon="power"
        className="self-start"
        disabled={connect.isPending}
        onClick={() => connect.mutate()}
      >
        {connect.isPending ? 'Connexion…' : 'Connecter Pennylane'}
      </Button>
    </div>
  );
}

function OtherCard() {
  const api = useApi();
  const { toast } = useToast();
  const [label, setLabel] = useState('');
  const [details, setDetails] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const submit = useMutation({
    mutationFn: () =>
      api.otherConnect({
        label,
        details,
        username: username || undefined,
        password: password || undefined,
      }),
    onSuccess: (r) => {
      setDone(true);
      toast(r.message, 'ok');
    },
  });
  return (
    <SectionCard
      title="Autre source"
      subtitle="Décrivez la source que vous souhaitez connecter — nous nous en occupons."
    >
      <div className="flex flex-col gap-3 p-[18px]">
        {done ? (
          <div className="flex items-center gap-1.5 rounded-[10px] bg-ok-soft/40 px-3 py-2.5 text-[12.5px] font-semibold text-ok">
            <Icon name="check" size={15} strokeWidth={2.4} /> Demande enregistrée pour « {label} ».
          </div>
        ) : (
          <>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nom de la source (ex. Onlaundry, Ipso, un tableur…)"
              className={fieldCls}
            />
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder="Décrivez ce que vous voulez connecter, les infos utiles, la marche à suivre…"
              className="rounded-[9px] border border-border bg-surface-2 px-2.5 py-2 text-[13px] outline-none focus:border-primary"
            />
            <div className="flex flex-wrap gap-2.5">
              <input
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Identifiant (optionnel)"
                className={cn(fieldCls, 'flex-1')}
              />
              <input
                type="password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe (optionnel)"
                className={cn(fieldCls, 'flex-1')}
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              icon="plus"
              className="self-start"
              disabled={!label || submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? 'Envoi…' : 'Envoyer la demande'}
            </Button>
          </>
        )}
      </div>
    </SectionCard>
  );
}

function DocumentsPanel() {
  const api = useApi();
  const { toast } = useToast();
  const qc = useQueryClient();
  const docs = useQuery({ queryKey: ['documents'], queryFn: () => api.getDocuments() });
  const [dragOver, setDragOver] = useState(false);

  const upload = useMutation({
    mutationFn: (file: File) =>
      api.uploadDocument({
        name: file.name,
        mime: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      }),
    onSuccess: () => {
      toast('Document ajouté au contexte.', 'ok');
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => upload.mutate(f));
  };

  return (
    <SectionCard
      title="Documents de contexte"
      subtitle="Déposez des documents que LavoPilot pourra utiliser dans vos conversations."
    >
      <div className="flex flex-col gap-3 p-[18px]">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFiles(e.dataTransfer.files);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[12px] border-2 border-dashed p-6 text-center transition-colors',
            dragOver ? 'border-primary bg-primary-soft' : 'border-border-strong bg-surface-2',
          )}
        >
          <Icon name="download" size={22} className="text-fg-subtle" strokeWidth={1.6} />
          <span className="text-[12.5px] font-semibold">Glissez un fichier ici</span>
          <span className="text-[11px] text-fg-subtle">
            ou cliquez pour parcourir · PDF, images, tableurs
          </span>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
        <div className="flex flex-col gap-1.5">
          {(docs.data ?? []).map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-2.5 rounded-[9px] border border-border bg-surface px-3 py-2"
            >
              <Icon name="file" size={16} className="text-fg-muted" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold">{d.name}</div>
                <div className="text-[10.5px] text-fg-subtle">
                  {fmtBytes(d.sizeBytes)}
                  {d.note ? ` · ${d.note}` : ''}
                </div>
              </div>
              <button
                onClick={() => remove.mutate(d.id)}
                aria-label="Supprimer"
                className="text-fg-subtle hover:text-danger"
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          ))}
          {(docs.data ?? []).length === 0 && (
            <div className="py-2 text-center text-[12px] text-fg-subtle">
              Aucun document pour l’instant.
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function MemoryPanel() {
  const api = useApi();
  const { toast } = useToast();
  const qc = useQueryClient();
  const mem = useQuery({ queryKey: ['memory'], queryFn: () => api.getMemory() });
  const [draft, setDraft] = useState('');

  const save = useMutation({
    mutationFn: (facts: string[]) => api.updateMemory({ facts }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memory'] });
    },
  });

  const facts = mem.data?.facts ?? [];
  const add = () => {
    const f = draft.trim();
    if (!f) return;
    save.mutate([...facts, f]);
    setDraft('');
    toast('Mémoire mise à jour.', 'ok');
  };
  const removeAt = (i: number) => save.mutate(facts.filter((_, j) => j !== i));

  return (
    <SectionCard
      title="Mémoire de LavoPilot"
      subtitle="Ce que l’assistant garde en tête pour vous, d’une conversation à l’autre."
    >
      <div className="flex flex-col gap-3 p-[18px]">
        <div className="flex flex-col gap-1.5">
          {facts.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-[9px] border border-border bg-surface px-3 py-2"
            >
              <Icon name="sparkles" size={14} className="text-primary" />
              <span className="min-w-0 flex-1 text-[12.5px]">{f}</span>
              <button
                onClick={() => removeAt(i)}
                aria-label="Oublier"
                className="text-fg-subtle hover:text-danger"
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          ))}
          {facts.length === 0 && (
            <div className="py-2 text-center text-[12px] text-fg-subtle">
              Aucune note en mémoire.
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Ajouter une note (ex. « privilégier les heures creuses »)"
            className={cn(fieldCls, 'flex-1')}
          />
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            onClick={add}
            disabled={!draft.trim() || save.isPending}
          >
            Retenir
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
