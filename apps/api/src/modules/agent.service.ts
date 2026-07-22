import { Injectable } from '@nestjs/common';
import {
  type AgentChatInput,
  type AgentChatResult,
  type AgentMemory,
  type ChatCard,
  type RequestContext,
  type UpdateMemoryInput,
  type UploadDocumentInput,
  type UserDocument,
} from '@pilotage/shared';
import { ReadService } from './read.service';
import { LlmService, type LlmMessage } from '@/llm/llm.service';

const euro = (cents: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);

/**
 * Agentic LavoPilot backend. The whole read API is exposed to the agent as
 * "tools": for a MVP we gather the scope-relevant KPIs up-front and hand them to
 * the LLM as grounding context (a swappable design — a tool-calling loop over
 * ReadService can replace the eager gather later). When no Mistral key is
 * configured the service falls back to a deterministic, data-backed reply that
 * mirrors the offline mock client, so chat always works.
 *
 * Per-user memory and document context are kept in-memory here (best-effort);
 * persisting them to `core` / the data repo's per-user store is a follow-up.
 */
@Injectable()
export class AgentService {
  private readonly memory = new Map<string, AgentMemory>();
  private readonly documents = new Map<string, UserDocument[]>();

  constructor(
    private readonly read: ReadService,
    private readonly llm: LlmService,
  ) {}

  // ── Memory ─────────────────────────────────────────────────────────────────
  getMemory(ctx: RequestContext): AgentMemory {
    return this.memory.get(ctx.userId) ?? { facts: [], updatedAt: new Date(0).toISOString() };
  }

  setMemory(ctx: RequestContext, input: UpdateMemoryInput): AgentMemory {
    const next: AgentMemory = { facts: [...input.facts], updatedAt: new Date().toISOString() };
    this.memory.set(ctx.userId, next);
    return next;
  }

  // ── Documents ───────────────────────────────────────────────────────────────
  getDocuments(ctx: RequestContext): UserDocument[] {
    return this.documents.get(ctx.userId) ?? [];
  }

  addDocument(ctx: RequestContext, input: UploadDocumentInput): UserDocument {
    const doc: UserDocument = {
      id: crypto.randomUUID(),
      name: input.name,
      mime: input.mime,
      sizeBytes: input.sizeBytes ?? 0,
      note: input.note ?? null,
      uploadedAt: new Date().toISOString(),
    };
    const list = this.documents.get(ctx.userId) ?? [];
    list.unshift(doc);
    this.documents.set(ctx.userId, list);
    return doc;
  }

  removeDocument(ctx: RequestContext, id: string): { ok: true } {
    const list = this.documents.get(ctx.userId) ?? [];
    this.documents.set(
      ctx.userId,
      list.filter((d) => d.id !== id),
    );
    return { ok: true };
  }

  // ── Chat ─────────────────────────────────────────────────────────────────────
  async chat(ctx: RequestContext, input: AgentChatInput): Promise<AgentChatResult> {
    const deterministic = this.deterministicReply(ctx, input);
    if (!(await this.llm.isEnabled())) return deterministic;

    // Grounded LLM path: hand the scope-relevant KPIs + memory + docs to Mistral.
    const system = this.systemPrompt(ctx, input);
    const messages: LlmMessage[] = [
      { role: 'system', content: system },
      ...input.messages.map((m) => ({ role: m.role, content: m.content }) as LlmMessage),
    ];
    try {
      const out = await this.llm.reason(ctx.tenantId, messages);
      return { ...deterministic, message: out.text, model: out.model };
    } catch {
      // Any upstream/quota failure degrades gracefully to the deterministic reply.
      return deterministic;
    }
  }

  /** LavoPilot persona + grounding data assembled from the read "tools". */
  private systemPrompt(ctx: RequestContext, input: AgentChatInput): string {
    const d = this.read.getDashboard('today');
    const e = this.read.getEnergy(ctx.tenantId);
    const r = this.read.getRevenue('today');
    const mem = this.getMemory(ctx);
    const docs = this.getDocuments(ctx);
    const perimeter =
      input.scope.type === 'site'
        ? `le site ${input.scope.name ?? input.scope.siteId}`
        : 'toute la franchise';
    return [
      'Tu es LavoPilot, un copilote IA sympathique et concret pour gérant(e) de laveries automatiques. Tu es une machine à laver personnifiée, serviable et positive. Réponds en français, de façon brève et actionnable.',
      `Périmètre analysé : ${perimeter}.`,
      `Recettes du jour : ${euro(d.revenueToday.amountCents)} (${d.revenueDelta.pct}% vs hier). Panier moyen ${euro(r.averageBasket.amountCents)} sur ${r.cycles} cycles.`,
      `Parc : ${d.machinesActive}/${d.machinesTotal} machines actives, ${d.machinesOutOfService} hors service. Tickets : ${d.openTickets} ouverts (${d.criticalTickets} critiques).`,
      `Énergie : ${e.meters.map((m) => `${m.kind} ${m.value}${m.unit} (${m.deltaPct}%)`).join(', ')}.`,
      mem.facts.length ? `Mémoire utilisateur : ${mem.facts.join(' | ')}.` : '',
      docs.length ? `Documents fournis : ${docs.map((x) => x.name).join(', ')}.` : '',
      "Si l'utilisateur veut connecter un compteur (PDL/PRM électrique ou PCE gaz), propose-lui de le faire directement dans le chat.",
    ]
      .filter(Boolean)
      .join('\n');
  }

  /** Deterministic, data-backed fallback — mirrors the offline mock client. */
  private deterministicReply(ctx: RequestContext, input: AgentChatInput): AgentChatResult {
    const last = [...input.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const q = last.toLowerCase();
    const site = input.scope.type === 'site' ? (input.scope.name ?? 'ce site') : null;
    const perimeter = site ? `sur ${site}` : 'sur toute la franchise';
    const has = (...ks: string[]) => ks.some((k) => q.includes(k));
    const model = 'lavopilot-offline';

    const base = (
      message: string,
      usedTools: string[],
      suggestions: string[],
      card: ChatCard | null = null,
    ): AgentChatResult => ({ message, model, usedTools, card, suggestions });

    if (
      has('pce', 'pdl', 'prm', 'compteur', 'raccord', 'connecter', 'brancher', 'enedis', 'grdf')
    ) {
      const gas = has('pce', 'grdf', 'gaz');
      return base(
        `Avec plaisir ! Je peux vous aider à connecter votre ${gas ? 'compteur gaz (PCE)' : 'compteur électrique (PDL/PRM)'} en quelques secondes. Renseignez le numéro ci-dessous et je m'occupe du reste.`,
        ['connectors'],
        ['Connecter aussi mon gaz', 'Où trouver mon numéro de compteur ?'],
        {
          kind: 'connect',
          provider: gas ? 'grdf' : 'enedis',
          title: gas
            ? 'Connecter un PCE (gaz · GRDF ADICT)'
            : 'Connecter un PDL/PRM (électricité · Enedis)',
          note: 'Aucune donnée n’est importée avant votre consentement.',
        },
      );
    }

    if (has('recette', 'revenu', 'chiffre', 'encaiss', 'monétique', 'monetique')) {
      const d = this.read.getDashboard('today');
      const r = this.read.getRevenue('today');
      return base(
        `Aujourd'hui ${perimeter}, les recettes s'élèvent à ${euro(d.revenueToday.amountCents)} (${d.revenueDelta.pct > 0 ? '+' : ''}${d.revenueDelta.pct}% vs hier). Panier moyen ${euro(r.averageBasket.amountCents)} sur ${r.cycles} cycles.`,
        ['dashboard', 'revenue'],
        ['Détail par moyen de paiement', 'Quels sites sous-performent ?'],
      );
    }

    if (has('énergie', 'energie', 'conso', 'kwh', 'gaz', 'électr', 'electr')) {
      const e = this.read.getEnergy(ctx.tenantId);
      const elec = e.meters.find((m) => m.kind === 'electricity');
      const gas = e.meters.find((m) => m.kind === 'gas');
      return base(
        `Côté énergie ${perimeter} : électricité à ${elec?.value ?? 0} ${elec?.unit ?? 'kWh'} (${elec && elec.deltaPct > 0 ? '+' : ''}${elec?.deltaPct ?? 0}%) et gaz à ${gas?.value ?? 0} ${gas?.unit ?? 'kWh'} (${gas && gas.deltaPct > 0 ? '+' : ''}${gas?.deltaPct ?? 0}%).`,
        ['energy'],
        ["Voir l'historique de consommation", 'Connecter un compteur'],
      );
    }

    if (has('machine', 'parc', 'panne', 'hors service', 'sèche', 'seche', 'lave')) {
      const d = this.read.getDashboard('today');
      return base(
        `Le parc ${perimeter} compte ${d.machinesActive}/${d.machinesTotal} machines actives, dont ${d.machinesOutOfService} hors service à surveiller.`,
        ['dashboard', 'machines'],
        ['Lister les machines en panne', 'Taux de disponibilité'],
      );
    }

    if (has('maintenance', 'ticket', 'intervention', 'gmao', 'répar', 'repar')) {
      const d = this.read.getDashboard('today');
      return base(
        `Il y a ${d.openTickets} tickets de maintenance ouverts ${perimeter}, dont ${d.criticalTickets} critiques.`,
        ['dashboard', 'maintenance'],
        ['Résumer les tickets critiques'],
      );
    }

    return base(
      `Bonjour, je suis LavoPilot 🧺 votre copilote de laverie. ${site ? `Vous regardez actuellement ${site}.` : 'Vous êtes sur la vue franchise.'} Je peux analyser vos recettes, votre énergie, votre parc et vos tickets — ou vous aider à connecter une nouvelle source de données.`,
      [],
      [
        'Comment vont mes recettes ?',
        'Ma consommation d’énergie',
        'Connecter un compteur',
        'Des machines en panne ?',
      ],
    );
  }
}
