import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '@pilotage/shared';
import { loadEnv } from '@/config/env';
import { SecretStore } from '@/modules/secret-store.service';

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
 * The API key is resolved from AWS Secrets Manager (`pilotage/<env>/mistral`,
 * overridable via MISTRAL_SECRET_ID) with the MISTRAL_API_KEY env var as a local
 * dev fallback. When none resolves, the service runs in stub mode (no network).
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger('Llm');
  private readonly env = loadEnv();
  private readonly usageByTenant = new Map<string, number>();

  constructor(private readonly secrets: SecretStore) {}

  /** Deterministic Secrets Manager path for the shared Mistral key. */
  private secretRef(): string {
    if (this.env.MISTRAL_SECRET_ID) return this.env.MISTRAL_SECRET_ID;
    const env = this.env.PILOTAGE_ENV ?? this.env.NODE_ENV ?? 'development';
    return `pilotage/${env}/mistral`;
  }

  /** Accept either a raw-string secret or a JSON `{api_key|apiKey|key}` blob. */
  private extractKey(secretString: string): string | null {
    const s = secretString.trim();
    if (!s) return null;
    if (s.startsWith('{')) {
      try {
        const j = JSON.parse(s) as Record<string, unknown>;
        const v = j.api_key ?? j.apiKey ?? j.MISTRAL_API_KEY ?? j.key;
        return typeof v === 'string' && v.length > 0 ? v : null;
      } catch {
        return null;
      }
    }
    return s;
  }

  /** Env var first (local dev), then Secrets Manager (cached in SecretStore). */
  async resolveApiKey(): Promise<string | null> {
    if (this.env.MISTRAL_API_KEY) return this.env.MISTRAL_API_KEY;
    const raw = await this.secrets.getCached(this.secretRef()).catch((err) => {
      this.logger.warn(
        `Mistral secret fetch failed (${(err as Error).message}); falling back to env`,
      );
      return null;
    });
    return raw ? this.extractKey(raw) : null;
  }

  /** True when a key resolves (env or Secrets Manager) — the LLM is live. */
  async isEnabled(): Promise<boolean> {
    return Boolean(await this.resolveApiKey());
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
    return this.complete(
      tenantId,
      [{ role: 'user', content: prompt }],
      this.env.MISTRAL_MODEL_SMALL,
    );
  }

  /** Reasoning task (NL Q&A over KPIs) → large model. */
  async reason(tenantId: string, messages: LlmMessage[]): Promise<LlmCompletion> {
    return this.complete(tenantId, messages, this.env.MISTRAL_MODEL_LARGE);
  }

  private async complete(
    tenantId: string,
    messages: LlmMessage[],
    model: string,
  ): Promise<LlmCompletion> {
    const estimate = Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 4) + 256;
    this.assertWithinCap(tenantId, estimate);

    const apiKey = await this.resolveApiKey();
    if (!apiKey) {
      // Stub mode — deterministic canned response so dev/UI work without a key.
      const text =
        'Synthèse indisponible (clé Mistral non configurée). Activez le connecteur Mistral dans Paramètres.';
      this.record(tenantId, estimate);
      return { text, model: `${model} (stub)`, tokensUsed: estimate };
    }

    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
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
