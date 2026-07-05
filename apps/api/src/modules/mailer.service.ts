import { Injectable, Logger } from '@nestjs/common';
import { loadEnv } from '@/config/env';
import { SecretStore } from './secret-store.service';

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  /** Overrides the default sender display name (e.g. the tenant's app name). */
  senderName?: string;
}

/**
 * Thin Brevo (ex-Sendinblue) transactional-email client. Kept dependency-free
 * (plain fetch) to stay light in the Lambda bundle. The API key is a single
 * shared secret for all tenants, read from AWS Secrets Manager at runtime and
 * memoised. When neither the secret nor BREVO_API_KEY is set (local dev), it
 * no-ops and logs instead of failing — so email flows still "work" offline.
 */
@Injectable()
export class MailerService {
  private readonly env = loadEnv();
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly secrets: SecretStore) {}

  private async apiKey(): Promise<string | null> {
    const ref = this.env.BREVO_SECRET_ID ?? this.secrets.globalRef({ provider: 'brevo', key: 'api-key' });
    const fromSecrets = await this.secrets.getCached(ref).catch((err) => {
      this.logger.warn(`Brevo secret fetch failed (${(err as Error).message}); falling back to env`);
      return null;
    });
    return fromSecrets ?? this.env.BREVO_API_KEY ?? null;
  }

  async send(email: OutboundEmail): Promise<{ delivered: boolean }> {
    const key = await this.apiKey();
    if (!key) {
      this.logger.warn(`No Brevo key — skipping email to ${email.to}: "${email.subject}"`);
      return { delivered: false };
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': key,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: this.env.LEADS_FROM_EMAIL, name: email.senderName ?? this.env.BREVO_SENDER_NAME },
        to: [{ email: email.to }],
        replyTo: email.replyTo ? { email: email.replyTo } : undefined,
        subject: email.subject,
        htmlContent: email.html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(`Brevo send failed (${res.status}): ${detail}`);
      return { delivered: false };
    }
    return { delivered: true };
  }
}
