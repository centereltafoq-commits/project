import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Desktop Package Configuration', () => {
  it('has valid package.json with electron dependencies and scripts', () => {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    expect(fs.existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.name).toBe('@edu-center/desktop');
    expect(pkg.main).toBe('dist/main/index.js');
    expect(pkg.scripts['build']).toBeDefined();
  });

  it('has electron-builder configuration specifying windows nsis and portable targets', () => {
    const builderPath = path.resolve(__dirname, '../../electron-builder.json');
    expect(fs.existsSync(builderPath)).toBe(true);
    const builder = JSON.parse(fs.readFileSync(builderPath, 'utf8'));
    expect(builder.appId).toBe('com.educenter.erp');
    expect(builder.win.target).toContain('nsis');
    expect(builder.win.target).toContain('portable');
    expect(builder.portable?.artifactName).toBe('EduCenter-ERP-Portable-${version}.exe');
  });
});
