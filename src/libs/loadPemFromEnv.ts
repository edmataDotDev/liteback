/**
 * PEM read from `process.env` after dotenv parsing (real newlines or `\n` escapes).
 */
export function loadPemFromEnv(raw: string | undefined, varName: string): string {
  if (raw == null || raw.trim() === '') {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
  const normalized = raw.trim().replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  if (!normalized.includes('BEGIN')) {
    throw new Error(`${varName} must be a PEM string (expected BEGIN … line)`);
  }
  return normalized;
}
