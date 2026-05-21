/**
 * normalizeBaseUrl
 * 
 * Normalizes an environment URL to strictly its origin (scheme + host + port),
 * stripping any paths or trailing slashes. Throws an error if the URL is invalid.
 * 
 * @param {string} input - The raw URL string from UI or .env
 * @returns {string} The normalized root URL (e.g., "https://dev.agilewriter.com")
 */
function normalizeBaseUrl(input) {
  if (typeof input !== 'string') {
    throw new Error('BASEURL must be a string');
  }

  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('BASEURL must start with http:// or https://');
  }

  try {
    const url = new URL(trimmed);
    return url.origin;
  } catch (e) {
    throw new Error('Invalid URL format');
  }
}

module.exports = { normalizeBaseUrl };
