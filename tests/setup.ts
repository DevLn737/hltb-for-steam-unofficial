import { beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { IDBFactory } from 'fake-indexeddb';
import { webcrypto } from 'node:crypto';

Object.assign(globalThis, { browser: fakeBrowser, chrome: fakeBrowser, indexedDB: new IDBFactory() });
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

beforeEach(() => {
  fakeBrowser.reset();
  Object.assign(globalThis, { indexedDB: new IDBFactory() });
  if (typeof document !== 'undefined') {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  }
});
