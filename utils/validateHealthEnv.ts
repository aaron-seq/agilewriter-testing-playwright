// Typed wrapper over validateHealthEnv.js.
// REQUIRED_VARS and HEALTH_SPEC_CONFIG_MAP live in the .js only — adding a
// health suite is a one-file change there, not two files kept in sync.

const impl = require('./validateHealthEnv.js') as {
  validateHealthEnv: (configKey: string) => void;
};

export type HealthConfigKey =
  | 'csr'
  | 'icfFull'
  | 'icfTrimmed'
  | 'ideaya'
  | 'ideayaPreflight'
  | 'ideayaProdtestCsr'
  | 'm264';

export function validateHealthEnv(configKey: HealthConfigKey): void {
  impl.validateHealthEnv(configKey);
}
