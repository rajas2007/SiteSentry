/**
 * URL and Privacy Sanitization Utilities for Site Sentry Dashboard.
 *
 * Guarantees:
 * - Strips username and password credentials from URLs before rendering or caching.
 * - Strips URL fragments (#...) to prevent token leakage.
 * - Completely removes sensitive query parameters (including casing variants,
 *   iterative percent-encoded keys, and bracket notation).
 * - Strips legacy residual [REDACTED] tokens.
 * - Preserves benign query parameters, duplicate keys, parameter order, and path casing.
 * - Enforces strictly HTTP and HTTPS schemes for external navigation.
 * - Rejects dangerous protocols (javascript:, data:, vbscript:, etc.).
 * - Protects CSV exports against CSV formula injection (DDE).
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
 * Sanitize a URL for dashboard display, detail drawers, exports, and API transmission.
 *
 * 1. Safely handles missing/empty/invalid strings without throwing.
 * 2. Rejects dangerous control characters.
 * 3. Enforces HTTP or HTTPS protocol; rejects non-web schemes.
 * 4. Strips authority credentials (user:password).
 * 5. Strips URL fragments (#...).
 * 6. Completely strips sensitive query parameters and legacy redaction tokens.
 * 7. Preserves benign query parameters, casing, and duplicate keys.
 *
 * @param rawUrl The URL to sanitize.
 * @param fallback Optional fallback string if the URL is invalid or unsafe.
 * @returns Clean sanitized URL string.
 */
export function sanitizeUrlForDisplay(
  rawUrl: string,
  fallback: string = ''
): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return fallback;
  }

  if (CONTROL_CHARS_RE.test(rawUrl)) {
    return fallback;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return fallback;
  }

  let parsed: URL;
  try {
    if (trimmed.includes('://')) {
      parsed = new URL(trimmed);
    } else {
      // Check if it looks like an unsafe pseudo-scheme (e.g. 'javascript:alert(1)')
      const colonIdx = trimmed.indexOf(':');
      const slashIdx = trimmed.indexOf('/');
      if (colonIdx !== -1 && (slashIdx === -1 || colonIdx < slashIdx)) {
        return fallback;
      }
      parsed = new URL(`https://${trimmed}`);
    }
  } catch {
    return fallback;
  }

  // Strictly enforce HTTP or HTTPS scheme
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return fallback;
  }

  // Strip authority credentials
  parsed.username = '';
  parsed.password = '';

  // Strip fragment
  parsed.hash = '';

  // Sanitize query string
  if (parsed.search && parsed.search.length > 1) {
    const rawQuery = parsed.search.slice(1);
    const cleanQuery = sanitizeQueryString(rawQuery);
    parsed.search = cleanQuery ? `?${cleanQuery}` : '';
  } else if (parsed.search === '?') {
    parsed.search = '';
  }

  let result = parsed.toString();

  // If original input had no trailing slash on bare domain, preserve absence of trailing slash
  if (parsed.pathname === '/' && !parsed.search && !parsed.hash) {
    const authorityAndPath = trimmed.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
    const firstSlash = authorityAndPath.indexOf('/');
    if (firstSlash === -1) {
      result = result.replace(/\/$/, '');
    }
  }

  return result;
}

/**
 * Validate whether a URL is safe for external navigation (e.g. in <a href="..." target="_blank">).
 *
 * Must be a well-formed URL with an HTTP or HTTPS protocol and non-empty hostname.
 * Strictly rejects javascript:, data:, vbscript:, and control characters.
 */
export function isSafeExternalUrl(rawUrl: string | null | undefined): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return false;
  }

  if (CONTROL_CHARS_RE.test(rawUrl)) {
    return false;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      Boolean(parsed.hostname)
    );
  } catch {
    return false;
  }
}

/**
 * Escape and format a value for safe CSV export.
 *
 * Protects against CSV Formula Injection (DDE) by prefixing formulas
 * starting with '=', '+', '-', '@', tab, or carriage return with a single quote (').
 * Properly escapes double quotes per RFC 4180.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value);

  // Prevent formula injection in Excel / Google Sheets / LibreOffice
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}
