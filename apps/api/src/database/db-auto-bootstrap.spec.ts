import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { resolveBaselineHashVariants } from './db-auto-bootstrap';

describe('resolveBaselineHashVariants', () => {
  it('returns both LF and CRLF SHA256 hashes for the baseline SQL file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drizzle-lf-crlf-'));
    try {
      const metaDir = path.join(tmpDir, 'meta');
      fs.mkdirSync(metaDir, { recursive: true });
      fs.writeFileSync(
        path.join(metaDir, '_journal.json'),
        JSON.stringify({ entries: [{ tag: '0000_baseline' }] }),
        'utf8',
      );
      const lfSql = 'CREATE TABLE "test" (\n\t"id" uuid PRIMARY KEY\n);\n';
      const crlfSql = lfSql.replace(/\n/g, '\r\n');
      fs.writeFileSync(path.join(tmpDir, '0000_baseline.sql'), crlfSql, 'utf8');

      const lfHash = createHash('sha256').update(lfSql).digest('hex');
      const crlfHash = createHash('sha256').update(crlfSql).digest('hex');

      const variants = resolveBaselineHashVariants(tmpDir, crlfHash);
      expect(variants.has(lfHash)).toBe(true);
      expect(variants.has(crlfHash)).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
