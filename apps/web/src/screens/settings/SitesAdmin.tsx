import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AddressHit } from '@/lib/address';
import type { Site, SiteContact, UpdateSiteInput } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { SectionCard, Button, Modal } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { AddressField } from '@/components/AddressField';
import { QueryBoundary } from '@/components/state';
import { useTableControls, SearchInput, SortHeader, Pagination } from '@/components/DataTable';
import { cn } from '@/lib/cn';

const digits14 = (s: string) => s.replace(/\D/g, '').slice(0, 14);
const GRID = 'grid grid-cols-[1.4fr_1fr_.6fr_1.1fr_1.1fr_.8fr_72px] gap-2 items-center';
const cell = 'h-[32px] w-full rounded-[8px] border border-border bg-surface px-2 text-[12.5px] outline-none focus:border-primary';

/** M12 — the tenant's sites as an editable, searchable, paginated table. */
export function SitesAdmin() {
  const api = useApi();
  const query = useQuery({ queryKey: ['sites'], queryFn: () => api.getSites() });
  const [creating, setCreating] = useState(false);

  return (
    <SectionCard
      className="mb-[18px]"
      title="Paramètres par site"
      subtitle="Adresse, surface, identifiants énergie et contacts — enregistrement automatique."
      action={
        <Button variant="primary" size="sm" icon="plus" onClick={() => setCreating(true)}>
          Nouveau site
        </Button>
      }
    >
      <QueryBoundary query={query}>{(sites) => <SitesTable sites={sites} />}</QueryBoundary>
      {creating && <CreateSiteModal onClose={() => setCreating(false)} />}
    </SectionCard>
  );
}

function SitesTable({ sites }: { sites: Site[] }) {
  const table = useTableControls(sites, {
    search: (s) => `${s.name} ${s.city ?? ''} ${s.pdl ?? ''} ${s.pce ?? ''}`,
    sorters: {
      name: (s) => s.name.toLowerCase(),
      city: (s) => (s.city ?? '').toLowerCase(),
      surface: (s) => s.surfaceM2 ?? 0,
      pdl: (s) => s.pdl ?? '',
      pce: (s) => s.pce ?? '',
      status: (s) => s.status,
    },
    initialSort: { key: 'name', dir: 'asc' },
    pageSize: 8,
  });

  return (
    <>
      <div className="px-[18px] pb-2.5 pt-3">
        <SearchInput
          value={table.query}
          onChange={table.setQuery}
          placeholder="Rechercher un site, une ville, un PDL…"
          className="max-w-[340px]"
        />
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className={cn(GRID, 'border-b border-border px-[18px] pb-2')}>
            <SortHeader label="Site" sortKey="name" sort={table.sort} onToggle={table.toggleSort} />
            <SortHeader label="Ville" sortKey="city" sort={table.sort} onToggle={table.toggleSort} />
            <SortHeader label="m²" sortKey="surface" sort={table.sort} onToggle={table.toggleSort} />
            <SortHeader label="PDL Enedis" sortKey="pdl" sort={table.sort} onToggle={table.toggleSort} />
            <SortHeader label="PCE GRDF" sortKey="pce" sort={table.sort} onToggle={table.toggleSort} />
            <SortHeader label="Statut" sortKey="status" sort={table.sort} onToggle={table.toggleSort} />
            <span />
          </div>
          {table.view.length === 0 ? (
            <div className="px-[18px] py-8 text-center text-[12.5px] text-fg-subtle">Aucun site.</div>
          ) : (
            table.view.map((s) => <SiteRow key={s.id} site={s} />)
          )}
        </div>
      </div>
      <Pagination page={table.page} pageCount={table.pageCount} total={table.total} onPage={table.setPage} />
    </>
  );
}

function SiteRow({ site }: { site: Site }) {
  const api = useApi();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(site);
  const [saved, setSaved] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Resync when the server row changes (e.g. address panel fills city/coords).
  useEffect(() => setDraft(site), [site]);

  const save = useMutation({
    mutationFn: (patch: UpdateSiteInput['patch']) => api.updateSite({ siteId: site.id, patch }),
    onSuccess: (updated) => {
      qc.setQueryData<Site[]>(['sites'], (old) => old?.map((s) => (s.id === updated.id ? updated : s)) ?? []);
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    },
    onError: () => toast('Échec de l’enregistrement.', 'danger'),
  });

  /** Update a field locally and debounce-save it (per-field timer). */
  const edit = (field: keyof Site, value: unknown, debounceMs = 600) => {
    setDraft((d) => ({ ...d, [field]: value }));
    clearTimeout(timers.current[field]);
    timers.current[field] = setTimeout(() => save.mutate({ [field]: value }), debounceMs);
  };

  const del = useMutation({
    mutationFn: () => api.deleteSite(site.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      toast(`Site « ${site.name} » supprimé.`);
    },
    onError: () => toast('Échec de la suppression.', 'danger'),
  });

  const onAddress = (hit: AddressHit) => {
    const patch = { address: hit.label, city: hit.city, postalCode: hit.postcode, lat: hit.lat, lng: hit.lng };
    setDraft((d) => ({ ...d, ...patch }));
    save.mutate(patch);
  };

  return (
    <div className="border-b border-border last:border-b-0">
      <div className={cn(GRID, 'px-[18px] py-2')}>
        <input
          className={cell}
          value={draft.name}
          onChange={(e) => edit('name', e.target.value)}
          aria-label={`Nom du site ${site.name}`}
        />
        <input
          className={cell}
          value={draft.city ?? ''}
          onChange={(e) => edit('city', e.target.value || null)}
          aria-label="Ville"
        />
        <input
          className={cn(cell, 'tabular-nums')}
          inputMode="numeric"
          value={draft.surfaceM2 ?? ''}
          onChange={(e) => edit('surfaceM2', e.target.value === '' ? null : Number(e.target.value))}
          aria-label="Surface m²"
        />
        <input
          className={cn(cell, 'font-mono')}
          inputMode="numeric"
          placeholder="14 chiffres"
          value={draft.pdl ?? ''}
          onChange={(e) => edit('pdl', digits14(e.target.value) || null)}
          aria-label="PDL Enedis"
        />
        <input
          className={cn(cell, 'font-mono')}
          inputMode="numeric"
          placeholder="14 chiffres"
          value={draft.pce ?? ''}
          onChange={(e) => edit('pce', digits14(e.target.value) || null)}
          aria-label="PCE GRDF"
        />
        <select
          className={cell}
          value={draft.status}
          onChange={(e) => edit('status', e.target.value, 0)}
          aria-label="Statut"
        >
          <option value="active">Actif</option>
          <option value="paused">En pause</option>
          <option value="closed">Fermé</option>
        </select>
        <div className="flex items-center justify-end gap-1">
          <span className={cn('text-ok transition-opacity', saved ? 'opacity-100' : 'opacity-0')} title="Enregistré">
            <Icon name="check" size={14} />
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label="Détails du site"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] border border-border text-fg-subtle hover:text-fg"
          >
            <Icon name="chevronDown" size={14} className={cn('transition-transform', expanded && 'rotate-180')} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="grid grid-cols-1 gap-4 bg-surface-2 px-[18px] py-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-fg-subtle">Adresse (recherche BAN)</span>
            <AddressField
              value={draft.address ?? ''}
              onChange={(v) => edit('address', v || null)}
              onSelect={onAddress}
            />
            <span className="mt-1 text-[10.5px] text-fg-subtle">
              {draft.postalCode || '—'} {draft.city || ''}
              {draft.lat != null && draft.lng != null ? ` · ${draft.lat.toFixed(4)}, ${draft.lng.toFixed(4)}` : ''}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-fg-subtle">N° SMS d’alerte</span>
            <input
              className={cn(cell, 'md:max-w-[240px]')}
              type="tel"
              placeholder="+33 6 12 34 56 78"
              value={draft.smsNumber ?? ''}
              onChange={(e) => edit('smsNumber', e.target.value || null)}
            />
          </div>
          <div className="md:col-span-2">
            <SiteContacts siteId={site.id} />
          </div>
          <div className="md:col-span-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-danger"
              disabled={del.isPending}
              onClick={() => del.mutate()}
            >
              Supprimer ce site
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SiteContacts({ siteId }: { siteId: string }) {
  const api = useApi();
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ['siteContacts', siteId];
  const { data: contacts = [] } = useQuery({ queryKey: key, queryFn: () => api.getSiteContacts(siteId) });
  const [kind, setKind] = useState<'email' | 'phone'>('email');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');

  const add = useMutation({
    mutationFn: () =>
      api.addSiteContact({ siteId, kind, value: value.trim(), label: label.trim() || null, isAlertRecipient: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      setValue('');
      setLabel('');
    },
    onError: () => toast('Échec de l’ajout du contact.', 'danger'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.removeSiteContact(siteId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return (
    <div className="rounded-[10px] border border-border bg-surface p-3">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.4px] text-fg-subtle">Contacts (mails & téléphones)</div>
      <div className="flex flex-col gap-1.5">
        {contacts.length === 0 && <div className="text-[12px] text-fg-subtle">Aucun contact.</div>}
        {contacts.map((c: SiteContact) => (
          <div key={c.id} className="flex items-center gap-2 text-[12.5px]">
            <Icon name={c.kind === 'email' ? 'chat' : 'bell'} size={13} className="text-fg-subtle" />
            <span className="font-medium">{c.value}</span>
            {c.label && <span className="text-fg-subtle">· {c.label}</span>}
            <button
              type="button"
              onClick={() => remove.mutate(c.id)}
              className="ml-auto text-[11px] font-semibold text-danger hover:underline"
            >
              Retirer
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as 'email' | 'phone')} className={cn(cell, 'w-[110px]')}>
          <option value="email">E-mail</option>
          <option value="phone">Téléphone</option>
        </select>
        <input
          className={cn(cell, 'flex-1 min-w-[180px]')}
          placeholder={kind === 'email' ? 'contact@laverie.fr' : '+33 6 12 34 56 78'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <input
          className={cn(cell, 'w-[140px]')}
          placeholder="Libellé (opt.)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Button variant="secondary" size="sm" icon="plus" disabled={!value.trim() || add.isPending} onClick={() => add.mutate()}>
          Ajouter
        </Button>
      </div>
    </div>
  );
}

function CreateSiteModal({ onClose }: { onClose: () => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [hit, setHit] = useState<AddressHit | null>(null);
  const [surfaceM2, setSurfaceM2] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.createSite({
        name: name.trim(),
        address: address.trim() || null,
        city: hit?.city ?? null,
        postalCode: hit?.postcode ?? null,
        lat: hit?.lat ?? null,
        lng: hit?.lng ?? null,
        surfaceM2: surfaceM2 === '' ? null : Number(surfaceM2),
        status: 'active',
      }),
    onSuccess: (site) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      toast(`Site « ${site.name} » créé.`);
      onClose();
    },
    onError: () => toast('Échec de la création du site.', 'danger'),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Nouveau site"
      subtitle="Créez un magasin et renseignez son adresse."
      icon="network"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" size="sm" icon="check" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Création…' : 'Créer le site'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-fg-subtle">Nom du site</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lyon-3 Guillotière" className={cell} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-fg-subtle">Adresse</span>
          <AddressField value={address} onChange={setAddress} onSelect={(h) => { setHit(h); setAddress(h.label); }} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-fg-subtle">Surface (m²)</span>
          <input value={surfaceM2} onChange={(e) => setSurfaceM2(e.target.value)} inputMode="numeric" placeholder="180" className={cn(cell, 'max-w-[160px]')} />
        </label>
      </div>
    </Modal>
  );
}
