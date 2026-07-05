import { describe, it, expect } from 'vitest';
import {
  MIELE_AUTHORIZE_URL,
  buildMieleAuthorizeUrl,
  mapMieleType,
  mieleDevicesUrl,
} from './miele';

describe('miele authorize url', () => {
  it('builds the consent URL with client_id, redirect, state and vg', () => {
    const url = new URL(
      buildMieleAuthorizeUrl({
        clientId: 'cid',
        redirectUri: 'https://api.example/connectors/miele/callback',
        state: 'st-1',
        vg: 'fr-FR',
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe(MIELE_AUTHORIZE_URL);
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('redirect_uri')).toBe('https://api.example/connectors/miele/callback');
    expect(url.searchParams.get('state')).toBe('st-1');
    expect(url.searchParams.get('vg')).toBe('fr-FR');
  });

  it('builds the devices URL under /v1', () => {
    expect(mieleDevicesUrl('https://api.mcs3.miele.com')).toBe('https://api.mcs3.miele.com/v1/devices');
    expect(mieleDevicesUrl('https://api.mcs3.miele.com/')).toBe('https://api.mcs3.miele.com/v1/devices');
  });
});

describe('mapMieleType', () => {
  it('maps device type codes with a washer fallback', () => {
    expect(mapMieleType(1, 'Washing machine')).toBe('washer');
    expect(mapMieleType(2, 'Tumble dryer')).toBe('dryer');
    expect(mapMieleType(24, 'Washer dryer')).toBe('combo');
    expect(mapMieleType(undefined, 'Washer dryer')).toBe('combo');
    expect(mapMieleType(undefined, 'Tumble dryer')).toBe('dryer');
    expect(mapMieleType(999, 'Oven')).toBe('washer');
  });
});
