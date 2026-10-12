import { describe, it, expect, vi, afterEach } from 'vitest';
import { safeSetItem } from './safeStorage';

function fakeStorage(failOnSet: boolean) {
  const data = new Map<string, string>([['k', 'ancien']]);
  return {
    data,
    setItem: (k: string, v: string) => { if (failOnSet) throw new DOMException('quota', 'QuotaExceededError'); data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

describe('safeSetItem', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('écrit normalement', () => {
    const s = fakeStorage(false); vi.stubGlobal('localStorage', s);
    expect(safeSetItem('k', 'nouveau')).toBe(true);
    expect(s.data.get('k')).toBe('nouveau');
  });
  it('quota dépassé, cache (dropOnFail) : ne lève pas, supprime la clé périmée', () => {
    const s = fakeStorage(true); vi.stubGlobal('localStorage', s);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => safeSetItem('k', 'x'.repeat(10), true)).not.toThrow();
    expect(safeSetItem('k', 'x', true)).toBe(false);
    expect(s.data.has('k')).toBe(false);
  });
  it('quota dépassé, donnée unique au navigateur (défaut) : ne lève pas et CONSERVE l\'ancienne valeur', () => {
    const s = fakeStorage(true); vi.stubGlobal('localStorage', s);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(safeSetItem('k', 'nouveau')).toBe(false);
    expect(s.data.get('k')).toBe('ancien');
  });
});
