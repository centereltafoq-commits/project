import 'dotenv/config';
import { migrateDatabaseSchema } from './db-auto-bootstrap';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required to run migrations');
  const schemaInitialized = await migrateDatabaseSchema(databaseUrl);
  process.stdout.write(
    schemaInitialized
      ? 'Database baseline migration completed.\n'
      : 'Database migrations are up to date.\n',
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
