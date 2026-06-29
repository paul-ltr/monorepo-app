import type { ModuleKey } from './enums';

/**
 * Feature flags gate Should/Could modules so the MVP ships clean boundaries.
 * Resolution order (later wins): module default → env override → per-tenant
 * override. The web hides flagged-off modules; the API returns a
 * `feature_disabled` (501) problem for their endpoints.
 */
export interface ModuleFlag {
  module: ModuleKey;
  /** i18n key resolves the label; this is just a dev-facing name. */
  name: string;
  /** Default on/off for a fresh tenant in any env. */
  defaultEnabled: boolean;
  /** MVP completeness, surfaced in docs/admin. */
  maturity: 'mvp' | 'partial' | 'stub';
}

export const MODULE_FLAGS: Record<ModuleKey, ModuleFlag> = {
  M1: { module: 'M1', name: 'machines', defaultEnabled: true, maturity: 'mvp' },
  M2: { module: 'M2', name: 'revenue', defaultEnabled: true, maturity: 'mvp' },
  M3: { module: 'M3', name: 'customers', defaultEnabled: true, maturity: 'partial' },
  M4: { module: 'M4', name: 'maintenance', defaultEnabled: true, maturity: 'partial' },
  M5: { module: 'M5', name: 'energy', defaultEnabled: true, maturity: 'mvp' },
  M6: { module: 'M6', name: 'finance', defaultEnabled: true, maturity: 'partial' },
  M7: { module: 'M7', name: 'pricing', defaultEnabled: true, maturity: 'partial' },
  M8: { module: 'M8', name: 'crm', defaultEnabled: false, maturity: 'stub' },
  M9: { module: 'M9', name: 'network', defaultEnabled: true, maturity: 'mvp' },
  M10: { module: 'M10', name: 'inventory', defaultEnabled: false, maturity: 'stub' },
  M11: { module: 'M11', name: 'hr', defaultEnabled: false, maturity: 'stub' },
  M12: { module: 'M12', name: 'admin', defaultEnabled: true, maturity: 'mvp' },
};

export type FeatureFlagState = Partial<Record<ModuleKey, boolean>>;

export function isModuleEnabled(
  module: ModuleKey,
  overrides: FeatureFlagState = {},
): boolean {
  if (module in overrides) return overrides[module]!;
  return MODULE_FLAGS[module].defaultEnabled;
}

/** Parse a comma-separated env string like "M3,M8" into an enable-override map. */
export function parseFeatureFlags(raw: string | undefined): FeatureFlagState {
  if (!raw) return {};
  const state: FeatureFlagState = {};
  for (const token of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [mod, val] = token.split('=');
    const key = mod as ModuleKey;
    if (key in MODULE_FLAGS) state[key] = val === undefined ? true : val === 'true';
  }
  return state;
}
