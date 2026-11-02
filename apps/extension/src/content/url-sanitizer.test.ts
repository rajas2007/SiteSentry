import { describe, it, expect } from 'vitest';
import {
  isSensitiveParameter,
  sanitizeQueryString,
  sanitizeUrl,
} from './url-sanitizer';

describe('Content Script URL Sanitizer', () => {
  describe('isSensitiveParameter', () => {
    it('detects standard lowercase sensitive parameters', () => {
      expect(isSensitiveParameter('token')).toBe(true);
      expect(isSensitiveParameter('api_key')).toBe(true);
      expect(isSensitiveParameter('secret')).toBe(true);
      expect(isSensitiveParameter('password')).toBe(true);
    });

    it('detects case-insensitive variations', () => {
      expect(isSensitiveParameter('TOKEN')).toBe(true);
      expect(isSensitiveParameter('Api_Key')).toBe(true);
      expect(isSensitiveParameter('SECRET')).toBe(true);
    });

    it('detects percent-encoded and double-encoded parameter names', () => {
      // %74%6f%6b%65%6e is "token"
      expect(isSensitiveParameter('%74%6f%6b%65%6e')).toBe(true);
      // Double encoded: %2574%256f%256b%2565%256e
      expect(isSensitiveParameter('%2574%256f%256b%2565%256e')).toBe(true);
    });

    it('detects bracket-notation sensitive parameters', () => {
      expect(isSensitiveParameter('filter[token]')).toBe(true);
      expect(isSensitiveParameter('user[password]')).toBe(true);
      expect(isSensitiveParameter('auth[apiKey]')).toBe(true);
    });

    it('returns false for benign parameters', () => {
      expect(isSensitiveParameter('page')).toBe(false);
      expect(isSensitiveParameter('sort')).toBe(false);
      expect(isSensitiveParameter('q')).toBe(false);
      expect(isSensitiveParameter('category')).toBe(false);
      expect(isSensitiveParameter('')).toBe(false);
    });
  });

  describe('sanitizeQueryString', () => {
    it('removes sensitive parameters while preserving benign parameters and order', () => {
      const query = 'category=books&token=secret123&page=2&apiKey=ABC';
      expect(sanitizeQueryString(query)).toBe('category=books&page=2');
    });

    it('preserves duplicate benign parameters', () => {
      const query = 'tag=news&token=xyz&tag=tech&tag=ai';
      expect(sanitizeQueryString(query)).toBe('tag=news&tag=tech&tag=ai');
    });

    it('removes parameters with [REDACTED] in values', () => {
      const query = 'q=[REDACTED]&page=1';
      expect(sanitizeQueryString(query)).toBe('page=1');
    });
  });

  describe('sanitizeUrl', () => {
    it('strips authority username and password credentials', () => {
      const url = 'https://admin:supersecret@example.com/dashboard';
      expect(sanitizeUrl(url)).toBe('https://example.com/dashboard');
    });

    it('strips URL fragments completely', () => {
      const url = 'https://example.com/docs#access_token=secret_jwt';
      expect(sanitizeUrl(url)).toBe('https://example.com/docs');
    });

    it('strips sensitive query parameters, bracketed keys, and casing variants', () => {
      const url =
        'https://example.com/api?user[password]=secret&TOKEN=abc&page=5&%74%6f%6b%65%6e=xyz';
      expect(sanitizeUrl(url)).toBe('https://example.com/api?page=5');
    });

    it('preserves path case, port numbers, and benign query structure', () => {
      const url =
        'https://example.com:8443/MyService/DeepPath/?filter=active&sort=desc';
      expect(sanitizeUrl(url)).toBe(
        'https://example.com:8443/MyService/DeepPath/?filter=active&sort=desc'
      );
    });

    it('preserves duplicate benign query parameters in order', () => {
      const url = 'https://example.com/search?tag=first&tag=second&tag=third';
      expect(sanitizeUrl(url)).toBe(
        'https://example.com/search?tag=first&tag=second&tag=third'
      );
    });

    it('rejects non-HTTP/HTTPS schemes and returns null', () => {
      expect(sanitizeUrl('file:///C:/Users/name/secret.txt')).toBeNull();
      expect(sanitizeUrl('about:blank')).toBeNull();
      expect(sanitizeUrl('chrome://settings')).toBeNull();
      expect(sanitizeUrl('chrome-extension://abcdef/popup.html')).toBeNull();
      expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
      expect(sanitizeUrl('ftp://ftp.example.com')).toBeNull();
    });

    it('rejects control characters (CRLF / null bytes) and returns null', () => {
      expect(sanitizeUrl('https://example.com/path\r\ninjection')).toBeNull();
      expect(sanitizeUrl('https://example.com/path\0null')).toBeNull();
    });

    it('returns null for empty or non-string inputs', () => {
      expect(sanitizeUrl('')).toBeNull();
      expect(sanitizeUrl('   ')).toBeNull();
      expect(sanitizeUrl(null as unknown as string)).toBeNull();
      expect(sanitizeUrl(undefined as unknown as string)).toBeNull();
    });
  });
});
