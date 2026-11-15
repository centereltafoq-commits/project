import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { resolveDrizzleDir, splitDrizzleSqlStatements } from './db-auto-bootstrap';

describe('db-auto-bootstrap helpers', () => {
  it('splits Drizzle SQL migrations cleanly on statement-breakpoint delimiters', () => {
    const rawSql = `
      CREATE TABLE "users" ("id" uuid PRIMARY KEY);
      --> statement-breakpoint
      CREATE INDEX "idx_users" ON "users" ("id");
      --> statement-breakpoint
    `;
    const statements = splitDrizzleSqlStatements(rawSql);
    expect(statements).toEqual([
      'CREATE TABLE "users" ("id" uuid PRIMARY KEY);',
      'CREATE INDEX "idx_users" ON "users" ("id");',
    ]);
  });

  it('locates a drizzle directory containing .sql files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edu-drizzle-test-'));
    try {
      expect(resolveDrizzleDir(tmpDir)).toBeNull();
      fs.writeFileSync(path.join(tmpDir, '0000_init.sql'), 'SELECT 1;', 'utf8');
      expect(resolveDrizzleDir(tmpDir)).toBe(tmpDir);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
