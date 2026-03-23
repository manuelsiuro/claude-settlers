import { applyBalanceOverrides } from './balanceConstants';
import type { BalanceConfigOverrides } from './balanceConstants';

const VALID_SECTIONS = new Set([
  'woodcutter', 'forester', 'geologist', 'trees', 'combat', 'upgrades',
  'victory', 'population', 'hunger', 'night', 'morale', 'animals',
  'marketplace', 'startingResources',
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
    // Skip metadata fields (e.g. _comment, generatedAt)
    if (key.startsWith('_') || key === 'generatedAt') continue;
    if (!VALID_SECTIONS.has(key)) {
      errors.push(`Unknown section: "${key}"`);
      continue;
    }
    if (key === 'marketplace') {
      const mp = obj[key];
      if (typeof mp !== 'object' || mp === null || Array.isArray(mp)) {
        errors.push('marketplace must be a non-null object');
        continue;
      }
      for (const [field, value] of Object.entries(mp as Record<string, unknown>)) {
        if (field === 'baseValues') {
          if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            errors.push('marketplace.baseValues must be a non-null object');
            continue;
          }
          for (const [res, val] of Object.entries(value as Record<string, unknown>)) {
            if (typeof val !== 'number') {
              errors.push(`marketplace.baseValues.${res} must be a number`);
            } else if (val < 0) {
              errors.push(`marketplace.baseValues.${res} must be >= 0`);
            }
          }
        } else if (field === 'castleTradeEnabled') {
          if (typeof value !== 'boolean') {
            errors.push('marketplace.castleTradeEnabled must be a boolean');
          }
        } else {
          if (typeof value !== 'number') {
            errors.push(`marketplace.${field} must be a number, got ${typeof value}`);
          } else if (value < 0) {
            errors.push(`marketplace.${field} must be >= 0`);
          }
        }
      }
      continue;
    }
    if (key === 'startingResources') {
      const sr = obj[key];
      if (typeof sr !== 'object' || sr === null || Array.isArray(sr)) {
        errors.push('startingResources must be a non-null object');
        continue;
      }
      const validDiffs = new Set(['easy', 'normal', 'hard']);
      for (const [diff, items] of Object.entries(sr as Record<string, unknown>)) {
        if (!validDiffs.has(diff)) {
          errors.push(`startingResources: unknown difficulty "${diff}"`);
          continue;
        }
        if (!Array.isArray(items)) {
          errors.push(`startingResources.${diff} must be an array`);
          continue;
        }
        for (let i = 0; i < items.length; i++) {
          const item = items[i] as Record<string, unknown>;
          if (typeof item !== 'object' || item === null) {
            errors.push(`startingResources.${diff}[${i}] must be an object`);
            continue;
          }
          if (typeof item.resource !== 'string') {
            errors.push(`startingResources.${diff}[${i}].resource must be a string`);
          }
          if (typeof item.amount !== 'number' || !Number.isInteger(item.amount)) {
            errors.push(`startingResources.${diff}[${i}].amount must be an integer`);
          } else if (item.amount < 0) {
            errors.push(`startingResources.${diff}[${i}].amount must be >= 0`);
          }
        }
      }
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
