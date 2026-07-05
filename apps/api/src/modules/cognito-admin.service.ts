import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { AppError } from '@pilotage/shared';
import { loadEnv } from '@/config/env';

/**
 * Cognito user-pool admin operations for the invitation flow. Mirrors
 * SecretStore's dev seam: when `AUTH_DEV_BYPASS` is on or the pool isn't
 * configured, it returns a synthetic `sub` and makes no AWS call, so local /
 * mock invites still create `app_user` rows. In prod it drives Cognito's native
 * invite (AdminCreateUser emails a temporary password; the user is forced to set
 * a new one on first login via the NEW_PASSWORD_REQUIRED challenge).
 */
@Injectable()
export class CognitoAdminService {
  private readonly env = loadEnv();
  private readonly logger = new Logger(CognitoAdminService.name);
  private client: CognitoIdentityProviderClient | null = null;

  /** True when we can't (or shouldn't) reach a real user pool. */
  private get simulated(): boolean {
    return this.env.AUTH_DEV_BYPASS || !this.env.COGNITO_USER_POOL_ID;
  }

  private aws(): CognitoIdentityProviderClient {
    this.client ??= new CognitoIdentityProviderClient({
      region: this.env.AWS_REGION ?? this.env.COGNITO_REGION,
    });
    return this.client;
  }

  /**
   * Create a Cognito user and return its `sub`. When `suppressEmail` is true the
   * caller is responsible for delivering the invitation (e.g. via Brevo).
   */
  async adminCreateUser(input: {
    email: string;
    fullName: string;
    suppressEmail?: boolean;
  }): Promise<{ sub: string }> {
    if (this.simulated) {
      this.logger.debug(`simulated adminCreateUser(${input.email}) — no Cognito call`);
      return { sub: `invited-${randomUUID()}` };
    }
    const res = await this.aws().send(
      new AdminCreateUserCommand({
        UserPoolId: this.env.COGNITO_USER_POOL_ID,
        Username: input.email,
        DesiredDeliveryMediums: ['EMAIL'],
        MessageAction: input.suppressEmail ? 'SUPPRESS' : undefined,
        UserAttributes: [
          { Name: 'email', Value: input.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: input.fullName },
        ],
      }),
    );
    const sub = res.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
    if (!sub) throw new AppError('internal', "Cognito n'a pas renvoyé d'identifiant utilisateur");
    return { sub };
  }

  async adminDisableUser(email: string): Promise<void> {
    if (this.simulated) return;
    await this.aws().send(
      new AdminDisableUserCommand({ UserPoolId: this.env.COGNITO_USER_POOL_ID, Username: email }),
    );
  }

  /** Best-effort rollback when the DB insert fails after the Cognito user exists. */
  async adminDeleteUser(email: string): Promise<void> {
    if (this.simulated) return;
    try {
      await this.aws().send(
        new AdminDeleteUserCommand({ UserPoolId: this.env.COGNITO_USER_POOL_ID, Username: email }),
      );
    } catch (err) {
      this.logger.error(`rollback adminDeleteUser(${email}) failed: ${(err as Error).message}`);
    }
  }
}
