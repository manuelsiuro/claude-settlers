import { applyBalanceOverrides } from './balanceConstants';
import type { BalanceConfigOverrides } from './balanceConstants';

const VALID_SECTIONS = new Set([
  'woodcutter', 'forester', 'geologist', 'trees', 'combat', 'upgrades',
  'victory', 'population', 'hunger', 'night', 'morale', 'animals',
]);

/** Validate a balance config JSON object. Returns an array of error strings. */
export function validateBalanceConfig(config: unknown): string[] {
  const errors: string[] = [];
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    errors.push('Config must be a non-null object');
    return errors;
  }

  const obj = config as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!VALID_SECTIONS.has(key)) {
      errors.push(`Unknown section: "${key}"`);
      continue;
    }
    const section = obj[key];
    if (typeof section !== 'object' || section === null || Array.isArray(section)) {
      errors.push(`Section "${key}" must be a non-null object`);
      continue;
    }
    for (const [field, value] of Object.entries(section as Record<string, unknown>)) {
      if (typeof value !== 'number') {
        errors.push(`${key}.${field} must be a number, got ${typeof value}`);
        continue;
      }
      if (value < 0) {
        errors.push(`${key}.${field} must be >= 0`);
      }
    }
  }

  return errors;
}

/**
 * Attempt to load balance_config.json from the server root.
 * Returns true if overrides were applied, false otherwise.
 * Silently returns false if the file doesn't exist (404).
 */
export async function loadBalanceConfig(): Promise<boolean> {
  try {
    const resp = await fetch('/balance_config.json');
    if (!resp.ok) return false;
    const config = await resp.json();
    const errors = validateBalanceConfig(config);
    if (errors.length > 0) {
      console.warn('Balance config validation errors:', errors);
      return false;
    }
    applyBalanceOverrides(config as BalanceConfigOverrides);
    console.log('Balance config loaded successfully');
    return true;
  } catch {
    return false;
  }
}
