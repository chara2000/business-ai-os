import { EntityCatalog } from './types';
import { UNDERSTANDING_CONFIG } from './config';
import { UnderstandingLogger } from './logger';

interface CacheEntry {
  catalog: EntityCatalog;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry>();

export const UnderstandingCache = {
  get: (companyId: string): EntityCatalog | null => {
    const entry = memoryCache.get(companyId);
    if (!entry) return null;

    const now = Date.now();
    const ageSeconds = (now - entry.timestamp) / 1000;
    
    if (ageSeconds > UNDERSTANDING_CONFIG.CACHE_TTL) {
      UnderstandingLogger.debug('cache_miss', { companyId, reason: 'expired' });
      memoryCache.delete(companyId);
      return null;
    }

    UnderstandingLogger.debug('cache_hit', { companyId, ageSeconds });
    return entry.catalog;
  },

  set: (companyId: string, catalog: EntityCatalog): void => {
    memoryCache.set(companyId, {
      catalog,
      timestamp: Date.now()
    });
    UnderstandingLogger.debug('cache_set', { companyId, entitiesCount: catalog.productos.length + catalog.clientes.length });
  },

  invalidate: (companyId: string): void => {
    memoryCache.delete(companyId);
    UnderstandingLogger.debug('cache_invalidated', { companyId });
  }
};
