import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const CONFIG_FILE = 'runtime-config.json';

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
};

function loadConfig(): Config {
  if (fs.existsSync(CONFIG_FILE)) {
    console.log(' ✔ Using UI config');
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  }

  console.log(' ✔ Using .env config');

  return {
    testerName: process.env.TESTER_NAME || 'Default Tester',
    envName: process.env.TEST_ENV || 'QA',
    email: process.env.MS_EMAIL!,
    password: process.env.MS_PASSWORD!,
    baseUrl: process.env.BASE_URL!,
    appUrl: process.env.APP_URL!,
    template: process.env.HEALTH_TEMPLATE || '',
    source: process.env.HEALTH_SOURCES || '',
    folder: process.env.HEALTH_TEMPLATE_FOLDER || '',
  };
}

export const runtimeConfig = loadConfig();