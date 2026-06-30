import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { AppError } from '@pilotage/shared';
import type { Env } from '@/config/env';

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

/** Verifies a Cognito access token and returns its claims (prod auth path). */
export async function verifyCognitoToken(token: string, env: Env): Promise<{ sub: string }> {
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
    return { sub: payload.sub };
  } catch {
    throw new AppError('unauthenticated', 'Jeton invalide');
  }
}
