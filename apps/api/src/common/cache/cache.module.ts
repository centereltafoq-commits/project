import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppLoggerService } from '../logger/app-logger.service';

interface MemoryCacheEntry {
  value: string;
  expiresAt: number;
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private redisClient: Redis | null = null;
  private readonly memoryStore = new Map<string, MemoryCacheEntry>();

  constructor(
    private readonly config: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    const redisUrl = this.config.get<string>('redisUrl');
    if (redisUrl && redisUrl.trim().length > 0) {
      this.redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
      this.redisClient.on('error', (err) => {
        this.logger.warn('Redis unavailable, falling back to in-memory cache', {
          reason: err.message,
        });
      });
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redisClient && this.redisClient.status === 'ready') {
      const raw = await this.redisClient.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    }
    const item = this.memoryStore.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }
    return JSON.parse(item.value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds = 120): Promise<void> {
    const serialized = JSON.stringify(value);
    if (this.redisClient && this.redisClient.status === 'ready') {
      await this.redisClient.set(key, serialized, 'EX', ttlSeconds);
      return;
    }
    this.memoryStore.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    if (this.redisClient && this.redisClient.status === 'ready') {
      const keys = await this.redisClient.keys(`${prefix}*`);
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
      }
    }
    for (const key of this.memoryStore.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryStore.delete(key);
      }
    }
  }

  async invalidateRosterViews(): Promise<void> {
    await Promise.allSettled([
      this.invalidatePrefix('dashboard:summary:'),
      this.invalidatePrefix('reports:filter-options'),
    ]);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit().catch(() => undefined);
    }
  }
}

@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class AppCacheModule {}

