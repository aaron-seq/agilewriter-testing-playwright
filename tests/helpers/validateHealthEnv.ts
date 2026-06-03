export type HealthConfigKey =
  | 'csr'
  | 'icfFull'
  | 'icfTrimmed'
  | 'ideaya'
  | 'ideayaPreflight'
  | 'ideayaProdtestCsr'
  | 'm264';

const REQUIRED_VARS: Record<HealthConfigKey, string[]> = {
  csr: [
    'HEALTH_TEMPLATE_CSR',
    'HEALTH_TEMPLATE_FOLDER_CSR',
    'HEALTH_SOURCES_CSR',
    'HEALTH_SOURCE_FOLDER_CSR',
  ],
  icfFull: [
    'HEALTH_TEMPLATE_ICF_FULL',
    'HEALTH_TEMPLATE_FOLDER_ICF_FULL',
    'HEALTH_SOURCES_ICF_FULL',
    'HEALTH_SOURCE_FOLDER_ICF_FULL',
  ],
  icfTrimmed: [
    'HEALTH_TEMPLATE_ICF_TRIMMED',
    'HEALTH_TEMPLATE_FOLDER_ICF_TRIMMED',
    'HEALTH_SOURCES_ICF_TRIMMED',
    'HEALTH_SOURCE_FOLDER_ICF_TRIMMED',
  ],
  ideaya: [
    'HEALTH_TEMPLATE_IDEAYA',
    'HEALTH_TEMPLATE_FOLDER_IDEAYA',
    'HEALTH_SOURCE_FILE_IDEAYA',
    'HEALTH_SOURCE_PARENT_FOLDER_IDEAYA',
    'HEALTH_SOURCE_NESTED_FOLDERS_IDEAYA',
  ],
  ideayaPreflight: [
    'HEALTH_TEMPLATE_IDEAYA_PREFLIGHT',
    'HEALTH_TEMPLATE_FOLDER_IDEAYA_PREFLIGHT',
    'HEALTH_PARENT_FOLDER_IDEAYA_PREFLIGHT',
    'HEALTH_CLIENT_IDEAYA_PREFLIGHT',
  ],
  ideayaProdtestCsr: [
    'HEALTH_TEMPLATE_IDEAYA_PRODTEST_CSR',
    'HEALTH_TEMPLATE_FOLDER_IDEAYA_PRODTEST_CSR',
    'HEALTH_TEMPLATE_PARENT_FOLDER_IDEAYA_PRODTEST_CSR',
    'HEALTH_SOURCES_IDEAYA_PRODTEST_CSR',
    'HEALTH_SOURCE_PARENT_FOLDER_IDEAYA_PRODTEST_CSR',
  ],
  m264: [
    'HEALTH_TEMPLATE_M264',
    'HEALTH_TEMPLATE_FOLDER_M264',
    'HEALTH_SOURCES_M264',
    'HEALTH_SOURCE_FOLDER_M264',
  ],
};

export function validateHealthEnv(configKey: HealthConfigKey): void {
  const requiredVars = REQUIRED_VARS[configKey];
  const missingVars: string[] = [];

  for (const varName of requiredVars) {
    const val = process.env[varName];
    if (!val || val.trim() === '') {
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    throw new Error(
      `[validateHealthEnv] Missing required env vars for '${configKey}': ${missingVars.join(', ')}`
    );
  }
}
