import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import { cn } from '@/lib/cn';

export type SortDir = 'asc' | 'desc';

/**
 * Headless table controls: client-side search, single-column sort and
 * pagination over an in-memory row list. Screens render their own cells and
 * feed the returned `view`; the small `SearchInput`, `SortHeader` and
 * `Pagination` components below cover the shared chrome.
 */
export function useTableControls<T>(
  rows: T[],
  opts: {
    /** Concatenated searchable text for a row (matched case-insensitively). */
    search: (row: T) => string;
    /** Per-column sort key → value extractor. */
    sorters?: Record<string, (row: T) => string | number>;
    initialSort?: { key: string; dir: SortDir };
    pageSize?: number;
  },
) {
  const pageSize = opts.pageSize ?? 10;
  const [query, setQueryRaw] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(opts.initialSort ?? null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => opts.search(r).toLowerCase().includes(q)) : rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query]);

  const sorted = useMemo(() => {
    if (!sort || !opts.sorters?.[sort.key]) return filtered;
    const get = opts.sorters[sort.key]!;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return c * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const view = sorted.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize);

  return {
    view,
    total: sorted.length,
    query,
    setQuery: (q: string) => {
      setQueryRaw(q);
      setPage(0);
    },
    sort,
    toggleSort: (key: string) =>
      setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })),
    page: clampedPage,
    setPage,
    pageCount,
    pageSize,
  };
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Rechercher…',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Icon
        name="search"
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[34px] w-full rounded-[9px] border border-border bg-surface pl-9 pr-3 text-[12.5px] outline-none focus:border-primary"
      />
    </div>
  );
}

/** Clickable column header that toggles sort direction on the given key. */
export function SortHeader({
  label,
  sortKey,
  sort,
  onToggle,
  className,
}: {
  label: string;
  sortKey: string;
  sort: { key: string; dir: SortDir } | null;
  onToggle: (key: string) => void;
  className?: string;
}) {
  const active = sort?.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      className={cn(
        'inline-flex items-center gap-1 text-left text-[10.5px] font-bold uppercase tracking-[0.4px] text-fg-subtle hover:text-fg-muted',
        className,
      )}
    >
      {label}
      <Icon
        name="chevronDown"
        size={12}
        className={cn(
          'transition-transform',
          active ? 'text-primary' : 'text-fg-subtle/40',
          active && sort!.dir === 'asc' && 'rotate-180',
        )}
      />
    </button>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-[18px] py-2.5 text-[11.5px] text-fg-subtle">
      <span>
        {total} élément{total > 1 ? 's' : ''} · page {page + 1}/{pageCount}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
          className="flex h-[28px] items-center gap-1 rounded-[8px] border border-border px-2.5 font-semibold text-fg disabled:opacity-40"
        >
          <Icon name="chevronRight" size={14} className="rotate-180" /> Précédent
        </button>
        <button
          type="button"
          disabled={page >= pageCount - 1}
          onClick={() => onPage(page + 1)}
          className="flex h-[28px] items-center gap-1 rounded-[8px] border border-border px-2.5 font-semibold text-fg disabled:opacity-40"
        >
          Suivant <Icon name="chevronRight" size={14} />
        </button>
      </div>
    </div>
  );
}
