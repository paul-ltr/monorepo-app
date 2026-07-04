import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { cn } from '@/lib/cn';

type ToastTone = 'ok' | 'info' | 'warn' | 'danger';
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

const TONE: Record<ToastTone, { icon: IconName; bar: string; fg: string }> = {
  ok: { icon: 'check', bar: 'bg-ok', fg: 'text-ok' },
  info: { icon: 'info', bar: 'bg-info', fg: 'text-info' },
  warn: { icon: 'alert', bar: 'bg-warn', fg: 'text-warn' },
  danger: { icon: 'alert', bar: 'bg-danger', fg: 'text-danger' },
};

interface ToastCtx {
  toast: (message: string, tone?: ToastTone) => void;
}
const ToastContext = createContext<ToastCtx>({ toast: () => {} });

/** Fire a transient confirmation toast. */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, tone: ToastTone = 'ok') => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, tone, message }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 3600);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[340px] max-w-[calc(100vw-40px)] flex-col gap-2.5"
        role="status"
        aria-live="polite"
      >
        {toasts.map((tst) => {
          const tone = TONE[tst.tone];
          return (
            <div
              key={tst.id}
              className="pointer-events-auto relative flex animate-pl-slide items-start gap-3 overflow-hidden rounded-[12px] border border-border bg-surface p-[13px_15px] shadow-lg"
            >
              <span className={cn('absolute bottom-0 left-0 top-0 w-1', tone.bar)} />
              <span className={cn('flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center', tone.fg)}>
                <Icon name={tone.icon} size={18} strokeWidth={2} />
              </span>
              <div className="flex-1 pt-px text-[13px] font-medium leading-[1.4]">{tst.message}</div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
