import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { Shell } from './Shell';
import { Dashboard } from '@/screens/Dashboard';
import { Machines } from '@/screens/Machines';
import { Revenue } from '@/screens/Revenue';
import { Energy } from '@/screens/Energy';
import { Maintenance } from '@/screens/Maintenance';
import { Pricing } from '@/screens/Pricing';
import { Clients } from '@/screens/Clients';
import { Finances } from '@/screens/Finances';
import { Reseau } from '@/screens/Reseau';
import { Settings } from '@/screens/Settings';
import { Notifications } from '@/screens/Notifications';
import { AdminConsole } from '@/screens/AdminConsole';

const rootRoute = createRootRoute({ component: Shell });

// Inline literal paths so TanStack Router can infer the typed route tree.
const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: Dashboard }),
  createRoute({ getParentRoute: () => rootRoute, path: '/machines', component: Machines }),
  createRoute({ getParentRoute: () => rootRoute, path: '/revenue', component: Revenue }),
  createRoute({ getParentRoute: () => rootRoute, path: '/energy', component: Energy }),
  createRoute({ getParentRoute: () => rootRoute, path: '/maintenance', component: Maintenance }),
  createRoute({ getParentRoute: () => rootRoute, path: '/pricing', component: Pricing }),
  createRoute({ getParentRoute: () => rootRoute, path: '/clients', component: Clients }),
  createRoute({ getParentRoute: () => rootRoute, path: '/finances', component: Finances }),
  createRoute({ getParentRoute: () => rootRoute, path: '/reseau', component: Reseau }),
  createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: Settings }),
  createRoute({ getParentRoute: () => rootRoute, path: '/notifications', component: Notifications }),
  createRoute({ getParentRoute: () => rootRoute, path: '/console', component: AdminConsole }),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
