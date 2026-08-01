import { beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

Object.assign(globalThis, { browser: fakeBrowser, chrome: fakeBrowser });

beforeEach(() => {
  fakeBrowser.reset();
  if (typeof document !== 'undefined') {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  }
});
