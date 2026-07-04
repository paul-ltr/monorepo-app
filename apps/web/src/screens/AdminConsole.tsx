import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AccountRole,
  AccountStatus,
  AccountUser,
  GroupStatus,
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useSession } from '@/lib/hooks';
import { Button, Card, Pill, ScreenHeader, StatCard, type Tone } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { QueryBoundary, EmptyState } from '@/components/state';
import { num, relativeTime } from '@/lib/format';
import { cn } from '@/lib/cn';

type Tab = 'tickets' | 'groups' | 'accounts';

const TICKET_STATUS: Record<SupportTicketStatus, { label: string; tone: Tone }> = {
  open: { label: 'Ouvert', tone: 'info' },
  pending: { label: 'En attente', tone: 'warn' },
  resolved: { label: 'Résolu', tone: 'ok' },
  closed: { label: 'Fermé', tone: 'neutral' },
};
const PRIORITY: Record<SupportTicketPriority, { label: string; tone: Tone }> = {
  urgent: { label: 'Urgent', tone: 'danger' },
  high: { label: 'Haute', tone: 'warn' },
  normal: { label: 'Normale', tone: 'neutral' },
  low: { label: 'Basse', tone: 'neutral' },
};
const ACCOUNT_STATUS: Record<AccountStatus, { label: string; tone: Tone }> = {
  active: { label: 'Actif', tone: 'ok' },
  invited: { label: 'Invité', tone: 'info' },
  suspended: { label: 'Suspendu', tone: 'danger' },
};
const GROUP_STATUS: Record<GroupStatus, { label: string; tone: Tone }> = {
  active: { label: 'Actif', tone: 'ok' },
  trial: { label: 'Essai', tone: 'info' },
  past_due: { label: 'Impayé', tone: 'warn' },
  suspended: { label: 'Suspendu', tone: 'danger' },
};
const ROLES: AccountRole[] = ['owner', 'manager', 'accountant', 'technician', 'viewer'];

export function AdminConsole() {
  const session = useSession();
  const [tab, setTab] = useState<Tab>('tickets');

  // Route guard: the nav link is hidden for non-staff, but the /console URL is
  // reachable directly — gate here so the console (and its queries) never render
  // for a non-superuser, in mock mode as well as against the API.
  if (session.isLoading) return null;
  if (!session.data?.superuser) return <NotAuthorized />;

  return (
    <>
      <ScreenHeader
        crumbs={[<span className="text-primary">LavoPilot · Back-office</span>, 'Console superviseur']}
        title="Console d'administration"
      />

      <div className="mb-[18px] inline-flex rounded-[10px] border border-border bg-surface-2 p-[3px]">
        {(
          [
            ['tickets', 'Tickets', 'chat'],
            ['groups', 'Groupes', 'bank'],
            ['accounts', 'Comptes', 'users'],
          ] as [Tab, string, 'chat' | 'bank' | 'users'][]
        ).map(([k, label, icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              'flex h-[34px] items-center gap-2 rounded-[8px] px-[14px] text-[13px] font-semibold',
              tab === k ? 'bg-surface text-fg shadow-card' : 'text-fg-muted hover:text-fg',
            )}
          >
            <Icon name={icon} size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'tickets' && <TicketsTab />}
      {tab === 'groups' && <GroupsTab />}
      {tab === 'accounts' && <AccountsTab />}
    </>
  );
}

function NotAuthorized() {
  return (
    <>
      <ScreenHeader crumbs={['LavoPilot']} title="Accès réservé" />
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
          <Icon name="shield" size={24} />
        </span>
        <div className="text-[15px] font-bold">Console réservée à l'équipe LavoPilot</div>
        <div className="text-[13px] text-fg-subtle">
          Vous n'avez pas les droits pour accéder au back-office.
        </div>
      </Card>
    </>
  );
}

// ──────────────────────────────── Tickets ──────────────────────────────────

function TicketsTab() {
  const api = useApi();
  const query = useQuery({ queryKey: ['console', 'tickets'], queryFn: () => api.getSupportTickets() });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <QueryBoundary query={query}>
      {(tickets) => {
        const selected = tickets.find((t) => t.id === selectedId) ?? tickets[0] ?? null;
        const openCount = tickets.filter((t) => t.status === 'open').length;
        const urgentCount = tickets.filter((t) => t.priority === 'urgent' && t.status !== 'closed').length;
        return (
          <>
            <div className="mb-[18px] flex flex-wrap gap-3.5">
              <StatCard label="Tickets ouverts" icon="chat" iconClass="text-info" value={openCount} />
              <StatCard label="Urgents actifs" icon="alert" iconClass="text-danger" value={urgentCount} />
              <StatCard label="Total" icon="filter" iconClass="text-fg-muted" value={tickets.length} />
            </div>
            <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[minmax(320px,1fr)_1.4fr]">
              <Card className="overflow-hidden">
                {tickets.length === 0 ? (
                  <EmptyState message="Aucun ticket" />
                ) : (
                  tickets.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={cn(
                        'flex w-full flex-col gap-1.5 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-surface-2',
                        selected?.id === t.id && 'bg-surface-2',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-fg-subtle">{t.ref}</span>
                        <Pill tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Pill>
                        <span className="flex-1" />
                        <Pill tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Pill>
                      </div>
                      <div className="truncate text-[13px] font-semibold">{t.subject}</div>
                      <div className="flex items-center gap-1.5 text-[11.5px] text-fg-subtle">
                        <Icon name="bank" size={12} />
                        {t.groupName} · {t.requesterName} · {relativeTime(t.updatedAt)}
                      </div>
                    </button>
                  ))
                )}
              </Card>
              {selected ? <TicketDetail ticket={selected} /> : <EmptyState message="Sélectionnez un ticket" />}
            </div>
          </>
        );
      }}
    </QueryBoundary>
  );
}

function TicketDetail({ ticket }: { ticket: SupportTicket }) {
  const api = useApi();
  const qc = useQueryClient();
  const [reply, setReply] = useState('');

  const send = useMutation({
    mutationFn: (vars: { body?: string; status?: SupportTicketStatus }) =>
      api.replySupportTicket({ ticketId: ticket.id, ...vars }),
    onSuccess: () => {
      setReply('');
      qc.invalidateQueries({ queryKey: ['console', 'tickets'] });
    },
  });

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-[18px] py-3.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-fg-subtle">{ticket.ref}</span>
          <Pill tone={PRIORITY[ticket.priority].tone}>{PRIORITY[ticket.priority].label}</Pill>
          <Pill tone={TICKET_STATUS[ticket.status].tone}>{TICKET_STATUS[ticket.status].label}</Pill>
        </div>
        <div className="mt-1.5 text-[15px] font-bold">{ticket.subject}</div>
        <div className="mt-0.5 text-[12px] text-fg-subtle">
          {ticket.groupName} · {ticket.requesterName} &lt;{ticket.requesterEmail}&gt;
        </div>
      </div>

      <div className="flex max-h-[360px] flex-col gap-3 overflow-y-auto p-[18px]">
        {ticket.messages.map((m) => {
          const staff = m.authorRole === 'staff';
          return (
            <div key={m.id} className={cn('flex flex-col gap-1', staff ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-[11px] px-3.5 py-2.5 text-[12.5px] leading-[1.5]',
                  staff ? 'bg-primary text-primary-fg' : 'border border-border bg-surface-2',
                )}
              >
                {m.body}
              </div>
              <span className="text-[10.5px] text-fg-subtle">
                {m.authorName} · {relativeTime(m.at)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-border p-[18px]">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Répondre au client…"
          rows={3}
          className="w-full resize-none rounded-[9px] border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            icon="arrowRight"
            onClick={() => send.mutate({ body: reply })}
            disabled={!reply.trim() || send.isPending}
          >
            Répondre
          </Button>
          <Button
            variant="secondary"
            onClick={() => send.mutate({ body: reply, status: 'resolved' })}
            disabled={!reply.trim() || send.isPending}
          >
            Répondre & résoudre
          </Button>
          <span className="flex-1" />
          <Button
            variant="subtle"
            size="sm"
            onClick={() => send.mutate({ status: ticket.status === 'closed' ? 'open' : 'closed' })}
            disabled={send.isPending}
          >
            {ticket.status === 'closed' ? 'Rouvrir' : 'Clôturer'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ──────────────────────────────── Groups ───────────────────────────────────

function GroupsTab() {
  const api = useApi();
  const query = useQuery({ queryKey: ['console', 'groups'], queryFn: () => api.getTenantGroups() });

  return (
    <QueryBoundary query={query}>
      {(groups) => {
        const mrr = groups.filter((g) => g.status !== 'suspended').reduce((s, g) => s + g.mrrCents, 0);
        return (
          <>
            <div className="mb-[18px] flex flex-wrap gap-3.5">
              <StatCard label="Groupes" icon="bank" iconClass="text-primary" value={groups.length} />
              <StatCard
                label="MRR total"
                icon="euro"
                iconClass="text-ok"
                value={`${num(Math.round(mrr / 100))} €`}
                footer="Revenu mensuel récurrent"
              />
              <StatCard
                label="Sites gérés"
                icon="network"
                iconClass="text-info"
                value={groups.reduce((s, g) => s + g.sitesCount, 0)}
              />
            </div>
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.4px] text-fg-subtle">
                    <th className="px-[18px] py-2.5 font-bold">Groupe</th>
                    <th className="px-3 py-2.5 font-bold">Offre</th>
                    <th className="px-3 py-2.5 font-bold">Statut</th>
                    <th className="px-3 py-2.5 text-right font-bold">Sites</th>
                    <th className="px-3 py-2.5 text-right font-bold">Utilisateurs</th>
                    <th className="px-3 py-2.5 text-right font-bold">MRR</th>
                    <th className="px-[18px] py-2.5 font-bold">Depuis</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.id} className="border-b border-border last:border-b-0 hover:bg-surface-2">
                      <td className="px-[18px] py-3">
                        <div className="font-semibold">{g.name}</div>
                        <div className="text-[11.5px] text-fg-subtle">{g.ownerEmail}</div>
                      </td>
                      <td className="px-3 py-3 capitalize text-fg-muted">{g.plan}</td>
                      <td className="px-3 py-3">
                        <Pill tone={GROUP_STATUS[g.status].tone}>{GROUP_STATUS[g.status].label}</Pill>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{g.sitesCount}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{g.usersCount}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {num(Math.round(g.mrrCents / 100))} €
                      </td>
                      <td className="px-[18px] py-3 text-[12px] text-fg-subtle">
                        {new Date(g.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        );
      }}
    </QueryBoundary>
  );
}

// ─────────────────────────────── Accounts ──────────────────────────────────

function AccountsTab() {
  const api = useApi();
  const groupsQuery = useQuery({ queryKey: ['console', 'groups'], queryFn: () => api.getTenantGroups() });
  const query = useQuery({ queryKey: ['console', 'accounts'], queryFn: () => api.getAccounts() });

  return (
    <QueryBoundary query={query}>
      {(accounts) => (
        <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.5fr_1fr]">
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.4px] text-fg-subtle">
                  <th className="px-[18px] py-2.5 font-bold">Utilisateur</th>
                  <th className="px-3 py-2.5 font-bold">Groupe</th>
                  <th className="px-3 py-2.5 font-bold">Rôle</th>
                  <th className="px-3 py-2.5 font-bold">Statut</th>
                  <th className="px-[18px] py-2.5 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <AccountRow key={a.id} account={a} />
                ))}
              </tbody>
            </table>
          </Card>
          <CreateAccountCard groups={groupsQuery.data ?? []} />
        </div>
      )}
    </QueryBoundary>
  );
}

function AccountRow({ account }: { account: AccountUser }) {
  const api = useApi();
  const qc = useQueryClient();
  const update = useMutation({
    mutationFn: (patch: { role?: AccountRole; status?: AccountStatus }) =>
      api.updateAccount({ id: account.id, ...patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['console', 'accounts'] }),
  });
  const suspended = account.status === 'suspended';

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-surface-2">
      <td className="px-[18px] py-3">
        <div className="font-semibold">{account.fullName}</div>
        <div className="text-[11.5px] text-fg-subtle">{account.email}</div>
      </td>
      <td className="px-3 py-3 text-fg-muted">{account.groupName}</td>
      <td className="px-3 py-3">
        <select
          value={account.role}
          onChange={(e) => update.mutate({ role: e.target.value as AccountRole })}
          disabled={update.isPending}
          className="rounded-[7px] border border-border bg-surface px-2 py-1 text-[12px] capitalize outline-none focus:border-primary"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3">
        <Pill tone={ACCOUNT_STATUS[account.status].tone}>{ACCOUNT_STATUS[account.status].label}</Pill>
      </td>
      <td className="px-[18px] py-3">
        <Button
          variant="subtle"
          size="sm"
          onClick={() => update.mutate({ status: suspended ? 'active' : 'suspended' })}
          disabled={update.isPending}
        >
          {suspended ? 'Réactiver' : 'Suspendre'}
        </Button>
      </td>
    </tr>
  );
}

function CreateAccountCard({ groups }: { groups: { id: string; name: string }[] }) {
  const api = useApi();
  const qc = useQueryClient();
  const [groupId, setGroupId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AccountRole>('viewer');

  const create = useMutation({
    mutationFn: () => api.createAccount({ groupId, fullName, email, role }),
    onSuccess: () => {
      setFullName('');
      setEmail('');
      qc.invalidateQueries({ queryKey: ['console', 'accounts'] });
      qc.invalidateQueries({ queryKey: ['console', 'groups'] });
    },
  });

  const field =
    'w-full rounded-[9px] border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary';
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const valid = groupId && fullName.trim().length >= 2 && emailOk;

  return (
    <Card className="p-[18px]">
      <div className="mb-1 flex items-center gap-2 text-[15px] font-bold">
        <Icon name="plus" size={16} className="text-primary" strokeWidth={2.2} />
        Créer un compte
      </div>
      <div className="mb-3.5 text-[12px] text-fg-subtle">Invitez un utilisateur dans un groupe client.</div>
      <div className="flex flex-col gap-2.5">
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={field} aria-label="Groupe">
          <option value="">Choisir un groupe…</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nom complet" className={field} />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@groupe.fr"
          type="email"
          className={field}
        />
        <select value={role} onChange={(e) => setRole(e.target.value as AccountRole)} className={field} aria-label="Rôle">
          {ROLES.map((r) => (
            <option key={r} value={r} className="capitalize">
              {r}
            </option>
          ))}
        </select>
        {create.isSuccess && (
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ok">
            <Icon name="check" size={14} strokeWidth={2.4} />
            Invitation envoyée à {create.data.email}
          </div>
        )}
        <Button variant="primary" onClick={() => create.mutate()} disabled={!valid || create.isPending}>
          {create.isPending ? 'Création…' : "Envoyer l'invitation"}
        </Button>
      </div>
    </Card>
  );
}
