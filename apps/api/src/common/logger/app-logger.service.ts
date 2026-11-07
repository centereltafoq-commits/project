import { Global, Injectable, LoggerService, Module } from '@nestjs/common';

@Injectable()
export class AppLoggerService implements LoggerService {
  log(message: string, meta?: Record<string, unknown>): void {
    this.write('INFO', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('INFO', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('WARN', message, meta);
  }

  error(message: string, trace?: string, meta?: Record<string, unknown>): void {
    this.write('ERROR', message, { ...meta, ...(trace ? { trace } : {}) });
  }

  private write(level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: Record<string, unknown>) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
    };
    const serialized = JSON.stringify(entry);
    if (level === 'ERROR') {
      process.stderr.write(`${serialized}\n`);
    } else {
      process.stdout.write(`${serialized}\n`);
    }
  }
}

@Global()
@Module({
  providers: [AppLoggerService],
  exports: [AppLoggerService],
})
export class LoggerModule {}

