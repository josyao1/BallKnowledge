import '@testing-library/jest-dom/vitest';

// jsdom 26+ changed localStorage to require a file-backed path; without one
// the clear() / key() / length methods are missing. Polyfill with an
// in-memory implementation so tests that call localStorage.clear() still work.
const makeLocalStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
};

Object.defineProperty(window, 'localStorage', {
  value: makeLocalStorage(),
  writable: true,
});
