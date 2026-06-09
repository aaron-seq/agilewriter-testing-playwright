// utils/validateHealthEnv.js
// CommonJS wrapper for server/test-runner-server.js
// TypeScript source of truth: utils/validateHealthEnv.ts
// ⚠️  Keep REQUIRED_VARS in sync with validateHealthEnv.ts
//     when adding new health configs
'use strict';

const REQUIRED_VARS = {
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

const HEALTH_SPEC_CONFIG_MAP = {
  'health_CSR.spec.ts':                  'csr',
  'health_ICF_full.spec.ts':             'icfFull',
  'health_ICF_trimmed.spec.ts':          'icfTrimmed',
  'health_Ideaya_preflight.spec.ts':     'ideayaPreflight',
  'health_Ideaya_PRODTEST_CSR.spec.ts':  'ideayaProdtestCsr',
  'health_Ideaya.spec.ts':               'ideaya',
  'health_M264.spec.ts':                 'm264',
};

/**
 * Returns array of missing env var names for the given config key.
 * Returns empty array if all vars are present.
 * Returns null if configKey is not in the map.
 */
function getMissingHealthEnvVars(configKey) {
  const required = REQUIRED_VARS[configKey];
  if (!required) return null;
  return required.filter((v) => !process.env[v] || !process.env[v].trim());
}

/**
 * Throws with a human-readable message listing all missing vars.
 * Used by health specs via utils/validateHealthEnv.ts (TypeScript version).
 * Also exported here for any JS consumers that need it.
 */
function validateHealthEnv(configKey) {
  const missing = getMissingHealthEnvVars(configKey);
  if (missing === null) {
    throw new Error(`[validateHealthEnv] Unknown config key: '${configKey}'`);
  }
  if (missing.length > 0) {
    throw new Error(
      `[validateHealthEnv] Missing required env vars for '${configKey}': ${missing.join(', ')}`
    );
  }
}

module.exports = { validateHealthEnv, getMissingHealthEnvVars, HEALTH_SPEC_CONFIG_MAP };
