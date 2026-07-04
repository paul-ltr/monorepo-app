import { useEffect, useRef, useState } from 'react';
import { searchAddress, type AddressHit } from '@/lib/address';
import { Icon } from './Icon';
import { cn } from '@/lib/cn';

/**
 * Address autocomplete backed by the French BAN (api-adresse.data.gouv.fr).
 * Debounced; suggestions close on outside click. `onSelect` receives the full
 * hit (postcode/city/coords) so callers can persist more than the label.
 */
export function AddressField({
  value,
  onChange,
  onSelect,
  placeholder = '12 rue des Lilas, 69003 Lyon',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (hit: AddressHit) => void;
  placeholder?: string;
  className?: string;
}) {
  const [hits, setHits] = useState<AddressHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  // Suppress the search that the programmatic value change from a selection
  // would otherwise trigger (which would immediately reopen the dropdown).
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    if (value.trim().length < 3) {
      setHits([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await searchAddress(value, ctrl.signal);
      setHits(r);
      setLoading(false);
      if (r.length) setOpen(true);
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <div className="relative">
        <Icon
          name="search"
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          placeholder={placeholder}
          className="h-[38px] w-full rounded-[9px] border border-border bg-surface pl-9 pr-3 text-[13px] outline-none focus:border-primary"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-border border-t-primary" />
        )}
      </div>
      {open && hits.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-[10px] border border-border bg-surface shadow-xl">
          {hits.map((h, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                skipNextSearch.current = true;
                onChange(h.label);
                onSelect?.(h);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-[12.5px] last:border-b-0 hover:bg-surface-2"
            >
              <Icon name="mapPin" size={13} className="shrink-0 text-fg-subtle" />
              <span className="truncate">{h.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
