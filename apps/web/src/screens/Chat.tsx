import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { ChatCard, ChatScope } from '@pilotage/shared';
import { useApi } from '@/lib/api';
import { useScope } from '@/lib/scope';
import { useSession } from '@/lib/hooks';
import { Icon } from '@/components/Icon';
import { LavoPilot } from '@/components/LavoPilot';
import { ConnectPilot } from '@/components/ConnectPilot';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  card?: ChatCard | null;
  usedTools?: string[];
  suggestions?: string[];
  connected?: boolean;
}

const uid = () => Math.random().toString(36).slice(2);

const OPENERS = [
  'Comment vont mes recettes aujourd’hui ?',
  'Analyse ma consommation d’énergie',
  'Ai-je des machines en panne ?',
  'Connecter un compteur',
];

export function Chat() {
  const api = useApi();
  const { scope, isAll, label } = useScope();
  const session = useSession();
  const firstName = (session.data?.user.fullName ?? '').split(' ')[0] || '';
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatScope: ChatScope = useMemo(
    () =>
      scope.type === 'site'
        ? { type: 'site', siteId: scope.siteId, name: scope.name }
        : { type: 'all' },
    [scope],
  );

  const send = useMutation({
    mutationFn: (history: Msg[]) =>
      api.agentChat({
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        scope: chatScope,
      }),
    onSuccess: (res) =>
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: res.message,
          card: res.card,
          usedTools: res.usedTools,
          suggestions: res.suggestions,
        },
      ]),
    onError: () =>
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: 'Oups, je n’ai pas pu traiter votre demande. Réessayez ?',
        },
      ]),
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (el && typeof el.scrollTo === 'function')
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, send.isPending]);

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || send.isPending) return;
    const userMsg: Msg = { id: uid(), role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    send.mutate(next);
  };

  const empty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-160px)] flex-col">
      {/* Context ribbon */}
      <div className="mb-3 flex flex-shrink-0 items-center gap-2 text-[12.5px]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 font-semibold">
          <Icon
            name={isAll ? 'network' : 'mapPin'}
            size={14}
            className="text-primary"
            strokeWidth={2}
          />
          {isAll ? 'Franchise · tous les sites' : label}
        </span>
        <span className="text-fg-subtle">LavoPilot répond selon ce périmètre.</span>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1">
        {empty ? (
          <EmptyState firstName={firstName} isAll={isAll} label={label} onPick={ask} />
        ) : (
          <div className="mx-auto flex max-w-[760px] flex-col gap-5 py-2">
            {messages.map((m) => (
              <MessageRow
                key={m.id}
                msg={m}
                onPick={ask}
                onConnected={() => markConnected(setMessages, m.id)}
              />
            ))}
            {send.isPending && <TypingRow />}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="mt-3 flex-shrink-0">
        <div className="mx-auto max-w-[760px]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex items-end gap-2 rounded-[16px] border border-border bg-surface p-2 shadow-card focus-within:border-primary"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              rows={1}
              placeholder="Demandez à LavoPilot… (recettes, énergie, machines, connecter une source)"
              className="max-h-[140px] min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2 text-[14px] text-fg outline-none placeholder:text-fg-subtle"
            />
            <button
              type="submit"
              disabled={!input.trim() || send.isPending}
              aria-label="Envoyer"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] bg-primary text-primary-fg transition-colors hover:bg-primary-strong disabled:opacity-40"
            >
              <Icon name="arrowRight" size={18} strokeWidth={2.2} />
            </button>
          </form>
          <p className="mt-1.5 text-center text-[10.5px] text-fg-subtle">
            LavoPilot peut consulter vos données de recettes, d’énergie et de maintenance pour vous
            répondre.
          </p>
        </div>
      </div>
    </div>
  );
}

function markConnected(setMessages: React.Dispatch<React.SetStateAction<Msg[]>>, id: string) {
  setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, connected: true } : m)));
}

function EmptyState({
  firstName,
  isAll,
  label,
  onPick,
}: {
  firstName: string;
  isAll: boolean;
  label: string;
  onPick: (t: string) => void;
}) {
  return (
    <div className="mx-auto flex max-w-[620px] flex-col items-center py-8 text-center">
      <LavoPilot size={128} mood="wave" className="animate-lp-bounce" />
      <h1 className="mt-3 text-[26px] font-bold tracking-[-0.5px]">
        Bonjour{firstName ? ` ${firstName}` : ''}, je suis{' '}
        <span className="text-primary">LavoPilot</span>
      </h1>
      <p className="mt-1.5 max-w-[440px] text-[14px] leading-relaxed text-fg-muted">
        Votre copilote de laverie. Posez-moi une question sur {isAll ? 'toute la franchise' : label}
        , ou connectez une nouvelle source de données — je m’occupe du reste.
      </p>
      <div className="mt-6 flex w-full flex-wrap justify-center gap-2">
        {OPENERS.map((o) => (
          <button
            key={o}
            onClick={() => onPick(o)}
            className="rounded-full border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-fg transition-colors hover:border-primary hover:text-primary"
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageRow({
  msg,
  onPick,
  onConnected,
}: {
  msg: Msg;
  onPick: (t: string) => void;
  onConnected: () => void;
}) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-[16px] rounded-br-[4px] bg-primary px-3.5 py-2.5 text-[14px] leading-relaxed text-primary-fg">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-2">
        <LavoPilot size={34} mood="happy" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="whitespace-pre-wrap rounded-[16px] rounded-tl-[4px] border border-border bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed text-fg">
          {renderRich(msg.content)}
        </div>
        {msg.card?.kind === 'connect' && !msg.connected && (
          <div className="mt-2.5 max-w-[420px]">
            <ConnectPilot provider={msg.card.provider} onConnected={onConnected} />
          </div>
        )}
        {msg.usedTools && msg.usedTools.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-fg-subtle">
            <Icon name="sparkles" size={12} />
            Consulté : {msg.usedTools.join(', ')}
          </div>
        )}
        {msg.suggestions && msg.suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {msg.suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onPick(s)}
                className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11.5px] font-medium text-fg-muted transition-colors hover:border-primary hover:text-primary"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingRow() {
  return (
    <div className="flex gap-2.5">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-2">
        <LavoPilot size={34} mood="thinking" />
      </div>
      <div className="flex items-center gap-1 rounded-[16px] rounded-tl-[4px] border border-border bg-surface px-4 py-3.5">
        <Dot delay="0s" />
        <Dot delay="0.2s" />
        <Dot delay="0.4s" />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 rounded-full bg-fg-muted animate-lp-dots"
      style={{ animationDelay: delay }}
    />
  );
}

/** Lightweight **bold** rendering so the assistant can emphasise figures. */
function renderRich(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <strong key={i} className="font-semibold">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}
