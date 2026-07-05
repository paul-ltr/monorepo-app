import { describe, it, expect } from 'vitest';
import { BRIDGE_API_VERSION, bridgeHeaders } from './bridge';
import { bridgeCompleteResult, bridgeStatus } from './schemas/connectors';

describe('bridge', () => {
  it('pins the Bridge-Version and credential headers', () => {
    const h = bridgeHeaders({ clientId: 'cid', clientSecret: 'secret' });
    expect(h['Bridge-Version']).toBe(BRIDGE_API_VERSION);
    expect(h['Client-Id']).toBe('cid');
    expect(h['Client-Secret']).toBe('secret');
    // No user token → no Authorization header.
    expect(h.authorization).toBeUndefined();
  });

  it('adds a bearer Authorization when a user token is supplied', () => {
    const h = bridgeHeaders({ clientId: 'cid', clientSecret: 'secret', accessToken: 'tok' });
    expect(h.authorization).toBe('Bearer tok');
  });

  it('validates a connected status payload', () => {
    const parsed = bridgeStatus.parse({
      connected: true,
      bank: 'BNP Paribas',
      accounts: [{ id: 'a1', name: 'Compte courant pro', bank: 'BNP Paribas', balance: 14820, currency: 'EUR' }],
      simulated: true,
      expiresAt: '2026-10-03T00:00:00.000Z',
    });
    expect(parsed.accounts).toHaveLength(1);
    expect(parsed.accounts[0]?.currency).toBe('EUR');
  });

  it('rejects a complete result missing the accounts array', () => {
    expect(() =>
      bridgeCompleteResult.parse({
        status: 'connected',
        bank: 'Qonto',
        message: 'ok',
        simulated: true,
        expiresAt: null,
      }),
    ).toThrow();
  });
});
