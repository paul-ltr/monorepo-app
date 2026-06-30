import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '@pilotage/shared';
import { loadEnv } from '@/config/env';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmCompletion {
  text: string;
  model: string;
  tokensUsed: number;
}

/**
 * Provider-abstracted LLM client. Wraps Mistral AI (chat + embeddings) behind a
 * stable interface so the provider is swappable. Cost guardrails:
 *  - a small model for cheap tasks (summaries) and a large one for reasoning;
 *  - a per-tenant monthly token cap (LLM_TENANT_MONTHLY_TOKEN_CAP) enforced
 *    against a usage counter (TODO: persist in core; in-memory here);
 *  - never send PII beyond necessity; token usage is logged.
 * When MISTRAL_API_KEY is unset the service runs in stub mode (no network).
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger('Llm');
  private readonly env = loadEnv();
  private readonly usageByTenant = new Map<string, number>();

  get enabled(): boolean {
    return Boolean(this.env.MISTRAL_API_KEY);
  }

  private assertWithinCap(tenantId: string, estimate: number): void {
    const used = this.usageByTenant.get(tenantId) ?? 0;
    if (used + estimate > this.env.LLM_TENANT_MONTHLY_TOKEN_CAP) {
      throw new AppError('rate_limited', 'Quota IA mensuel atteint pour ce compte');
    }
  }

  private record(tenantId: string, tokens: number): void {
    this.usageByTenant.set(tenantId, (this.usageByTenant.get(tenantId) ?? 0) + tokens);
    this.logger.log(`tenant=${tenantId} tokens=${tokens}`);
  }

  /** Cheap summary task → small model. */
  async summarize(tenantId: string, prompt: string): Promise<LlmCompletion> {
    return this.complete(tenantId, [{ role: 'user', content: prompt }], this.env.MISTRAL_MODEL_SMALL);
  }

  /** Reasoning task (NL Q&A over KPIs) → large model. */
  async reason(tenantId: string, messages: LlmMessage[]): Promise<LlmCompletion> {
    return this.complete(tenantId, messages, this.env.MISTRAL_MODEL_LARGE);
  }

  private async complete(tenantId: string, messages: LlmMessage[], model: string): Promise<LlmCompletion> {
    const estimate = Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 4) + 256;
    this.assertWithinCap(tenantId, estimate);

    if (!this.enabled) {
      // Stub mode — deterministic canned response so dev/UI work without a key.
      const text =
        'Synthèse indisponible (clé Mistral non configurée). Activez le connecteur Mistral dans Paramètres.';
      this.record(tenantId, estimate);
      return { text, model: `${model} (stub)`, tokensUsed: estimate };
    }

    // TODO: call the Mistral API via @mistralai/mistralai using a key fetched
    // from Secrets Manager (pilotage/<env>/mistral). Confirm model names from
    // https://docs.mistral.ai before pinning. Cache identical prompts.
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.env.MISTRAL_API_KEY}` },
      body: JSON.stringify({ model, messages }),
    });
    if (!res.ok) throw new AppError('upstream_unavailable', 'Service IA indisponible');
    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: { total_tokens?: number };
    };
    const tokens = json.usage?.total_tokens ?? estimate;
    this.record(tenantId, tokens);
    return { text: json.choices[0]?.message.content ?? '', model, tokensUsed: tokens };
  }
}
