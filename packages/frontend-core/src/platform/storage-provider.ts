/**
 * Minimal key/value persistence contract used by shared frontend behavior.
 *
 * The contract intentionally mirrors the subset of browser localStorage that
 * GrooveShare currently needs without depending on the DOM Storage type.
 * Browser, Capacitor, Electron, or test implementations can satisfy the same
 * interface later.
 */
export interface StorageProvider {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
