import { describe, it, expect } from 'vitest';
import { LlmService } from './llm.service';
import type { SecretStore } from '@/modules/secret-store.service';

/** A SecretStore stub that returns a fixed value for getCached. */
function stubSecrets(value: string | null): SecretStore {
  return { getCached: async () => value } as unknown as SecretStore;
}

describe('LlmService key resolution', () => {
  it('reads a raw-string secret and trims it', async () => {
    const svc = new LlmService(stubSecrets('  sk-raw-key  '));
    expect(await svc.resolveApiKey()).toBe('sk-raw-key');
    expect(await svc.isEnabled()).toBe(true);
  });

  it('reads a JSON {api_key} secret blob', async () => {
    const svc = new LlmService(stubSecrets('{"api_key":"sk-json-key"}'));
    expect(await svc.resolveApiKey()).toBe('sk-json-key');
  });

  it('is disabled (stub mode) when no key resolves', async () => {
    const svc = new LlmService(stubSecrets(null));
    expect(await svc.resolveApiKey()).toBeNull();
    expect(await svc.isEnabled()).toBe(false);
  });

  it('treats an empty / keyless JSON blob as no key', async () => {
    const svc = new LlmService(stubSecrets('{"note":"placeholder"}'));
    expect(await svc.resolveApiKey()).toBeNull();
  });
});
