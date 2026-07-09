import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { env } from './env';
import {
  completeNewPassword as cognitoCompleteNewPassword,
  refreshSession,
  restoreSession,
  signIn,
  signOut as cognitoSignOut,
} from './cognito';

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

const MOCK_MODE = env.useMocks || env.authDevBypass;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStored);

  const persist = useCallback((next: AuthUser | null) => {
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setUser(next);
  }, []);

  // Real mode: restore a persisted Cognito session on load (refreshes tokens),
  // and keep the cached access token fresh (access tokens live 60 min).
  useEffect(() => {
    if (MOCK_MODE) return;
    let alive = true;
    void restoreSession().then((email) => {
      if (!alive) return;
      if (email) persist({ email });
      else if (readStored()) persist(null); // stale local flag, no Cognito session
    });
    const id = window.setInterval(() => void refreshSession(), 30 * 60 * 1000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [persist]);

  const login = useCallback(
    async (email: string, password: string) => {
      const normalized = email.trim().toLowerCase();

      if (MOCK_MODE) {
        // Mock/dev mode: validate against the demo account.
        if (normalized !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
          throw new Error('invalid_credentials');
        }
      } else {
        const res = await signIn(normalized, password);
        // Invited users must set a permanent password first (onboarding wizard
        // calls completeNewPassword); don't mark them signed-in yet.
        if (res.newPasswordRequired) throw new Error('new_password_required');
      }

      persist({ email: normalized });
    },
    [persist],
  );

  const completeNewPassword = useCallback(async (password: string) => {
    if (password.trim().length < 8) throw new Error('weak_password');
    if (!MOCK_MODE) await cognitoCompleteNewPassword(password);
  }, []);

  const logout = useCallback(() => {
    if (!MOCK_MODE) cognitoSignOut();
    persist(null);
  }, [persist]);

  const value = useMemo(
    () => ({ user, login, completeNewPassword, logout }),
    [user, login, completeNewPassword, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
