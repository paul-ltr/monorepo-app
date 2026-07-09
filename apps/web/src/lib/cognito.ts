// Amazon Cognito sign-in (SRP) for the operator console. The pool client is a
// public SPA client (no secret, PKCE/SRP). The current access token is cached
// synchronously so the HTTP api-client can attach it as a bearer; getSession()
// auto-refreshes it from the refresh token.
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { env } from './env';

let accessToken: string | null = null;
export const getAccessToken = (): string | null => accessToken;
const cache = (s: CognitoUserSession | null) => {
  accessToken = s ? s.getAccessToken().getJwtToken() : null;
};

export const cognitoConfigured = Boolean(env.cognito.userPoolId && env.cognito.clientId);

const pool = cognitoConfigured
  ? new CognitoUserPool({ UserPoolId: env.cognito.userPoolId!, ClientId: env.cognito.clientId! })
  : null;

// Holds a user mid NEW_PASSWORD_REQUIRED challenge (invited users' first login).
let pendingUser: CognitoUser | null = null;

export interface SignInResult {
  email: string;
  newPasswordRequired?: boolean;
}

export function signIn(email: string, password: string): Promise<SignInResult> {
  if (!pool) return Promise.reject(new Error('auth_not_configured'));
  const user = new CognitoUser({ Username: email, Pool: pool });
  const details = new AuthenticationDetails({ Username: email, Password: password });
  return new Promise((resolve, reject) => {
    user.authenticateUser(details, {
      onSuccess: (session) => {
        cache(session);
        pendingUser = null;
        resolve({ email });
      },
      onFailure: () => reject(new Error('invalid_credentials')),
      newPasswordRequired: () => {
        pendingUser = user;
        resolve({ email, newPasswordRequired: true });
      },
    });
  });
}

export function completeNewPassword(password: string): Promise<void> {
  const user = pendingUser;
  if (!user) return Promise.reject(new Error('no_challenge'));
  return new Promise((resolve, reject) => {
    user.completeNewPasswordChallenge(
      password,
      {},
      {
        onSuccess: (session) => {
          cache(session);
          pendingUser = null;
          resolve();
        },
        onFailure: (err) => reject(err),
      },
    );
  });
}

/** Restore a persisted session (auto-refreshes tokens). Resolves to the email or null. */
export function restoreSession(): Promise<string | null> {
  return new Promise((resolve) => {
    const user = pool?.getCurrentUser();
    if (!user) {
      cache(null);
      resolve(null);
      return;
    }
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) {
        cache(null);
        resolve(null);
        return;
      }
      cache(session);
      resolve(user.getUsername());
    });
  });
}

/** Refresh the cached access token if a valid session exists. */
export function refreshSession(): Promise<void> {
  return new Promise((resolve) => {
    const user = pool?.getCurrentUser();
    if (!user) return resolve();
    user.getSession((_e: Error | null, s: CognitoUserSession | null) => {
      if (s?.isValid()) cache(s);
      resolve();
    });
  });
}

export function signOut(): void {
  pool?.getCurrentUser()?.signOut();
  cache(null);
  pendingUser = null;
}
