import { test, expect } from '@playwright/test';

const { normalizeBaseUrl } = require('../normalizeBaseUrl');

test.describe('normalizeBaseUrl()', () => {
  test('preserves a standard URL', () => {
    expect(normalizeBaseUrl('https://dev.agilewriter.com')).toBe('https://dev.agilewriter.com');
  });

  test('strips the path', () => {
    expect(normalizeBaseUrl('http://localhost:3000/signin')).toBe('http://localhost:3000');
  });

  test('strips a trailing slash', () => {
    expect(normalizeBaseUrl('https://app-v2-rc1-aw.smarter.codes/')).toBe(
      'https://app-v2-rc1-aw.smarter.codes'
    );
  });

  test('trims whitespace and strips the path', () => {
    expect(normalizeBaseUrl('  https://dev.agilewriter.com/signin/  ')).toBe(
      'https://dev.agilewriter.com'
    );
  });

  test('throws when the protocol is missing', () => {
    expect(() => normalizeBaseUrl('dev.agilewriter.com')).toThrow(
      /BASEURL must start with http:\/\/ or https:\/\//
    );
  });

  test('throws on an empty host', () => {
    expect(() => normalizeBaseUrl('https://')).toThrow(/Invalid URL format/);
  });

  test('throws on a non-string input', () => {
    expect(() => normalizeBaseUrl(null)).toThrow(/BASEURL must be a string/);
  });
});
