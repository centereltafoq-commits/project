import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppLoggerService } from './common/logger/app-logger.service';
import { SanitizeInputPipe } from './common/pipes/sanitize-input.pipe';
import { registerSpaStaticServing } from './common/spa/spa-static.middleware';
import { ensureDatabaseReady } from './database/db-auto-bootstrap';

const LAN_ORIGIN_REGEX =
  /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/i;

export function isAllowedLanOrigin(
  origin: string | undefined,
  configuredOrigins: string[],
  allowLan = true,
): boolean {
  if (!origin) return true;
  if (configuredOrigins.includes('*') || configuredOrigins.includes(origin)) {
    return true;
  }
  if (allowLan && LAN_ORIGIN_REGEX.test(origin)) {
    return true;
  }
  return false;
}

async function bootstrap() {
  if (process.env.SKIP_DB_BOOTSTRAP !== 'true' && process.env.DATABASE_URL) {
    await ensureDatabaseReady(process.env.DATABASE_URL);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(AppLoggerService);
  app.useLogger(logger);

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('port');
  const corsOrigin = config.getOrThrow<string>('corsOrigin');
  const configuredOrigins = corsOrigin
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowLan = process.env.CORS_ALLOW_LAN !== 'false';

  app.setGlobalPrefix('api');
  // Disable CSP/COOP upgrades so desktop Electron and LAN HTTP clients load assets seamlessly
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
      originAgentCluster: false,
    }),
  );
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '100kb' });
  app.useBodyParser('urlencoded', { limit: '100kb', extended: true });

  app.enableCors({
    origin: (origin, callback) => {
      callback(null, isAllowedLanOrigin(origin, configuredOrigins, allowLan));
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new SanitizeInputPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  const servedWebDir = registerSpaStaticServing(app.getHttpAdapter().getInstance());
  if (servedWebDir) {
    logger.info(`Serving frontend SPA bundle from ${servedWebDir}`);
  }

  await app.init();

  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  logger.info(`EduCenter ERP API listening on http://${host}:${port}`);
}

if (typeof process.env.VITEST === 'undefined') {
  bootstrap();
}
