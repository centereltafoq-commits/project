import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { ensureRuntimeSecrets, resolveNodeRuntimeCommand } from './runtime-paths';

describe('runtime-paths', () => {
  it('generates and persists stable cryptographic JWT runtime secrets inside dataDir', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edu-secrets-test-'));
    try {
      const first = ensureRuntimeSecrets(tmpDir);
      expect(first.jwtAccessSecret.length).toBeGreaterThanOrEqual(48);
      expect(first.jwtRefreshSecret.length).toBeGreaterThanOrEqual(48);

      const second = ensureRuntimeSecrets(tmpDir);
      expect(second).toEqual(first);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('uses plain node binary outside Electron and respects explicit override', () => {
    expect(resolveNodeRuntimeCommand()).toEqual({
      command: 'node',
      useElectronAsNode: false,
    });
    expect(resolveNodeRuntimeCommand('C:/custom/node.exe')).toEqual({
      command: 'C:/custom/node.exe',
      useElectronAsNode: false,
    });
  });
});
