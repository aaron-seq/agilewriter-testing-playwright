import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const CONFIG_FILE = 'runtime-config.json';

type HealthConfig = {
  reportName: string;
  templateName: string;
  templateFolder: string;
  sourceNames: string[];
  sourceFolder: string;
  outputPrefix: string;
  expectedTrainingMinutes: number;
  templateTab?: 'Clinical' | 'Non-Clinical';
};

type HealthConfigs = {
  csr: HealthConfig;
  m264: HealthConfig;
  icfFull: HealthConfig;
  icfTrimmed: HealthConfig;
};

type Config = {
  testerName: string;
  envName: string;
  email: string;
  password: string;
  baseUrl: string;
  appUrl: string;
  template: string;
  source: string;
  folder: string;
  health: HealthConfigs;
  /** Manual input fields - used by AW_11_to_20_manual_input.spec.ts */
  manualTemplateName?: string;
  manualTemplateFolder?: string;
  manualTemplateTab?: 'Clinical' | 'Non-Clinical';
  manualSourceFiles?: Array<{ name: string; folder: string }>;
  useQaFolderForSources?: boolean;
  generatedScriptName?: string;
};

function csv(value: string): string[] {
  return value.split(',').map((item) => item.trim());
}

function defaultHealthConfigs(): HealthConfigs {
  return {
    csr: {
      reportName: 'CSR',
      templateName: process.env.HEALTH_TEMPLATE_CSR || 'CSR_Template_20FEB2026.docx',
      templateFolder: process.env.HEALTH_TEMPLATE_FOLDER_CSR || 'CSR',
      sourceNames: csv(
        process.env.HEALTH_SOURCES_CSR ||
          'Mock_CSR _Tables_30Oct25.rtf,Mock_CSR_Protocol.docx,Mock_CSR Key messages_with_heading.docx'
      ),
      sourceFolder: process.env.HEALTH_SOURCE_FOLDER_CSR || 'CSR',
      outputPrefix: process.env.HEALTH_OUTPUT_PREFIX_CSR || 'CSR_Test',
      expectedTrainingMinutes: 20,
    },
    m264: {
      reportName: 'M264 (Module 2.6.4)',
      templateName: process.env.HEALTH_TEMPLATE_M264 || '2.6.4 Template_Test.docx',
      templateFolder: process.env.HEALTH_TEMPLATE_FOLDER_M264 || 'M264',
      sourceNames: csv(
        process.env.HEALTH_SOURCES_M264 ||
          'Absorption_PK Study in Dog.docx,Metabolism_Report.docx,ABC-123_Summary and Conclusion.docx,DDI_Cyp_Report.docx,ABC-123_Method of Analysis.docx,Distribution_Blood Partitioning.docx,Absorption_PK Study in Rat.docx'
      ),
      sourceFolder: process.env.HEALTH_SOURCE_FOLDER_M264 || 'M264',
      outputPrefix: process.env.HEALTH_OUTPUT_PREFIX_M264 || 'M264_Test',
      expectedTrainingMinutes: 25,
      templateTab: 'Non-Clinical',
    },
    icfFull: {
      reportName: 'ICF Full',
      templateName: process.env.HEALTH_TEMPLATE_ICF_FULL || 'ICF_SET0.docx',
      templateFolder:
        process.env.HEALTH_TEMPLATE_FOLDER_ICF_FULL || 'Informed Consent Form',
      sourceNames: csv(
        process.env.HEALTH_SOURCES_ICF_FULL || 'Protocol Example (28Sep2023).docx'
      ),
      sourceFolder: process.env.HEALTH_SOURCE_FOLDER_ICF_FULL || 'Protocol',
      outputPrefix: process.env.HEALTH_OUTPUT_PREFIX_ICF_FULL || 'ICF_Full',
      expectedTrainingMinutes: 15,
    },
    icfTrimmed: {
      reportName: 'ICF Trimmed',
      templateName:
        process.env.HEALTH_TEMPLATE_ICF_TRIMMED || 'ICF_SET0_TRIMMED.docx',
      templateFolder: process.env.HEALTH_TEMPLATE_FOLDER_ICF_TRIMMED || 'QA Testing',
      sourceNames: csv(
        process.env.HEALTH_SOURCES_ICF_TRIMMED ||
          'Protocol Example (28Sep2023)_trimmed.docx'
      ),
      sourceFolder: process.env.HEALTH_SOURCE_FOLDER_ICF_TRIMMED || 'Protocol',
      outputPrefix: process.env.HEALTH_OUTPUT_PREFIX_ICF_TRIMMED || 'ICF_Trimmed',
      expectedTrainingMinutes: 5,
    },
  };
}

function defaultConfig(): Config {
  return {
    testerName: process.env.TESTER_NAME || 'Default Tester',
    envName: process.env.TEST_ENV || 'QA',
    email: process.env.MS_EMAIL || '',
    password: process.env.MS_PASSWORD || '',
    baseUrl: process.env.BASE_URL || '',
    appUrl: process.env.APP_URL || '',
    template: process.env.HEALTH_TEMPLATE || '',
    source: process.env.HEALTH_SOURCES || '',
    folder: process.env.HEALTH_TEMPLATE_FOLDER || '',
    health: defaultHealthConfigs(),
  };
}

function mergeConfig(overrides: Partial<Config>): Config {
  const defaults = defaultConfig();

  return {
    ...defaults,
    ...overrides,
    health: {
      csr: { ...defaults.health.csr, ...overrides.health?.csr },
      m264: { ...defaults.health.m264, ...overrides.health?.m264 },
      icfFull: { ...defaults.health.icfFull, ...overrides.health?.icfFull },
      icfTrimmed: { ...defaults.health.icfTrimmed, ...overrides.health?.icfTrimmed },
    },
  };
}

function loadConfig(): Config {
  if (fs.existsSync(CONFIG_FILE)) {
    console.log('Using UI config');
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

    // Safety: if manualSourceFiles arrived as a comma-separated string,
    // convert it to the expected Array<{name, folder}> format.
    if (typeof raw.manualSourceFiles === 'string') {
      const folder = raw.manualTemplateFolder || raw.folder || '';
      raw.manualSourceFiles = raw.manualSourceFiles
        .split(',')
        .map((name: string) => name.trim())
        .filter(Boolean)
        .map((name: string) => ({ name, folder }));
    }

    return mergeConfig(raw);
  }

  console.log('Using .env config');
  return defaultConfig();
}

export const runtimeConfig = loadConfig();
