import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
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

/**
 * Small "ⓘ" affordance that reveals a short explanation on click. Used on KPI
 * cards to explain what a figure means and how it's computed. Stops click
 * propagation so it works inside clickable cards/rows.
 */
export function InfoDot({
  title,
  align = 'right',
  className,
  children,
}: {
  title: string;
  align?: 'left' | 'right';
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-label={`À propos : ${title}`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg-muted"
      >
        <Icon name="info" size={14} strokeWidth={1.9} />
      </button>
      {open && (
        <>
          {/* click-away backdrop */}
          <span
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <span
            role="tooltip"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'absolute top-[24px] z-50 block w-[248px] cursor-default rounded-[10px] border border-border bg-surface p-3 text-left shadow-lg',
              align === 'right' ? 'right-0' : 'left-0',
            )}
          >
            <span className="mb-1 block text-[12.5px] font-bold text-fg">{title}</span>
            <span className="block text-[11.5px] font-normal leading-[1.5] text-fg-muted">{children}</span>
          </span>
        </>
      )}
    </span>
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
