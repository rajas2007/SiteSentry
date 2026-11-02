import { describe, it, expect } from 'vitest';
import {
  isSensitiveParameter,
  sanitizeQueryString,
  sanitizeUrlForDisplay,
  isSafeExternalUrl,
  escapeCsvCell,
} from './url';

describe('isSensitiveParameter', () => {
  it('identifies standard sensitive parameter names', () => {
    expect(isSensitiveParameter('token')).toBe(true);
    expect(isSensitiveParameter('api_key')).toBe(true);
    expect(isSensitiveParameter('apikey')).toBe(true);
    expect(isSensitiveParameter('password')).toBe(true);
    expect(isSensitiveParameter('secret')).toBe(true);
    expect(isSensitiveParameter('session')).toBe(true);
    expect(isSensitiveParameter('jwt')).toBe(true);
  });

  it('handles case-insensitivity', () => {
    expect(isSensitiveParameter('TOKEN')).toBe(true);
    expect(isSensitiveParameter('ApiKey')).toBe(true);
    expect(isSensitiveParameter('sEsSiOnId')).toBe(true);
  });

  it('handles single and double percent-encoded keys', () => {
    expect(isSensitiveParameter('%74oken')).toBe(true);
    expect(isSensitiveParameter('%2574oken')).toBe(true);
    expect(isSensitiveParameter('%61pi_key')).toBe(true);
  });

  it('identifies bracket notation parameters', () => {
    expect(isSensitiveParameter('filter[token]')).toBe(true);
    expect(isSensitiveParameter('user[password]')).toBe(true);
    expect(isSensitiveParameter('auth[secret]')).toBe(true);
  });

  it('does not flag benign parameters', () => {
    expect(isSensitiveParameter('page')).toBe(false);
    expect(isSensitiveParameter('limit')).toBe(false);
    expect(isSensitiveParameter('query')).toBe(false);
    expect(isSensitiveParameter('sort')).toBe(false);
    expect(isSensitiveParameter('search')).toBe(false);
  });
});

describe('sanitizeQueryString', () => {
  it('removes sensitive query parameters and preserves benign ones', () => {
    const raw = 'page=1&token=secret123&sort=asc&apiKey=xyz';
    const clean = sanitizeQueryString(raw);
    expect(clean).toBe('page=1&sort=asc');
  });

  it('preserves parameter order and duplicate benign parameters', () => {
    const raw = 'tag=security&token=abc&tag=privacy&limit=10';
    const clean = sanitizeQueryString(raw);
    expect(clean).toBe('tag=security&tag=privacy&limit=10');
  });

  it('completely removes residual [REDACTED] tokens from legacy data', () => {
    const raw = 'user=alice&session=[REDACTED]&tab=overview';
    const clean = sanitizeQueryString(raw);
    expect(clean).toBe('user=alice&tab=overview');
  });

  it('handles empty query string', () => {
    expect(sanitizeQueryString('')).toBe('');
  });
});

describe('sanitizeUrlForDisplay', () => {
  it('strips authority username and password credentials', () => {
    const url = 'https://alice:secret123@example.com/admin/dashboard';
    const result = sanitizeUrlForDisplay(url);
    expect(result).toBe('https://example.com/admin/dashboard');
    expect(result).not.toContain('alice');
    expect(result).not.toContain('secret123');
  });

  it('strips fragments', () => {
    const url = 'https://example.com/profile#access_token=jwt123';
    const result = sanitizeUrlForDisplay(url);
    expect(result).toBe('https://example.com/profile');
    expect(result).not.toContain('#');
  });

  it('completely removes sensitive query parameters and preserves benign ones', () => {
    const url = 'https://example.com/search?q=cyber&token=supersecret&page=2';
    const result = sanitizeUrlForDisplay(url);
    expect(result).toBe('https://example.com/search?q=cyber&page=2');
    expect(result).not.toContain('supersecret');
    expect(result).not.toContain('token');
  });

  it('preserves path casing and structure', () => {
    const url = 'https://example.com/Reports/Weekly/Summary.PDF?download=1';
    const result = sanitizeUrlForDisplay(url);
    expect(result).toBe('https://example.com/Reports/Weekly/Summary.PDF?download=1');
  });

  it('handles URLs without protocol by prepending https', () => {
    const url = 'example.com/dashboard?token=xyz&view=grid';
    const result = sanitizeUrlForDisplay(url);
    expect(result).toBe('https://example.com/dashboard?view=grid');
  });

  it('rejects unsafe schemes and returns fallback', () => {
    expect(sanitizeUrlForDisplay('javascript:alert(1)', 'fallback')).toBe('fallback');
    expect(sanitizeUrlForDisplay('data:text/html,<script>alert(1)</script>', 'fallback')).toBe('fallback');
    expect(sanitizeUrlForDisplay('vbscript:msgbox(1)', 'fallback')).toBe('fallback');
    expect(sanitizeUrlForDisplay('file:///etc/passwd', 'fallback')).toBe('fallback');
  });

  it('rejects control characters and returns fallback', () => {
    expect(sanitizeUrlForDisplay('https://example.com/\r\ntest', 'fallback')).toBe('fallback');
    expect(sanitizeUrlForDisplay('https://example.com/\0', 'fallback')).toBe('fallback');
  });

  it('handles empty or non-string inputs safely', () => {
    expect(sanitizeUrlForDisplay('', 'fallback')).toBe('fallback');
    expect(sanitizeUrlForDisplay(null as any, 'fallback')).toBe('fallback');
    expect(sanitizeUrlForDisplay(undefined as any, 'fallback')).toBe('fallback');
  });
});

describe('isSafeExternalUrl', () => {
  it('accepts valid http and https URLs', () => {
    expect(isSafeExternalUrl('https://example.com')).toBe(true);
    expect(isSafeExternalUrl('http://example.com/path?foo=bar')).toBe(true);
    expect(isSafeExternalUrl('https://sub.domain.org:8080/')).toBe(true);
  });

  it('strictly rejects dangerous schemes', () => {
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('data:text/html,test')).toBe(false);
    expect(isSafeExternalUrl('vbscript:msgbox')).toBe(false);
    expect(isSafeExternalUrl('file:///etc/hosts')).toBe(false);
  });

  it('rejects malformed inputs, control characters, and empty strings', () => {
    expect(isSafeExternalUrl('')).toBe(false);
    expect(isSafeExternalUrl('   ')).toBe(false);
    expect(isSafeExternalUrl(null)).toBe(false);
    expect(isSafeExternalUrl(undefined)).toBe(false);
    expect(isSafeExternalUrl('https://example.com/\r\n')).toBe(false);
    expect(isSafeExternalUrl('not-a-valid-url')).toBe(false);
  });
});

describe('escapeCsvCell', () => {
  it('quotes normal strings and numbers', () => {
    expect(escapeCsvCell('domain.com')).toBe('"domain.com"');
    expect(escapeCsvCell(95)).toBe('"95"');
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(undefined)).toBe('""');
  });

  it('escapes internal quotes', () => {
    expect(escapeCsvCell('He said "Hello"')).toBe('"He said ""Hello"""');
  });

  it('neutralizes formula injection triggers (=, +, -, @, tab, cr)', () => {
    expect(escapeCsvCell('=cmd|"/C calc"!A0')).toBe('"\'=cmd|""/C calc""!A0"');
    expect(escapeCsvCell('+12345')).toBe('"\'+12345"');
    expect(escapeCsvCell('-SUM(A1:A10)')).toBe('"\'-SUM(A1:A10)"');
    expect(escapeCsvCell('@HYPERLINK("http://evil.com")')).toBe('"\'@HYPERLINK(""http://evil.com"")"');
    expect(escapeCsvCell('\tmalicious')).toBe('"\'\tmalicious"');
  });
});
