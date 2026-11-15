import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { isSpaNavigationRequest, resolveWebDistDir } from './spa-static.middleware';

describe('spa-static.middleware helpers', () => {
  it('identifies SPA navigation routes cleanly while excluding /api and asset extensions', () => {
    expect(isSpaNavigationRequest('GET', '/')).toBe(true);
    expect(isSpaNavigationRequest('GET', '/attendance')).toBe(true);
    expect(isSpaNavigationRequest('HEAD', '/students/123')).toBe(true);

    expect(isSpaNavigationRequest('POST', '/attendance')).toBe(false);
    expect(isSpaNavigationRequest('GET', '/api')).toBe(false);
    expect(isSpaNavigationRequest('GET', '/api/health')).toBe(false);
    expect(isSpaNavigationRequest('GET', '/assets/index.js')).toBe(false);
    expect(isSpaNavigationRequest('GET', '/assets/alarm.ogg')).toBe(false);
  });

  it('resolves explicit directory only when index.html is present', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edu-spa-test-'));
    try {
      expect(resolveWebDistDir(tmpDir)).toBeNull();
      fs.writeFileSync(path.join(tmpDir, 'index.html'), '<!doctype html><html></html>', 'utf8');
      expect(resolveWebDistDir(tmpDir)).toBe(path.resolve(tmpDir));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
