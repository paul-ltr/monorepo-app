import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { SupportTicketCategory, SupportTicketPriority } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { Button } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { cn } from '@/lib/cn';

const CATEGORIES: [SupportTicketCategory, string][] = [
  ['technical', 'Technique'],
  ['billing', 'Facturation'],
  ['account', 'Compte'],
  ['feature', 'Suggestion'],
  ['other', 'Autre'],
];

const PRIORITIES: [SupportTicketPriority, string][] = [
  ['low', 'Basse'],
  ['normal', 'Normale'],
  ['high', 'Haute'],
  ['urgent', 'Urgente'],
];

const field =
  'w-full rounded-[9px] border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary';

/**
 * Global floating support button ("dot" pinned to the right edge). Any user can
 * open it to file a ticket to the LavoPilot team — no AI, just a direct form
 * that posts to `createSupportTicket`. The staff triage side lives in the
 * back-office console (AdminConsole).
 */
export function SupportWidget() {
  const api = useApi();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<SupportTicketCategory>('technical');
  const [priority, setPriority] = useState<SupportTicketPriority>('normal');
  const [showErrors, setShowErrors] = useState(false);

  const send = useMutation({
    mutationFn: () => api.createSupportTicket({ subject, body, category, priority }),
  });

  const reset = () => {
    setSubject('');
    setBody('');
    setCategory('technical');
    setPriority('normal');
    setShowErrors(false);
    send.reset();
  };

  const close = () => {
    setOpen(false);
    if (send.isSuccess) reset();
  };

  const subjectOk = subject.trim().length >= 3;
  const bodyOk = body.trim().length > 0;
  const valid = subjectOk && bodyOk;

  const submit = () => {
    if (!valid) {
      setShowErrors(true);
      return;
    }
    send.mutate();
  };

  return (
    <>
      {/* Floating dot */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Contacter le support"
        title="Contacter le support"
        className={cn(
          'fixed right-5 bottom-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105',
          'bg-primary',
        )}
        style={{ boxShadow: '0 8px 24px rgba(27,77,179,.35)' }}
      >
        <Icon name={open ? 'close' : 'chat'} size={22} strokeWidth={2} />
        {!open && (
          <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-surface bg-ok" />
        )}
      </button>

      {/* Compose panel */}
      {open && (
        <div className="fixed right-5 bottom-24 z-40 w-[340px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-[14px] border border-border bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-3">
            <div className="flex items-center gap-2">
              <Icon name="chat" size={16} className="text-primary" />
              <span className="text-[13.5px] font-bold">Support LavoPilot</span>
            </div>
            <button onClick={close} aria-label="Fermer" className="text-fg-subtle hover:text-fg">
              <Icon name="close" size={17} />
            </button>
          </div>

          {send.isSuccess ? (
            <div className="flex flex-col items-center gap-2.5 px-5 py-8 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ok-soft text-ok">
                <Icon name="check" size={22} strokeWidth={2.4} />
              </span>
              <div className="text-[13.5px] font-semibold">Demande envoyée</div>
              <div className="text-[12px] text-fg-subtle">
                Ticket <span className="font-mono font-semibold">{send.data.ref}</span> créé. Notre équipe vous répond
                rapidement.
              </div>
              <Button variant="secondary" size="sm" className="mt-1" onClick={reset}>
                Nouvelle demande
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 p-4">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Objet de votre demande"
                className={cn(field, showErrors && !subjectOk && 'border-danger')}
                maxLength={160}
              />
              <div className="flex gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
                  className={cn(field, 'flex-1')}
                  aria-label="Catégorie"
                >
                  {CATEGORIES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as SupportTicketPriority)}
                  className={cn(field, 'flex-1')}
                  aria-label="Priorité"
                >
                  {PRIORITIES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Décrivez votre problème ou votre question…"
                rows={4}
                className={cn(field, 'resize-none', showErrors && !bodyOk && 'border-danger')}
                maxLength={5000}
              />
              {showErrors && !valid && (
                <div className="text-[12px] font-semibold text-danger">
                  Renseignez un objet (3 caractères min.) et un message avant l’envoi.
                </div>
              )}
              {send.isError && (
                <div className="text-[12px] font-semibold text-danger">
                  Échec de l'envoi — réessayez.
                </div>
              )}
              <Button
                variant="primary"
                icon="arrowRight"
                onClick={submit}
                disabled={send.isPending}
              >
                {send.isPending ? 'Envoi…' : 'Envoyer au support'}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
