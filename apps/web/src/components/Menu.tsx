import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A lightweight accessible dropdown. Renders a trigger; the panel opens on
 * click, closes on outside-click, Escape, or when an item calls the passed
 * `close`. Keeps focus handling simple — good enough for the operator console.
 */
export function Menu({
  trigger,
  children,
  align = 'left',
  panelClassName,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute top-[calc(100%+6px)] z-30 min-w-[220px] overflow-hidden rounded-[12px] border border-border bg-surface py-1.5 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
            panelClassName,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** A standard row inside a Menu panel. */
export function MenuItem({
  onClick,
  active,
  children,
  className,
}: {
  onClick?: () => void;
  active?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-fg hover:bg-surface-2',
        active && 'bg-primary-soft text-primary hover:bg-primary-soft',
        className,
      )}
    >
      {children}
    </button>
  );
}
