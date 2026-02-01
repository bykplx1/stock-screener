// cache.ts - File-based caching system

import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

export class CacheManager {
  private cacheDir: string;
  private memoryCache: Map<string, CacheEntry<any>> = new Map();

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || path.join(process.cwd(), '.cache');
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      logger.debug(`Created cache directory: ${this.cacheDir}`);
    }
  }

  private getCachePath(key: string): string {
    // Sanitize key for filename
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.cacheDir, `${safeKey}.json`);
  }

  get<T>(key: string): T | null {
    // Check memory cache first
    const memEntry = this.memoryCache.get(key);
    if (memEntry) {
      if (Date.now() < memEntry.expiresAt) {
        logger.debug(`Cache hit (memory): ${key}`);
        return memEntry.data as T;
      }
      this.memoryCache.delete(key);
    }

    // Check file cache
    const cachePath = this.getCachePath(key);
    if (!fs.existsSync(cachePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(cachePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(content);

      if (Date.now() >= entry.expiresAt) {
        // Expired, delete and return null
        this.delete(key);
        return null;
      }

      // Store in memory for faster subsequent access
      this.memoryCache.set(key, entry);
      logger.debug(`Cache hit (file): ${key}`);
      return entry.data;
    } catch (error) {
      logger.error(`Cache read error for ${key}:`, error);
      return null;
    }
  }

  set<T>(key: string, data: T, ttlSeconds: number = 3600): void {
    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
      createdAt: Date.now(),
    };

    // Store in memory
    this.memoryCache.set(key, entry);

    // Store in file
    const cachePath = this.getCachePath(key);
    try {
      fs.writeFileSync(cachePath, JSON.stringify(entry, null, 2));
      logger.debug(`Cache set: ${key} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      logger.error(`Cache write error for ${key}:`, error);
    }
  }

  delete(key: string): void {
    this.memoryCache.delete(key);
    const cachePath = this.getCachePath(key);
    try {
      if (fs.existsSync(cachePath)) {
        fs.unlinkSync(cachePath);
      }
    } catch (error) {
      logger.error(`Cache delete error for ${key}:`, error);
    }
  }

  clear(): void {
    this.memoryCache.clear();
    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(this.cacheDir, file));
        }
      }
      logger.info('Cache cleared');
    } catch (error) {
      logger.error('Cache clear error:', error);
    }
  }

  cleanupExpired(): number {
    let cleaned = 0;
    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.cacheDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const entry = JSON.parse(content);
          if (Date.now() >= entry.expiresAt) {
            fs.unlinkSync(filePath);
            cleaned++;
          }
        } catch {
          // Invalid cache file, delete it
          fs.unlinkSync(filePath);
          cleaned++;
        }
      }
      logger.info(`Cleaned up ${cleaned} expired cache entries`);
    } catch (error) {
      logger.error('Cache cleanup error:', error);
    }
    return cleaned;
  }

  getStats(): { entries: number; sizeBytes: number } {
    let entries = 0;
    let sizeBytes = 0;
    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          entries++;
          const stats = fs.statSync(path.join(this.cacheDir, file));
          sizeBytes += stats.size;
        }
      }
    } catch (error) {
      logger.error('Cache stats error:', error);
    }
    return { entries, sizeBytes };
  }
}
