import { describe, it, expect, beforeEach } from 'vitest';
import type { RequestContext } from '@pilotage/shared';
import { MieleService, mieleKindOf } from './miele.service';
import { SecretStore } from './secret-store.service';

const noDb = {
  run: async () => {
    throw new Error('no db');
  },
} as unknown as ConstructorParameters<typeof MieleService>[0];

const audit = { record: async () => undefined } as unknown as ConstructorParameters<
  typeof MieleService
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

describe('mieleKindOf', () => {
  it('maps Miele type labels to machine_kind', () => {
    expect(mieleKindOf('Washing machine')).toBe('washer');
    expect(mieleKindOf('Tumble dryer')).toBe('dryer');
    expect(mieleKindOf('Washer dryer')).toBe('combo');
    expect(mieleKindOf('Dishwasher')).toBe('washer');
  });
});

describe('MieleService (simulated OAuth flow)', () => {
  let svc: MieleService;

  beforeEach(() => {
    svc = new MieleService(noDb, audit, new SecretStore());
  });

  it('runs authorize → callback → complete and lists demo appliances', async () => {
    const { authorizeUrl, state, simulated } = svc.authorize('t1', { vg: 'fr-FR' });
    expect(simulated).toBe(true);
    expect(authorizeUrl).toContain(`state=${state}`);

    const cb = await svc.handleCallback(`SANDBOX-${state}`, state);
    expect(cb.ok).toBe(true);

    const res = await svc.complete('t1', state);
    expect(res.status).toBe('connected');
    expect(res.simulated).toBe(true);
    expect(res.appliances).toHaveLength(3);

    const status = svc.status('t1');
    expect(status.accounts).toHaveLength(1);
    expect(status.appliances).toHaveLength(3);
  });

  it('rejects a complete for an unknown/foreign state', async () => {
    const res = await svc.complete('t1', 'nope');
    expect(res.status).toBe('error');

    // Outcome cached for t1 must not be drainable by t2.
    const { state } = svc.authorize('t1', { vg: 'fr-FR' });
    await svc.handleCallback(`SANDBOX-${state}`, state);
    const foreign = await svc.complete('t2', state);
    expect(foreign.status).toBe('error');
  });

  it('associates an appliance with a site', async () => {
    const { state } = svc.authorize('t1', { vg: 'fr-FR' });
    await svc.handleCallback(`SANDBOX-${state}`, state);
    const res = await svc.complete('t1', state);
    const accountId = res.account!.id;
    const applianceId = res.appliances[0]!.applianceId;

    const after = await svc.associate(ctx, { accountId, applianceId, siteId: 'site-9' });
    expect(after.appliances.find((a) => a.applianceId === applianceId)?.siteId).toBe('site-9');
  });

  it('supports multiple accounts and disconnect', async () => {
    for (const vg of ['fr-FR', 'de-DE']) {
      const { state } = svc.authorize('t1', { vg });
      await svc.handleCallback(`SANDBOX-${state}`, state);
      await svc.complete('t1', state);
    }
    expect(svc.status('t1').accounts).toHaveLength(2);
    const first = svc.status('t1').accounts[0]!.id;
    await svc.disconnect(ctx, first);
    expect(svc.status('t1').accounts).toHaveLength(1);
  });
});
