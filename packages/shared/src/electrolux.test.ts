import { describe, it, expect } from 'vitest';
import {
  ELECTROLUX_BRAND_CLIENTS,
  buildGigyaBaseString,
  buildSortedQs,
  gigyaEncode,
  ocpAppliancesInfoUrl,
  ocpAppliancesUrl,
  ocpIdentityProvidersUrl,
  ocpTokenUrl,
} from './electrolux';

describe('electrolux gigya helpers', () => {
  it('percent-encodes spaces as %20 and preserves ~', () => {
    expect(gigyaEncode('a b~c')).toBe('a%20b~c');
    expect(gigyaEncode(true)).toBe('true');
    expect(gigyaEncode(1700000000)).toBe('1700000000');
  });

  it('builds a sorted query string, skipping undefined values', () => {
    expect(buildSortedQs({ b: 1, a: 'x', c: undefined })).toBe('a=x&b=1');
  });

  it('builds the OAuth1 base string Gigya signs over', () => {
    const base = buildGigyaBaseString('post', 'https://accounts.eu1.gigya.com/accounts.getJWT', {
      a: '1',
      b: 'two words',
    });
    expect(base).toBe(
      'POST&https%3A%2F%2Faccounts.eu1.gigya.com%2Faccounts.getJWT&a%3D1%26b%3Dtwo%2520words',
    );
  });
});

describe('electrolux ocp url builders', () => {
  it('builds token, identity-provider and appliance URLs', () => {
    const base = 'https://api.ocp.electrolux.one';
    expect(ocpTokenUrl(base)).toBe(`${base}/one-account-authorization/api/v1/token`);
    expect(ocpTokenUrl(`${base}/`)).toBe(`${base}/one-account-authorization/api/v1/token`);
    expect(ocpIdentityProvidersUrl(base, 'electrolux', 'FR')).toBe(
      `${base}/one-account-user/api/v1/identity-providers?brand=electrolux&countryCode=FR`,
    );
    expect(ocpAppliancesUrl(base)).toBe(`${base}/appliance/api/v2/appliances?includeMetadata=true`);
    expect(ocpAppliancesUrl(base, false)).toBe(`${base}/appliance/api/v2/appliances`);
    expect(ocpAppliancesInfoUrl(base)).toBe(`${base}/appliance/api/v2/appliances/info`);
  });

  it('exposes per-brand client constants', () => {
    expect(ELECTROLUX_BRAND_CLIENTS.electrolux.clientId).toBe('ElxOneApp');
    expect(ELECTROLUX_BRAND_CLIENTS.aeg.clientId).toBe('AEGOneApp');
  });
});
