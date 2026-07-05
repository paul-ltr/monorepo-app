import { describe, it, expect, beforeEach } from 'vitest';
import type { RequestContext } from '@pilotage/shared';
import { ElectroluxService, mapDeviceType } from './electrolux.service';
import { SecretStore } from './secret-store.service';

// Stub the RLS-scoped DB (no Postgres in unit tests) — the service swallows DB
// errors and stays functional, mirroring the demo/no-DB path.
const noDb = {
  run: async () => {
    throw new Error('no db');
  },
} as unknown as ConstructorParameters<typeof ElectroluxService>[0];

const audit = { record: async () => undefined } as unknown as ConstructorParameters<
  typeof ElectroluxService
>[1];

const ctx: RequestContext = {
  userId: 'u',
  tenantId: 't1',
  email: 'e@x.fr',
  roles: ['owner'],
  permissions: ['M12:connectors:manage'],
  scope: { type: 'tenant' },
  locale: 'fr-FR',
  superuser: false,
};

describe('mapDeviceType', () => {
  it('maps OCP device types to machine_kind with a washer fallback', () => {
    expect(mapDeviceType('WASHING_MACHINE')).toBe('washer');
    expect(mapDeviceType('TUMBLE_DRYER')).toBe('dryer');
    expect(mapDeviceType('WASHER_DRYER')).toBe('combo');
    expect(mapDeviceType('DOSING_DISPENSER')).toBe('dispenser');
    expect(mapDeviceType('SOMETHING_ELSE')).toBe('washer');
  });
});

describe('ElectroluxService (simulated mode)', () => {
  let svc: ElectroluxService;

  beforeEach(() => {
    svc = new ElectroluxService(noDb, audit, new SecretStore());
  });

  it('connects a demo account and lists appliances when no email is given', async () => {
    const res = await svc.connect('t1', {
      email: '',
      password: '',
      countryCode: 'FR',
      brand: 'electrolux',
    });
    expect(res.status).toBe('connected');
    expect(res.simulated).toBe(true);
    expect(res.appliances).toHaveLength(3);
    expect(res.account?.simulated).toBe(true);

    const status = svc.status('t1');
    expect(status.accounts).toHaveLength(1);
    expect(status.appliances).toHaveLength(3);
  });

  it('associates an appliance with a site (in-memory even without a DB)', async () => {
    const res = await svc.connect('t1', {
      email: '',
      password: '',
      countryCode: 'FR',
      brand: 'electrolux',
    });
    const accountId = res.account!.id;
    const applianceId = res.appliances[0]!.applianceId;

    const after = await svc.associate(ctx, { accountId, applianceId, siteId: 'site-9' });
    const linked = after.appliances.find((a) => a.applianceId === applianceId);
    expect(linked?.siteId).toBe('site-9');
  });

  it('keeps accounts isolated per tenant and supports multiple accounts', async () => {
    await svc.connect('t1', { email: '', password: '', countryCode: 'FR', brand: 'electrolux' });
    await svc.connect('t1', { email: '', password: '', countryCode: 'FR', brand: 'aeg' });
    expect(svc.status('t1').accounts).toHaveLength(2);
    expect(svc.status('t2').accounts).toHaveLength(0);
  });

  it('disconnects an account', async () => {
    const res = await svc.connect('t1', { email: '', password: '', countryCode: 'FR', brand: 'electrolux' });
    await svc.disconnect(ctx, res.account!.id);
    expect(svc.status('t1').accounts).toHaveLength(0);
  });
});
