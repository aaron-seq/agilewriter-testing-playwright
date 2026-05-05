'use strict';

const fs = require('fs');
const path = require('path');

const API_BASE_URL = process.env.ACCURACY_SERVER_URL || 'http://localhost:3000';
const ROOT_DIR = path.join(__dirname, '..');
const RAW_QA_DIR = path.join(ROOT_DIR, 'raw_qa_files');
const REFERENCE_DIR = path.join(ROOT_DIR, 'reference_files');
const SEEDED_QA_FILE = 'QA report_ICF_FULL_new version.xlsx';

function logPass(step, detail) {
  console.log(`PASS | ${step} | ${detail}`);
}

function logFail(step, detail) {
  console.error(`FAIL | ${step} | ${detail}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function getJson(routePath) {
  const response = await fetch(`${API_BASE_URL}${routePath}`);
  const json = await response.json();
  return { response, json };
}

async function seedRawQaFolderIfNeeded() {
  if (!fs.existsSync(RAW_QA_DIR)) {
    fs.mkdirSync(RAW_QA_DIR, { recursive: true });
  }

  const existingQaFiles = fs
    .readdirSync(RAW_QA_DIR)
    .filter((fileName) => fileName.toLowerCase().endsWith('.xlsx'));
  if (existingQaFiles.length > 0) {
    return existingQaFiles[0];
  }

  const rootSeedPath = path.join(ROOT_DIR, SEEDED_QA_FILE);
  if (!fs.existsSync(rootSeedPath)) {
    return null;
  }

  const copiedPath = path.join(RAW_QA_DIR, SEEDED_QA_FILE);
  // We copy a known-good workbook into raw_qa_files so the scoring route can be exercised end to end.
  fs.copyFileSync(rootSeedPath, copiedPath);
  return SEEDED_QA_FILE;
}

async function main() {
  require('ts-node').register({
    transpileOnly: true,
    skipProject: true,
    compilerOptions: {
      module: 'Node16',
      moduleResolution: 'node16',
      target: 'ES2022',
      esModuleInterop: true,
      ignoreDeprecations: '6.0',
    },
  });

  const { normalizeForCompare } = require(path.join(
    ROOT_DIR,
    'tests',
    'helpers',
    'accuracy-scorer.ts'
  ));

  assert(
    normalizeForCompare('Stendarr, Inc.\r\n') === normalizeForCompare('Stendarr, Inc.'),
    'normalizeForCompare should collapse Windows line endings before comparison.'
  );
  logPass('normalizeForCompare', 'CRLF normalization matches canonical text.');

  const seededRawQaFile = await seedRawQaFolderIfNeeded();

  const refs = await getJson('/api/accuracy/reference-files');
  assert(refs.response.status === 200, `Expected 200, got ${refs.response.status}`);
  assert(Array.isArray(refs.json.files), 'reference-files response must contain a files array.');
  logPass('GET /api/accuracy/reference-files', `Found ${refs.json.files.length} reference file(s).`);

  const rawFiles = await getJson('/api/accuracy/raw-qa-files');
  assert(rawFiles.response.status === 200, `Expected 200, got ${rawFiles.response.status}`);
  assert(Array.isArray(rawFiles.json.files), 'raw-qa-files response must contain a files array.');
  logPass('GET /api/accuracy/raw-qa-files', `Found ${rawFiles.json.files.length} raw QA file(s).`);

  let scoredResult = null;
  const referenceFile = refs.json.files.find((fileName) => /icf/i.test(fileName)) || refs.json.files[0];
  const rawQaFile =
    rawFiles.json.files.find((fileName) => /icf/i.test(fileName)) ||
    seededRawQaFile ||
    rawFiles.json.files[0];

  if (referenceFile && rawQaFile) {
    const scoreResponse = await fetch(`${API_BASE_URL}/api/accuracy/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referenceFile,
        rawQAFile: rawQaFile,
      }),
    });
    const scoreJson = await scoreResponse.json();
    assert(scoreResponse.status === 200, `Expected 200, got ${scoreResponse.status}`);
    assert(
      scoreJson.summary && typeof scoreJson.summary.overall === 'number',
      'score response must include summary.overall.'
    );
    assert(scoreJson.summary.overall >= 0, 'summary.overall must be >= 0.');
    scoredResult = scoreJson;
    logPass(
      'POST /api/accuracy/score',
      `Overall accuracy ${scoreJson.summary.overall.toFixed(4)} across ${scoreJson.rowCount} row(s).`
    );

    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/api/accuracy/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceFile, rawQAFile: rawQaFile }),
      }),
      fetch(`${API_BASE_URL}/api/accuracy/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceFile, rawQAFile: rawQaFile }),
      }),
    ]);

    const statuses = [firstResponse.status, secondResponse.status].sort();
    assert(
      statuses[0] === 200 && statuses[1] === 429,
      `Expected one 200 and one 429 during concurrency test, got ${statuses.join(', ')}.`
    );
    logPass('POST /api/accuracy/score concurrency', 'One scoring request was rejected with HTTP 429.');
  } else {
    console.warn(
      'SKIP | POST /api/accuracy/score | No compatible reference/raw QA pair was available.'
    );
  }

  const results = await getJson('/api/accuracy/results');
  assert(results.response.status === 200, `Expected 200, got ${results.response.status}`);
  assert(Array.isArray(results.json.files), 'results response must contain a files array.');
  logPass('GET /api/accuracy/results', `Found ${results.json.files.length} result file(s).`);

  const downloadableName =
    (results.json.items || []).find((item) => item.name.endsWith('.xlsx'))?.name ||
    results.json.files.find((fileName) => fileName.endsWith('.xlsx')) ||
    scoredResult?.excelPath?.split('/').pop();

  if (downloadableName) {
    const downloadResponse = await fetch(
      `${API_BASE_URL}/api/accuracy/download/${encodeURIComponent(downloadableName)}`
    );
    assert(downloadResponse.status === 200, `Expected 200, got ${downloadResponse.status}`);
    logPass('GET /api/accuracy/download/:filename', `Downloaded ${downloadableName}.`);
  } else {
    console.warn(
      'SKIP | GET /api/accuracy/download/:filename | No downloadable accuracy report was available.'
    );
  }

  console.log('All requested accuracy route checks completed.');
}

main().catch((error) => {
  logFail('accuracy-route-smoke', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
