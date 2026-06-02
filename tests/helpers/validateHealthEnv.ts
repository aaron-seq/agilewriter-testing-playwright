/**
 * validateHealthEnv.ts — Health Env Var Validator (STUB — SCC-177 Red Phase)
 *
 * This file exports validateHealthEnv() which will validate that all required
 * environment variables for a given health config key are set.
 *
 * STUB: Throws 'Not implemented' for all calls. SCC-178 Green Phase will
 * implement the real logic.
 */

export type HealthConfigKey =
  | 'csr'
  | 'icfFull'
  | 'icfTrimmed'
  | 'ideaya'
  | 'ideayaPreflight'
  | 'm264';

/**
 * Validates that all required environment variables for a given health config
 * are set (non-empty strings). Throws with a human-readable message listing
 * all missing vars if any are absent.
 *
 * @param configKey - The health config key to validate (e.g., 'ideaya', 'icfTrimmed')
 * @throws Error with missing var names if validation fails
 */
export function validateHealthEnv(configKey: HealthConfigKey): void {
  throw new Error('Not implemented');
}
