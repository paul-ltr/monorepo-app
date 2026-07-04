import { Injectable, Logger } from '@nestjs/common';
import { loadEnv } from '@/config/env';

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

/**
 * Thin Brevo (ex-Sendinblue) transactional-email client. Kept dependency-free
 * (plain fetch) to stay light in the Lambda bundle. When BREVO_API_KEY is unset
 * (local dev), it no-ops and logs instead of failing — so the public contact
 * form still "works" without secrets configured.
 */
@Injectable()
export class MailerService {
  private readonly env = loadEnv();
  private readonly logger = new Logger(MailerService.name);

  async send(email: OutboundEmail): Promise<{ delivered: boolean }> {
    if (!this.env.BREVO_API_KEY) {
      this.logger.warn(`BREVO_API_KEY unset — skipping email to ${email.to}: "${email.subject}"`);
      return { delivered: false };
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': this.env.BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: this.env.LEADS_FROM_EMAIL, name: 'LavoPilot' },
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
