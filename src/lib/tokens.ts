/**
 * Token storage. Tokens live in localStorage and never leave the browser.
 * This module is the only place that touches localStorage for credentials.
 */

export type TokenKey = 'github' | 'teamwork';

const STORAGE_PREFIX = 'devdash:token:';

export function getToken(key: TokenKey): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    return null;
  }
}

export function setToken(key: TokenKey, value: string): void {
  localStorage.setItem(STORAGE_PREFIX + key, value.trim());
}

export function clearToken(key: TokenKey): void {
  localStorage.removeItem(STORAGE_PREFIX + key);
}

export function hasToken(key: TokenKey): boolean {
  return Boolean(getToken(key));
}
