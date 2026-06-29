export type { PilotageApi, MachineStatusList, SessionInfo } from './types';
export { createMockClient } from './mock';
export { createHttpClient, ApiError } from './http';
export type { HttpClientOptions } from './http';
export * as fixtures from './fixtures';

import { createMockClient } from './mock';
import { createHttpClient, type HttpClientOptions } from './http';
import type { PilotageApi } from './types';

export interface ClientConfig extends Partial<HttpClientOptions> {
  /** When true (or no baseUrl), use the in-browser mock client. */
  mock?: boolean;
}

/** Pick the mock or HTTP client based on config. */
export function createClient(config: ClientConfig = {}): PilotageApi {
  if (config.mock || !config.baseUrl) return createMockClient();
  return createHttpClient({ baseUrl: config.baseUrl, getToken: config.getToken });
}
