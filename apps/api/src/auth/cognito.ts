import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { AppError } from '@pilotage/shared';
import type { Env } from '@/config/env';

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

/** Verifies a Cognito access token and returns its claims (prod auth path). */
export async function verifyCognitoToken(
  token: string,
  env: Env,
): Promise<{ sub: string; groups: string[] }> {
  if (!env.COGNITO_USER_POOL_ID || !env.COGNITO_CLIENT_ID) {
    throw new AppError('internal', 'Cognito non configuré');
  }
  verifier ??= CognitoJwtVerifier.create({
    userPoolId: env.COGNITO_USER_POOL_ID,
    clientId: env.COGNITO_CLIENT_ID,
    tokenUse: 'access',
  });
  try {
    const payload = await verifier.verify(token);
    // `cognito:groups` is an IdP-verified claim — the only trustworthy source of
    // staff/back-office membership (never an app-controlled email column).
    const raw = (payload as { 'cognito:groups'?: unknown })['cognito:groups'];
    const groups = Array.isArray(raw) ? raw.map(String) : [];
    return { sub: payload.sub, groups };
  } catch {
    throw new AppError('unauthenticated', 'Jeton invalide');
  }
}
