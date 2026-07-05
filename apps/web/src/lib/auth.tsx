import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { env } from './env';

export interface AuthUser {
  email: string;
}

interface AuthCtx {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  /**
   * Finish an invited user's first sign-in by setting a permanent password.
   * Integration seam for Cognito's NEW_PASSWORD_REQUIRED challenge; in mock/dev
   * it simply resolves so the onboarding wizard can proceed.
   */
  completeNewPassword: (password: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = 'lavopilot-auth';

// Demo account for mock mode — mirrors the seeded demo user. Documented on the
// marketing site and in the login hint.
const DEMO_EMAIL = 'demo@lavopilot.com';
const DEMO_PASSWORD = 'demo1234';

function readStored(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  login: async () => {},
  completeNewPassword: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStored);

  const login = useCallback(async (email: string, password: string) => {
    const normalized = email.trim().toLowerCase();

    // Mock/dev mode: validate against the demo account. Real Cognito sign-in
    // plugs in here (exchange credentials for tokens) when mocks are off.
    if (env.useMocks || env.authDevBypass) {
      if (normalized !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
        throw new Error('invalid_credentials');
      }
    } else {
      // TODO: wire Amazon Cognito USER_PASSWORD_AUTH here.
      throw new Error('auth_not_configured');
    }

    const next = { email: normalized };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setUser(next);
  }, []);

  const completeNewPassword = useCallback(async (password: string) => {
    if (password.trim().length < 8) throw new Error('weak_password');
    // Mock/dev: nothing to persist — the user is already signed in. Real Cognito
    // completeNewPassword(challenge, password) plugs in here when mocks are off.
    if (!env.useMocks && !env.authDevBypass) {
      // TODO: wire Amazon Cognito NEW_PASSWORD_REQUIRED completion here.
      throw new Error('auth_not_configured');
    }
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, login, completeNewPassword, logout }),
    [user, login, completeNewPassword, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
