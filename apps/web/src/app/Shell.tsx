import { useMemo, useState } from 'react';
import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Icon, type IconName } from '@/components/Icon';
import { Avatar } from '@/components/ui';
import { Menu, MenuItem } from '@/components/Menu';
import { FreshnessBadge } from '@/components/state';
import { useToast } from '@/components/Toast';
import { useApi } from '@/lib/api';
import { useSession, useBranding } from '@/lib/hooks';
import { SupportWidget } from '@/components/SupportWidget';
import { useScope } from '@/lib/scope';
import { cn } from '@/lib/cn';

interface NavItem {
  to: string;
  icon: IconName;
  label: string;
  dot?: boolean;
}

function useNav(): { main: NavItem[]; groups: { head: string; items: NavItem[] }[]; settings: NavItem } {
  const { t } = useTranslation();
  return {
    main: [{ to: '/', icon: 'dashboard', label: t('nav.overview') }],
    groups: [
      {
        head: t('nav.exploitation'),
        items: [
          { to: '/machines', icon: 'washer', label: t('nav.machines') },
          { to: '/revenue', icon: 'euro', label: t('nav.revenue') },
          { to: '/energy', icon: 'leaf', label: t('nav.energy'), dot: true },
          { to: '/maintenance', icon: 'wrench', label: t('nav.maintenance') },
          { to: '/pricing', icon: 'tag', label: t('nav.pricing') },
        ],
      },
      {
        head: t('nav.relation'),
        items: [
          { to: '/clients', icon: 'users', label: t('nav.clients') },
          { to: '/finances', icon: 'bank', label: t('nav.finances') },
          { to: '/reseau', icon: 'network', label: t('nav.reseau') },
        ],
      },
    ],
    settings: { to: '/settings', icon: 'gear', label: t('nav.settings') },
  };
}

function NavLink({ item }: { item: NavItem }) {
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.to === '/' }}
      className="mb-0.5 flex items-center gap-[11px] rounded-[9px] px-[11px] py-[9px] font-medium text-sidebar-fg transition-colors hover:bg-sidebar-active-bg"
      activeProps={{ className: 'bg-sidebar-active-bg font-semibold text-white' }}
    >
      <Icon name={item.icon} size={18} />
      <span className="flex-1">{item.label}</span>
      {item.dot && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-energy"
          style={{ boxShadow: '0 0 0 3px rgba(47,184,168,.18)' }}
        />
      )}
    </Link>
  );
}

function Sidebar({ orgName, superuser }: { orgName: string; superuser: boolean }) {
  const nav = useNav();
  return (
    <aside className="flex w-[248px] flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar-bg text-sidebar-fg">
      <div className="flex h-16 flex-shrink-0 items-center gap-[11px] border-b border-sidebar-border px-[18px]">
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px]"
          style={{ background: 'linear-gradient(135deg,#5B8DEF,#1B4DB3)' }}
        >
          <Icon name="logo" size={17} className="text-white" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-bold leading-[1.1] tracking-[-0.2px] text-white">Pilotage</div>
          <div className="truncate text-[10.5px] font-medium uppercase tracking-[0.3px] text-sidebar-muted">
            {orgName}
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2.5 pb-4 pt-3">
        {nav.main.map((item) => (
          <NavLink key={item.to} item={item} />
        ))}
        {nav.groups.map((g) => (
          <div key={g.head}>
            <div className="px-[11px] pb-1.5 pt-3.5 text-[10px] font-bold uppercase tracking-[0.7px] text-sidebar-head">
              {g.head}
            </div>
            {g.items.map((item) => (
              <NavLink key={item.to} item={item} />
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-2.5">
        {superuser && (
          <NavLink item={{ to: '/console', icon: 'shield', label: 'Back-office' }} />
        )}
        <NavLink item={nav.settings} />
      </div>
    </aside>
  );
}

function OrgSwitcher({ orgName, orgInitials }: { orgName: string; orgInitials: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  return (
    <Menu
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          className="flex h-[38px] items-center gap-[9px] rounded-[9px] border border-border bg-surface-2 px-3 text-fg hover:border-border-strong"
        >
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-primary-soft text-[11px] font-bold text-primary">
            {orgInitials}
          </span>
          <span className="max-w-[130px] truncate text-[13px] font-semibold">{orgName}</span>
          <Icon name="chevronDown" size={15} className="text-fg-subtle" strokeWidth={2} />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.5px] text-fg-subtle">
            Organisation
          </div>
          <MenuItem active onClick={close}>
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-primary-soft text-[11px] font-bold text-primary">
              {orgInitials}
            </span>
            <span className="flex-1">{orgName}</span>
            <Icon name="check" size={15} strokeWidth={2.4} />
          </MenuItem>
          <div className="my-1.5 border-t border-border" />
          <MenuItem
            onClick={() => {
              close();
              toast('Gestion multi-organisations — bientôt disponible.', 'info');
            }}
          >
            <Icon name="plus" size={15} className="text-fg-muted" />
            {t('topbar.switchOrg')}
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

function ScopeSelector() {
  const { t } = useTranslation();
  const { sites, scope, selectSite, reset } = useScope();
  const alerts: Record<string, number> = { 'Vénissieux Centre': 3, 'Villeurbanne Gratte-Ciel': 2, 'Paris-11 Voltaire': 1 };
  return (
    <Menu
      panelClassName="min-w-[280px]"
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          className="flex h-[38px] items-center gap-2 rounded-[9px] border border-border bg-surface px-3 text-fg hover:border-border-strong"
        >
          <Icon name="mapPin" size={15} className="text-fg-muted" />
          <span className="max-w-[160px] truncate text-[13px] font-semibold">
            {scope.type === 'all' ? t('topbar.allSites') : scope.name}
          </span>
          {scope.type === 'all' && <span className="text-[11px] tabular-nums text-fg-subtle">· {sites.length || 6}</span>}
          <Icon name="chevronDown" size={15} className="text-fg-subtle" strokeWidth={2} />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.5px] text-fg-subtle">
            Périmètre
          </div>
          <MenuItem
            active={scope.type === 'all'}
            onClick={() => {
              reset();
              close();
            }}
          >
            <Icon name="network" size={15} className="text-fg-muted" />
            <span className="flex-1">{t('topbar.allSites')}</span>
            <span className="text-[11px] tabular-nums text-fg-subtle">{sites.length || 6}</span>
          </MenuItem>
          <div className="my-1.5 border-t border-border" />
          <div className="max-h-[280px] overflow-y-auto">
            {sites.map((s) => {
              const a = alerts[s.name] ?? 0;
              return (
                <MenuItem
                  key={s.id}
                  active={scope.type === 'site' && scope.siteId === s.id}
                  onClick={() => {
                    selectSite(s.id);
                    close();
                  }}
                >
                  <span
                    className={cn('h-2 w-2 flex-shrink-0 rounded-full', a === 0 ? 'bg-ok' : a >= 3 ? 'bg-danger' : 'bg-warn')}
                  />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  {a > 0 && (
                    <span className="rounded-[6px] bg-danger-soft px-1.5 text-[10.5px] font-bold text-danger">{a}</span>
                  )}
                </MenuItem>
              );
            })}
          </div>
        </>
      )}
    </Menu>
  );
}

function GlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sites, selectSite } = useScope();
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return sites.filter((s) => s.name.toLowerCase().includes(needle) || (s.city ?? '').toLowerCase().includes(needle)).slice(0, 6);
  }, [q, sites]);

  const open = focused && q.trim().length > 0;

  return (
    <div className="relative mx-1.5 max-w-[360px] flex-1">
      <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" strokeWidth={1.9} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={t('topbar.search')}
        aria-label={t('topbar.search')}
        className="h-[38px] w-full rounded-[9px] border border-border bg-surface-2 pl-9 pr-3 text-[13px] text-fg outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-soft)]"
      />
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-[12px] border border-border bg-surface py-1.5 shadow-lg">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-[13px] text-fg-subtle">{t('topbar.noResults')}</div>
          ) : (
            results.map((s) => (
              <button
                key={s.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  selectSite(s.id);
                  setQ('');
                  navigate({ to: '/' });
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-fg hover:bg-surface-2"
              >
                <Icon name="mapPin" size={15} className="text-fg-muted" />
                <span className="flex-1">{s.name}</span>
                <span className="text-[11px] text-fg-subtle">{s.city}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Topbar({ orgName, orgInitials }: { orgName: string; orgInitials: string }) {
  const { t } = useTranslation();
  const api = useApi();
  const navigate = useNavigate();
  const notifs = useQuery({ queryKey: ['notifications'], queryFn: () => api.getNotifications() });
  const unread = notifs.data?.unreadCount ?? 0;
  // Shares the dashboard query cache; drives the "Mis à jour…" / stale badge.
  const dash = useQuery({ queryKey: ['dashboard', 'today'], queryFn: () => api.getDashboard('today') });

  return (
    <header className="z-[5] flex h-16 flex-shrink-0 items-center gap-2.5 border-b border-border bg-surface px-[22px]">
      <OrgSwitcher orgName={orgName} orgInitials={orgInitials} />
      <div className="h-6 w-px bg-border" />
      <ScopeSelector />
      <GlobalSearch />
      <div className="flex-1" />
      {dash.data && <FreshnessBadge freshness={dash.data.freshness} />}
      <button
        onClick={() => navigate({ to: '/notifications' })}
        title={t('topbar.notifications')}
        aria-label={t('topbar.notifications')}
        className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[9px] border border-border bg-surface hover:border-border-strong"
      >
        <Icon name="bell" size={18} className="text-fg-muted" />
        {unread > 0 && (
          <span className="absolute right-[7px] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-[8px] border-2 border-surface bg-danger px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      <Avatar initials="SD" />
    </header>
  );
}

/** Slim banner shown under the topbar when a single-site perimeter is active. */
function ScopeBanner() {
  const { t } = useTranslation();
  const { scope, reset } = useScope();
  if (scope.type === 'all') return null;
  return (
    <div className="flex items-center gap-2.5 border-b border-border bg-primary-soft px-7 py-2 text-[12.5px]">
      <Icon name="mapPin" size={15} className="text-primary" strokeWidth={2} />
      <span className="font-semibold text-primary">{t('topbar.scopeSite', { name: scope.name })}</span>
      <span className="flex-1" />
      <button onClick={reset} className="flex items-center gap-1 font-semibold text-primary hover:underline">
        <Icon name="network" size={14} strokeWidth={2} />
        {t('topbar.scopeReset')}
      </button>
    </div>
  );
}

export function Shell() {
  useBranding();
  const session = useSession();
  const orgName = session.data?.tenant.name ?? 'Groupe Lavéo';
  const orgInitials = orgName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={cn('flex h-screen overflow-hidden bg-bg text-fg')}>
      <Sidebar orgName={orgName} superuser={session.data?.superuser ?? false} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar orgName={orgName} orgInitials={orgInitials} />
        <ScopeBanner />
        <main className="relative flex-1 overflow-y-auto">
          <div className="max-w-content px-7 pb-10 pt-6">
            <Outlet />
          </div>
        </main>
      </div>
      <SupportWidget />
    </div>
  );
}
