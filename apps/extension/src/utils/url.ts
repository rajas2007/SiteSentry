/**
 * Client-Side URL Sanitization Utilities for Site Sentry Extension.
 *
 * Guarantees:
 * - Strips username and password authority credentials.
 * - Strips URL fragments (#...).
 * - Completely removes sensitive query parameters (including casing variants,
 *   single/double percent-encoded names, and bracket notation).
 * - Preserves benign query parameters, duplicate parameters, parameter order, and path casing.
 * - Restricts allowed schemes strictly to HTTP and HTTPS.
 * - Fails safely on invalid or malformed inputs by returning null without leaking raw data.
 */

export const DEFAULT_SENSITIVE_PARAMS: ReadonlySet<string> = new Set([
  'access_token',
  'api_key',
  'apikey',
  'auth',
  'client_secret',
  'code',
  'id_token',
  'jwt',
  'key',
  'magic_link',
  'pass',
  'password',
  'pwd',
  'refresh_token',
  'reset',
  'reset_token',
  'secret',
  'session',
  'sessionid',
  'sid',
  'sig',
  'signature',
  'state',
  'token',
]);

const BRACKET_KEY_RE = /^[a-zA-Z0-9_\-]+\[([a-zA-Z0-9_\-]+)\]$/;
const CONTROL_CHARS_RE = /[\r\n\0]/;

/**
 * Determine whether a query parameter key represents a sensitive token or credential.
 *
 * Evaluates exact match, casing variations, iterative percent-encoded keys,
 * and structured bracket notation (e.g. 'filter[token]').
 */
export function isSensitiveParameter(
  paramName: string,
  sensitiveParams: ReadonlySet<string> = DEFAULT_SENSITIVE_PARAMS
): boolean {
  if (!paramName) return false;

  let decoded = paramName.trim();
  try {
    decoded = decodeURIComponent(decoded).trim();
    while (decoded.includes('%')) {
      const next = decodeURIComponent(decoded).trim();
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    // Malformed percent-encoding: proceed with current decoded state
  }

  const cleanKey = decoded.toLowerCase();
  if (sensitiveParams.has(cleanKey)) {
    return true;
  }

  const bracketMatch = cleanKey.match(BRACKET_KEY_RE);
  if (bracketMatch && sensitiveParams.has(bracketMatch[1].toLowerCase())) {
    return true;
  }

  return false;
}

/**
 * Sanitize an HTTP query string by completely removing sensitive parameters and redaction tokens.
 *
 * Preserves parameter order, duplicate benign parameters, and casing of benign keys and values.
 */
export function sanitizeQueryString(
  query: string,
  sensitiveParams: ReadonlySet<string> = DEFAULT_SENSITIVE_PARAMS
): string {
  if (!query) return '';

  const pairs = query.split('&');
  const sanitizedPairs: string[] = [];

  for (const pair of pairs) {
    if (!pair) continue;

    const eqIdx = pair.indexOf('=');
    const key = eqIdx !== -1 ? pair.slice(0, eqIdx) : pair;
    const val = eqIdx !== -1 ? pair.slice(eqIdx + 1) : '';

    if (
      isSensitiveParameter(key, sensitiveParams) ||
      val.includes('[REDACTED]') ||
      pair.includes('[REDACTED]')
    ) {
      continue;
    }

    sanitizedPairs.push(pair);
  }

  return sanitizedPairs.join('&');
}

/**
 * Sanitize a URL for extension transmission, telemetry, and storage.
 *
 * Enforces:
 * 1. Rejects non-string, empty, or control-character-laden input.
 * 2. Enforces strictly HTTP or HTTPS scheme.
 * 3. Strips authority user:password credentials.
 * 4. Completely removes URL fragments.
 * 5. Removes sensitive query parameters while preserving path case, order, and duplicate benign keys.
 *
 * @param rawUrl The raw URL string to sanitize.
 * @returns Clean sanitized URL string, or null if the URL is invalid or unsupported.
 */
export function sanitizeUrl(
  rawUrl: string,
  sensitiveParams: ReadonlySet<string> = DEFAULT_SENSITIVE_PARAMS
): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return null;
  }

  if (CONTROL_CHARS_RE.test(rawUrl)) {
    return null;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  // Strictly enforce HTTP or HTTPS scheme
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  // Strip authority credentials
  parsed.username = '';
  parsed.password = '';

  // Strip fragment
  parsed.hash = '';

  // Sanitize query string
  if (parsed.search && parsed.search.length > 1) {
    const rawQuery = parsed.search.slice(1);
    const cleanQuery = sanitizeQueryString(rawQuery, sensitiveParams);
    parsed.search = cleanQuery ? `?${cleanQuery}` : '';
  }

  return parsed.toString();
}
