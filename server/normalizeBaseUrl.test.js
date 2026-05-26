const assert = require('assert');
const { normalizeBaseUrl } = require('./normalizeBaseUrl');

function runTests() {
  console.log('Running normalizeBaseUrl tests...');

  // Test 1: Standard URL
  assert.strictEqual(
    normalizeBaseUrl('https://dev.agilewriter.com'),
    'https://dev.agilewriter.com',
    'Failed to preserve standard URL'
  );

  // Test 2: Stripping paths
  assert.strictEqual(
    normalizeBaseUrl('http://localhost:3000/signin'),
    'http://localhost:3000',
    'Failed to strip path'
  );

  // Test 3: Stripping trailing slash
  assert.strictEqual(
    normalizeBaseUrl('https://app-v2-rc1-aw.smarter.codes/'),
    'https://app-v2-rc1-aw.smarter.codes',
    'Failed to strip trailing slash'
  );

  // Test 4: Trimming whitespace
  assert.strictEqual(
    normalizeBaseUrl('  https://dev.agilewriter.com/signin/  '),
    'https://dev.agilewriter.com',
    'Failed to trim whitespace and strip path'
  );

  // Test 5: Missing protocol throws error
  assert.throws(
    () => normalizeBaseUrl('dev.agilewriter.com'),
    /BASEURL must start with http:\/\/ or https:\/\//,
    'Failed to throw on missing protocol'
  );

  // Test 6: Invalid URL throws error
  assert.throws(
    () => normalizeBaseUrl('https://'),
    /Invalid URL format/,
    'Failed to throw on empty host'
  );

  // Test 7: Non-string throws error
  assert.throws(
    () => normalizeBaseUrl(null),
    /BASEURL must be a string/,
    'Failed to throw on null input'
  );

  console.log('All normalizeBaseUrl tests passed successfully!');
}

runTests();
