import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';

/** Tone → soft background + colored foreground, used by pills and chips. */
export const TONE: Record<string, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  energy: 'bg-energy-soft text-energy',
  primary: 'bg-primary-soft text-primary',
  neutral: 'bg-surface-3 text-fg-subtle',
};
export type Tone = keyof typeof TONE;

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-[14px] border border-border bg-surface shadow-card', className)}>
      {children}
    </div>
  );
}

/** Card with a header row (title + optional subtitle + right-side action). */
export function SectionCard({
  title,
  subtitle,
  action,
  bodyClassName,
  className,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-[18px] pb-[13px] pt-[15px]">
          <div className="min-w-0">
            {title && <div className="text-[15px] font-bold">{title}</div>}
            {subtitle && <div className="mt-0.5 text-xs text-fg-subtle">{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </Card>
  );
}

const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 rounded-[9px] font-semibold font-[inherit] cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-fg border-none hover:bg-primary-strong',
        energy: 'bg-energy text-white border-none hover:brightness-95',
        secondary: 'border border-border bg-surface text-fg hover:border-border-strong',
        subtle: 'border border-border bg-surface-2 text-fg hover:border-border-strong',
        ghost: 'border-none bg-transparent text-primary hover:underline',
      },
      size: {
        sm: 'h-[34px] px-[13px] text-[12.5px]',
        md: 'h-[38px] px-[14px] text-[13px]',
        lg: 'h-10 px-4 text-[13px]',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  icon?: IconName;
}

export function Button({ className, variant, size, icon, children, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonStyles({ variant, size }), className)} {...props}>
      {icon && <Icon name={icon} size={15} />}
      {children}
    </button>
  );
}

export function Pill({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[7px] px-[9px] py-1 text-[11px] font-bold',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = 'info',
  className,
}: {
  value: number;
  tone?: 'info' | 'ok' | 'warn' | 'danger' | 'energy' | 'primary';
  className?: string;
}) {
  const color: Record<string, string> = {
    info: 'bg-info',
    ok: 'bg-ok',
    warn: 'bg-warn',
    danger: 'bg-danger',
    energy: 'bg-energy',
    primary: 'bg-primary',
  };
  return (
    <div className={cn('h-[5px] overflow-hidden rounded-[3px] bg-surface-3', className)}>
      <div
        className={cn('h-full rounded-[3px]', color[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/** Page header: breadcrumb + title + right-aligned actions (matches the design). */
export function ScreenHeader({
  crumbs,
  title,
  actions,
}: {
  crumbs: ReactNode[];
  title: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-5">
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-fg-subtle">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <Icon name="chevronRight" size={13} strokeWidth={2.2} />}
              <span className={i === crumbs.length - 1 ? 'font-semibold text-fg-muted' : ''}>
                {c}
              </span>
            </span>
          ))}
        </div>
        <h1 className="m-0 text-2xl font-bold tracking-[-0.5px]">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function Avatar({ initials, size = 34 }: { initials: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: 'linear-gradient(135deg,#5B8DEF,#1B4DB3)',
      }}
    >
      {initials}
    </div>
  );
}

/** KPI stat card (label + big value + optional footer). */
export function StatCard({
  label,
  icon,
  iconClass,
  value,
  footer,
  className,
}: {
  label: ReactNode;
  icon?: IconName;
  iconClass?: string;
  value: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('flex-1 p-4', className)}>
      <div className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold text-fg-muted">
        {icon && <Icon name={icon} size={15} className={iconClass} strokeWidth={1.9} />}
        {label}
      </div>
      <div className="text-[26px] font-bold tracking-[-0.5px] tabular-nums">{value}</div>
      {footer && <div className="mt-2 text-[11.5px] text-fg-subtle">{footer}</div>}
    </Card>
  );
}

/**
 * The single segmented control used everywhere (period pickers, kind filters,
 * mode switches). Replaces the ad-hoc pill groups that had drifted apart in
 * size/radius across screens. Generic over the option value type.
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: IconName;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
}) {
  const item = size === 'sm' ? 'h-[28px] px-2.5 text-[11.5px]' : 'h-[32px] px-[13px] text-[12.5px]';
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex w-fit items-center gap-0.5 rounded-[10px] border border-border bg-surface p-[3px]',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[7px] font-semibold transition-colors',
              item,
              active ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {o.icon && <Icon name={o.icon} size={14} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Accessible on/off switch (role="switch"). Optional trailing label. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={typeof label === 'string' ? label : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex items-center gap-2.5 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <span
        className={cn(
          'relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border transition-colors',
          checked ? 'border-primary bg-primary' : 'border-border bg-surface-3',
        )}
      >
        <span
          className={cn(
            'inline-block h-[16px] w-[16px] rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-[19px]' : 'translate-x-[2px]',
          )}
        />
      </span>
      {label && <span className="text-[13px] font-medium text-fg">{label}</span>}
    </button>
  );
}

/** Portal dialog: backdrop, ESC-to-close, body scroll lock, optional footer. */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: IconName;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = size === 'sm' ? 'max-w-[440px]' : size === 'lg' ? 'max-w-[780px]' : 'max-w-[580px]';
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-[6vh]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'w-full overflow-hidden rounded-[16px] border border-border bg-surface shadow-2xl',
          width,
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {(title || icon) && (
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex min-w-0 items-start gap-2.5">
              {icon && (
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-primary-soft text-primary">
                  <Icon name={icon} size={17} />
                </span>
              )}
              <div className="min-w-0">
                {title && <div className="text-[15px] font-bold">{title}</div>}
                {subtitle && <div className="mt-0.5 text-xs text-fg-subtle">{subtitle}</div>}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="shrink-0 text-fg-subtle hover:text-fg"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2.5 border-t border-border bg-surface-2 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Small "?" info affordance: click to reveal an explanatory popover. */
export function InfoButton({ label, className }: { label: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <span ref={ref} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-label="Plus d’informations"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg"
      >
        <Icon name="info" size={14} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-[24px] z-30 w-[240px] -translate-x-1/2 rounded-[10px] border border-border bg-surface p-3 text-[11.5px] font-medium leading-relaxed text-fg-muted shadow-xl"
        >
          {label}
        </span>
      )}
    </span>
  );
}
