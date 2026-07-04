import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiProvider } from '@/lib/api';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ScopeProvider } from '@/lib/scope';
import { ToastProvider } from '@/components/Toast';
import { Login } from '@/screens/Login';

type Theme = 'light' | 'dark';

interface ThemeCtx {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: 'light', toggleTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

function readInitialTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'dark' ? 'dark' : 'light';
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('pilotage-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

/** Gates the app behind authentication; renders the login screen when signed out. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Login />;
  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ApiProvider>
        <ScopeProvider>
          <ToastProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </ToastProvider>
        </ScopeProvider>
      </ApiProvider>
    </AuthProvider>
  );
}
