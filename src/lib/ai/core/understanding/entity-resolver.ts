import { SupabaseClient } from '@supabase/supabase-js';
import { EntityType, ResolvedEntity } from './types';
import { ContextBuilder } from './context-builder';
import { AliasManager } from './alias-manager';
import { FuzzySearch } from './fuzzy-search';
import { EmbeddingSearch } from './embedding-search';
import { UniversalNormalizer } from './normalizer';
import { UnderstandingLogger } from './logger';

export const EntityResolver = {
  resolveEntity: async (
    supabase: SupabaseClient,
    companyId: string,
    entityType: EntityType,
    rawText: string
  ): Promise<ResolvedEntity | null> => {
    if (!rawText || rawText.trim() === '') return null;

    const normalizedText = UniversalNormalizer.normalizeEntityName(rawText);
    const result: ResolvedEntity = {
      id: null,
      name: normalizedText,
      type: entityType,
      confidence: 0,
      originalText: rawText,
      normalizedText,
      sources: []
    };

    // 1. Buscar en Alias
    const aliasMatch = await AliasManager.findAlias(supabase, companyId, entityType, normalizedText);
    if (aliasMatch) {
      result.id = aliasMatch.entity_id;
      result.confidence = aliasMatch.confidence;
      result.sources.push('alias');
      return result; // Alias tiene prioridad absoluta
    }

    // 2. Buscar en Caché / Catálogo (Exacto + Fuzzy)
    const catalog = await ContextBuilder.getEntityCatalog(supabase, companyId);
    let items: any[] = [];
    if (entityType === 'producto') items = catalog.productos;
    else if (entityType === 'cliente') items = catalog.clientes;
    else if (entityType === 'proveedor') items = catalog.proveedores;

    if (items.length > 0) {
      const fuzzyMatch = FuzzySearch.match(normalizedText, items, 'name');
      if (fuzzyMatch && fuzzyMatch.score > 0.6) {
        result.id = fuzzyMatch.item.id;
        result.name = fuzzyMatch.item.name;
        result.confidence = fuzzyMatch.score;
        result.sources.push(fuzzyMatch.score === 1 ? 'exact' : 'fuzzy');
        
        // Si hay una coincidencia fuerte en fuzzy, terminamos aquí para ser rápidos
        if (fuzzyMatch.score > 0.85) return result;
      }
    }

    // 3. Buscar con Embeddings Semánticos (Fallback)
    if (!result.id) {
      const embedding = await EmbeddingSearch.generateEmbedding(normalizedText);
      if (embedding) {
        const semanticMatches = await EmbeddingSearch.searchSimilar(supabase, companyId, entityType, embedding, 1);
        if (semanticMatches.length > 0) {
          result.id = semanticMatches[0].id;
          result.name = semanticMatches[0].nombre;
          result.confidence = semanticMatches[0].similarity || 0.7; // similarity score from pgvector
          result.sources.push('embedding');
        }
      }
    }

    UnderstandingLogger.info('entity_resolved', { entityType, rawText, result });
    return result;
  }
};
