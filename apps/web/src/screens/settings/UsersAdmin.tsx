import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppUser } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useScope } from '@/lib/scope';
import { useToast } from '@/components/Toast';
import { SectionCard, Button, Modal, Pill, type Tone } from '@/components/ui';
import { QueryBoundary } from '@/components/state';
import { useTableControls, SearchInput, SortHeader, Pagination } from '@/components/DataTable';
import { cn } from '@/lib/cn';

/** System roles offered when inviting or editing a member. */
export const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  network_admin: 'Admin réseau',
  manager: 'Manager',
  accountant: 'Comptable',
  technician: 'Technicien',
  viewer: 'Lecture seule',
};
const ROLE_KEYS = Object.keys(ROLE_LABELS);

const STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Actif', tone: 'ok' },
  invited: { label: 'Invité', tone: 'info' },
  disabled: { label: 'Désactivé', tone: 'neutral' },
};
const cell = 'h-[34px] w-full rounded-[8px] border border-border bg-surface px-2.5 text-[13px] outline-none focus:border-primary';

/**
 * M12 — tenant members & invitations. Rendered only for super admins / network
 * admins (the caller gates on `M12:users:manage`).
 */
export function UsersAdmin() {
  const api = useApi();
  const query = useQuery({ queryKey: ['users'], queryFn: () => api.getUsers() });
  const [inviting, setInviting] = useState(false);

  return (
    <SectionCard
      className="mb-[18px]"
      title="Comptes & invitations"
      subtitle="Créez des comptes et invitez des personnes avec le rôle de votre choix."
      action={
        <Button variant="primary" size="sm" icon="plus" onClick={() => setInviting(true)}>
          Inviter
        </Button>
      }
    >
      <QueryBoundary query={query}>{(users) => <UsersTable users={users} />}</QueryBoundary>
      {inviting && <InviteModal onClose={() => setInviting(false)} />}
    </SectionCard>
  );
}

const GRID = 'grid grid-cols-[1.3fr_1.6fr_1fr_.9fr_auto] gap-2 items-center';

function UsersTable({ users }: { users: AppUser[] }) {
  const table = useTableControls(users, {
    search: (u) => `${u.fullName} ${u.email} ${u.roles.join(' ')}`,
    sorters: {
      name: (u) => u.fullName.toLowerCase(),
      email: (u) => u.email.toLowerCase(),
      role: (u) => u.roles[0] ?? '',
      status: (u) => u.status,
    },
    initialSort: { key: 'name', dir: 'asc' },
    pageSize: 8,
  });

  return (
    <>
      <div className="px-[18px] pb-2.5 pt-3">
        <SearchInput value={table.query} onChange={table.setQuery} placeholder="Rechercher un membre…" className="max-w-[340px]" />
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className={cn(GRID, 'border-b border-border px-[18px] pb-2')}>
            <SortHeader label="Nom" sortKey="name" sort={table.sort} onToggle={table.toggleSort} />
            <SortHeader label="E-mail" sortKey="email" sort={table.sort} onToggle={table.toggleSort} />
            <SortHeader label="Rôle" sortKey="role" sort={table.sort} onToggle={table.toggleSort} />
            <SortHeader label="Statut" sortKey="status" sort={table.sort} onToggle={table.toggleSort} />
            <span />
          </div>
          {table.view.length === 0 ? (
            <div className="px-[18px] py-8 text-center text-[12.5px] text-fg-subtle">Aucun membre.</div>
          ) : (
            table.view.map((u) => <UserRow key={u.id} user={u} />)
          )}
        </div>
      </div>
      <Pagination page={table.page} pageCount={table.pageCount} total={table.total} onPage={table.setPage} />
    </>
  );
}

function UserRow({ user }: { user: AppUser }) {
  const api = useApi();
  const qc = useQueryClient();
  const { toast } = useToast();
  const st = STATUS[user.status] ?? STATUS.active!;

  const setRole = useMutation({
    mutationFn: (role: string) => api.updateUserRoles({ userId: user.id, roleKeys: [role], scopeType: 'tenant' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast(`Rôle mis à jour pour ${user.fullName}.`);
    },
    onError: () => toast('Échec de la mise à jour du rôle.', 'danger'),
  });
  const disable = useMutation({
    mutationFn: () => api.disableUser(user.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast(`${user.fullName} désactivé.`);
    },
    onError: () => toast('Échec de la désactivation.', 'danger'),
  });

  return (
    <div className={cn(GRID, 'border-b border-border px-[18px] py-2.5 last:border-b-0')}>
      <div className="truncate text-[13px] font-semibold">{user.fullName}</div>
      <div className="truncate text-[12.5px] text-fg-muted">{user.email}</div>
      <select
        className={cn(cell, 'h-[30px]')}
        value={user.roles[0] ?? 'viewer'}
        onChange={(e) => setRole.mutate(e.target.value)}
        disabled={user.status === 'disabled'}
        aria-label={`Rôle de ${user.fullName}`}
      >
        {ROLE_KEYS.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <Pill tone={st.tone}>{st.label}</Pill>
      <div className="flex justify-end">
        {user.status !== 'disabled' && (
          <button
            type="button"
            onClick={() => disable.mutate()}
            disabled={disable.isPending}
            className="text-[11.5px] font-semibold text-danger hover:underline disabled:opacity-50"
          >
            Désactiver
          </button>
        )}
      </div>
    </div>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { sites } = useScope();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('viewer');
  const [scopeType, setScopeType] = useState<'tenant' | 'site'>('tenant');
  const [scopeId, setScopeId] = useState('');

  const invite = useMutation({
    mutationFn: () =>
      api.inviteUser({
        email: email.trim(),
        fullName: fullName.trim(),
        roleKeys: [role],
        scopeType,
        scopeId: scopeType === 'site' && scopeId ? scopeId : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast(`Invitation envoyée à ${email.trim()}.`);
      onClose();
    },
    onError: (e: Error) => toast(e.message === 'conflict' ? 'Cet email est déjà utilisé.' : 'Échec de l’invitation.', 'danger'),
  });

  const valid = /.+@.+\..+/.test(email) && fullName.trim().length > 0 && (scopeType !== 'site' || !!scopeId);

  return (
    <Modal
      open
      onClose={onClose}
      title="Inviter une personne"
      subtitle="Un e-mail d’invitation avec définition du mot de passe lui sera envoyé."
      icon="users"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" size="sm" icon="check" disabled={!valid || invite.isPending} onClick={() => invite.mutate()}>
            {invite.isPending ? 'Envoi…' : 'Envoyer l’invitation'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-fg-subtle">Nom complet</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Camille Martin" className={cell} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-fg-subtle">E-mail</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="camille@laverie.fr" className={cell} />
        </label>
        <div className="grid grid-cols-2 gap-3.5">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-fg-subtle">Rôle</span>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={cell}>
              {ROLE_KEYS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-fg-subtle">Périmètre</span>
            <select value={scopeType} onChange={(e) => setScopeType(e.target.value as 'tenant' | 'site')} className={cell}>
              <option value="tenant">Groupe entier</option>
              <option value="site">Un site</option>
            </select>
          </label>
        </div>
        {scopeType === 'site' && (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-fg-subtle">Site</span>
            <select value={scopeId} onChange={(e) => setScopeId(e.target.value)} className={cell}>
              <option value="">Choisir un site…</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </Modal>
  );
}
