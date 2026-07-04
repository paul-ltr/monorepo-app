import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodPipe } from '@/common/zod.pipe';
import { loadEnv } from '@/config/env';
import { MailerService } from './mailer.service';

/** Demo / contact request from the public marketing site. */
export const leadInput = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200),
  company: z.string().trim().max(200).optional().default(''),
  sites: z.string().trim().max(200).optional().default(''),
  message: z.string().trim().max(5000).optional().default(''),
  locale: z.enum(['fr', 'en']).optional().default('fr'),
  source: z.string().trim().max(100).optional().default('marketing-site'),
});
export type LeadInput = z.infer<typeof leadInput>;

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/**
 * Public, unauthenticated lead capture (excluded from AuthMiddleware in
 * AppModule). Forwards the demo request to the sales inbox via Brevo. Returns
 * 202 regardless of email delivery so the marketing form never leaks infra
 * state to anonymous visitors.
 */
@ApiTags('public')
@Controller('public')
export class LeadsController {
  private readonly env = loadEnv();

  constructor(private readonly mailer: MailerService) {}

  @Post('leads')
  async createLead(@Body(new ZodPipe(leadInput)) body: LeadInput) {
    const rows: [string, string][] = [
      ['Nom', body.name],
      ['E-mail', body.email],
      ['Société', body.company],
      ['Sites / machines', body.sites],
      ['Langue', body.locale],
      ['Source', body.source],
      ['Message', body.message],
    ];
    const html = `<h2>Nouvelle demande de démo — LavoPilot</h2><table>${rows
      .filter(([, v]) => v)
      .map(([k, v]) => `<tr><td><strong>${esc(k)}</strong></td><td>${esc(v)}</td></tr>`)
      .join('')}</table>`;

    await this.mailer.send({
      to: this.env.LEADS_TO_EMAIL,
      subject: `Demande de démo — ${body.name}${body.company ? ` (${body.company})` : ''}`,
      html,
      replyTo: body.email,
    });

    return { status: 'received' };
  }
}
