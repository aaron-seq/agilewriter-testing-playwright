const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

/**
 * Checks if Google Cloud Storage is properly configured in the environment.
 * Requires both GCS_BUCKET and GOOGLE_APPLICATION_CREDENTIALS to be set.
 */
function isGcsConfigured() {
  return !!(process.env.GCS_BUCKET && process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

/**
 * Uploads a local file to Google Cloud Storage.
 * 
 * CONTRACT: This function is FAIL-SOFT. It must never throw an error that crashes the caller.
 * If GCS is unconfigured, or the local file is missing, or the bucket is unreachable,
 * it simply logs a warning and returns null.
 * 
 * @param {string} localPath - The absolute path to the local file to upload
 * @param {string} remotePath - The destination path in the GCS bucket (e.g. 'qa/reports/test.docx')
 * @returns {Promise<string|null>} - The remote path if successful, otherwise null
 */
async function uploadToGcs(localPath, remotePath) {
  if (!isGcsConfigured()) {
    // Silent skip when GCS is explicitly unconfigured
    return null;
  }

  if (!fs.existsSync(localPath)) {
    console.warn(`[GCS] Skip: local file not found: ${localPath}`);
    return null;
  }

  try {
    const storage = new Storage();
    const bucket = storage.bucket(process.env.GCS_BUCKET);
    
    // Prefix with environment if configured (e.g. 'qa/')
    const prefix = process.env.GCS_ENV_PREFIX || '';
    // Ensure we don't double-slash if prefix already has trailing slash or remotePath has leading
    const cleanPrefix = prefix && !prefix.endsWith('/') ? prefix + '/' : prefix;
    const cleanRemote = remotePath.startsWith('/') ? remotePath.slice(1) : remotePath;
    const finalDestination = cleanPrefix + cleanRemote;

    await bucket.upload(localPath, { destination: finalDestination });
    console.log(`[GCS] Successfully uploaded to: gs://${process.env.GCS_BUCKET}/${finalDestination}`);
    return finalDestination;
    
  } catch (err) {
    // SECURITY: Google API 403 errors embed the service account email in err.message.
    // We must strip identifiable information before logging.
    const rawMessage = err.message || String(err);
    const safeMessage = rawMessage
      .replace(/[\w.-]+@[\w.-]+\.iam\.gserviceaccount\.com/g, '[REDACTED_SA]')
      .replace(/"private_key":\s*"[^"]*"/g, '"private_key": "[REDACTED]"')
      .replace(/"client_email":\s*"[^"]*"/g, '"client_email": "[REDACTED]"');
    console.error(`[GCS] Upload failed for ${remotePath}: ${safeMessage}`);
    return null;
  }
}

module.exports = {
  isGcsConfigured,
  uploadToGcs
};
