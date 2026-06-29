import { describe, it, expect } from 'vitest';
import { eur, formatMoney, addMoney } from './money';
import { isModuleEnabled, parseFeatureFlags } from './feature-flags';
import { ROLE_PERMISSIONS, hasPermission } from './auth';
import type { RequestContext } from './auth';

describe('money', () => {
  it('formats cents as fr-FR EUR', () => {
    // Non-breaking spaces in fr-FR output; assert on the salient parts.
    const out = formatMoney(eur(428700));
    expect(out).toContain('4');
    expect(out).toContain('287');
    expect(out).toContain('€');
  });

  it('adds same-currency money and rejects mismatches', () => {
    expect(addMoney(eur(100), eur(50)).amountCents).toBe(150);
    expect(() => addMoney(eur(100), { amountCents: 1, currency: 'USD' })).toThrow();
  });
});

describe('feature flags', () => {
  it('defaults MVP modules on and Could modules off', () => {
    expect(isModuleEnabled('M1')).toBe(true);
    expect(isModuleEnabled('M10')).toBe(false);
  });

  it('applies env overrides', () => {
    const flags = parseFeatureFlags('M10,M11=false');
    expect(isModuleEnabled('M10', flags)).toBe(true);
    expect(isModuleEnabled('M11', flags)).toBe(false);
  });
});

describe('rbac', () => {
  it('owner has every permission; viewer does not reconcile', () => {
    const owner = { permissions: ROLE_PERMISSIONS.owner } as RequestContext;
    const viewer = { permissions: ROLE_PERMISSIONS.viewer } as RequestContext;
    expect(hasPermission(owner, 'M2:reconcile')).toBe(true);
    expect(hasPermission(viewer, 'M2:reconcile')).toBe(false);
  });
});
