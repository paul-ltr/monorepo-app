import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Icon, type IconName } from '@/components/Icon';
import { Avatar } from '@/components/ui';
import { useApi } from '@/lib/api';
import { useSession, useBranding } from '@/lib/hooks';
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

function Sidebar({ orgName }: { orgName: string }) {
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
        <NavLink item={nav.settings} />
      </div>
    </aside>
  );
}

function Topbar({ orgName, orgInitials }: { orgName: string; orgInitials: string }) {
  const { t } = useTranslation();
  const api = useApi();
  const navigate = useNavigate();
  const notifs = useQuery({ queryKey: ['notifications'], queryFn: () => api.getNotifications() });
  const unread = notifs.data?.unreadCount ?? 0;

  return (
    <header className="z-[5] flex h-16 flex-shrink-0 items-center gap-2.5 border-b border-border bg-surface px-[22px]">
      <button className="flex h-[38px] items-center gap-[9px] rounded-[9px] border border-border bg-surface-2 px-3 text-fg hover:border-border-strong">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-primary-soft text-[11px] font-bold text-primary">
          {orgInitials}
        </span>
        <span className="max-w-[130px] truncate text-[13px] font-semibold">{orgName}</span>
        <Icon name="chevronDown" size={15} className="text-fg-subtle" strokeWidth={2} />
      </button>
      <div className="h-6 w-px bg-border" />
      <button className="flex h-[38px] items-center gap-2 rounded-[9px] border border-border bg-surface px-3 text-fg hover:border-border-strong">
        <Icon name="mapPin" size={15} className="text-fg-muted" />
        <span className="text-[13px] font-semibold">{t('topbar.allSites')}</span>
        <span className="text-[11px] tabular-nums text-fg-subtle">· 6</span>
        <Icon name="chevronDown" size={15} className="text-fg-subtle" strokeWidth={2} />
      </button>
      <div className="relative mx-1.5 max-w-[360px] flex-1">
        <Icon
          name="search"
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
          strokeWidth={1.9}
        />
        <input
          placeholder={t('topbar.search')}
          aria-label={t('topbar.search')}
          className="h-[38px] w-full rounded-[9px] border border-border bg-surface-2 pl-9 pr-3 text-[13px] text-fg outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-soft)]"
        />
      </div>
      <div className="flex-1" />
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
      <Sidebar orgName={orgName} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar orgName={orgName} orgInitials={orgInitials} />
        <main className="relative flex-1 overflow-y-auto">
          <div className="max-w-content px-7 pb-10 pt-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
