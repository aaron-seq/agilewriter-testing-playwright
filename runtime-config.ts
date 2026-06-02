import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '.env') });

const CONFIG_FILE = process.env.SESSION_ID
  ? `sessions/${process.env.SESSION_ID}/runtime-config.json`
  : 'runtime-config.json';


type HealthConfig = {
  reportName: string;
  clientName?: string;
  templateName: string;
  templateSearchTerm?: string;
  templateParentFolder?: string;
  templateFolder: string;
  sourceNames: string[];
  sourceFolder?: string;
  outputPrefix: string;
  expectedTrainingMinutes: number;
  templateTab?: 'Clinical' | 'Non-Clinical';
  sourceSelectionMode?: 'file' | 'folder';
  sourceParentFolder?: string;
  sourceNestedFolders?: string[];
  sourceFolders?: string[];
  allowMissingSourcesSoft?: boolean;
  stopBeforeTraining?: boolean;
};

type HealthConfigs = {
  csr: HealthConfig;
  m264: HealthConfig;
  icfFull: HealthConfig;
  icfTrimmed: HealthConfig;
  ideaya: HealthConfig;
  ideayaPreflight: HealthConfig;
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
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return /^(true|1|yes)$/i.test(value.trim());
}

function defaultHealthConfigs(): HealthConfigs {
  const ideayaPreflightTemplate =
    process.env.HEALTH_TEMPLATE_IDEAYA_PREFLIGHT ||
    'IDE196-009 Clinical Study Report_Template_27May_updated.docx';

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
      sourceFolder: process.env.HEALTH_SOURCE_FOLDER_M264 || 'Module264',
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
    ideaya: {
      reportName: 'Ideaya',
      templateName: process.env.HEALTH_TEMPLATE_IDEAYA || 'IDE196-001_CSR_Destination Template_18May2026_Final.docx',
      templateFolder: process.env.HEALTH_TEMPLATE_FOLDER_IDEAYA || 'Template for SC',
      sourceNames: csv(process.env.HEALTH_SOURCE_FILE_IDEAYA || 'IDE196 Investigators Brochure_v13.pdf'),
      outputPrefix: process.env.HEALTH_OUTPUT_PREFIX_IDEAYA || 'Ideaya_CSR',
      expectedTrainingMinutes: parseInt(process.env.HEALTH_EXPECTED_MINUTES_IDEAYA || '30', 10),
      templateTab: 'Clinical',
      sourceSelectionMode: 'folder',
      sourceParentFolder: process.env.HEALTH_SOURCE_PARENT_FOLDER_IDEAYA || 'IDE196-001 TFLs',
      sourceNestedFolders: csv(process.env.HEALTH_SOURCE_NESTED_FOLDERS_IDEAYA || 'Efficacy Tables_Test_EP,Safety Tables_Test_EP,Test [From Synterex]'),
      allowMissingSourcesSoft: true,
    },
    ideayaPreflight: {
      reportName: 'Ideaya PRODTEST Preflight',
      clientName: process.env.HEALTH_CLIENT_IDEAYA_PREFLIGHT || 'PRODTEST',
      templateName: ideayaPreflightTemplate,
      templateSearchTerm: ideayaPreflightTemplate.replace(/\.docx$/i, ''),
      templateParentFolder:
        process.env.HEALTH_PARENT_FOLDER_IDEAYA_PREFLIGHT || 'IDE-196-009 CSR V1',
      templateFolder:
        process.env.HEALTH_TEMPLATE_FOLDER_IDEAYA_PREFLIGHT || 'Template for SC',
      sourceNames: [],
      outputPrefix: 'TEST_Ideaya',
      expectedTrainingMinutes: 30,
      templateTab: 'Clinical',
      sourceParentFolder: 'IDE196-009 TFLs',
      sourceFolders: csv(process.env.HEALTH_SOURCE_FOLDERS_IDEAYA || 'Tables_Test_EP'),
      stopBeforeTraining: bool(process.env.HEALTH_STOP_BEFORE_TRAINING_IDEAYA, true),
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
      ideaya: { ...defaults.health.ideaya, ...overrides.health?.ideaya },
      ideayaPreflight: { ...defaults.health.ideayaPreflight, ...overrides.health?.ideayaPreflight },
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
