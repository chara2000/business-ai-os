import { aiGetEmbedding } from '@/lib/ai/provider';
import { SupabaseClient } from '@supabase/supabase-js';
import { UNDERSTANDING_CONFIG } from './config';
import { UnderstandingLogger } from './logger';
import { EntityType } from './types';


export const EmbeddingSearch = {
  generateEmbedding: async (text: string): Promise<number[] | null> => {
    if (!UNDERSTANDING_CONFIG.ENABLE_EMBEDDINGS) return null;
    try {
      return await aiGetEmbedding(text);
    } catch (err) {
      UnderstandingLogger.error('generate_embedding_failed', { error: err });
      return null;
    }
  },

  searchSimilar: async (
    supabase: SupabaseClient, 
    companyId: string, 
    entityType: EntityType, 
    queryEmbedding: number[], 
    limit = 3
  ) => {
    if (!UNDERSTANDING_CONFIG.ENABLE_EMBEDDINGS) return [];
    
    let tableName = 'productos';
    if (entityType === 'cliente') tableName = 'clientes';
    else if (entityType === 'proveedor') tableName = 'proveedores';

    try {
      // Necesitaremos una función RPC en supabase para la búsqueda vectorial
      // create function match_entities(company_id uuid, table_name text, query_embedding vector(1536), match_limit int)
      // Por compatibilidad inicial, si no está la función, retornamos vacío para que falle y use fuzzy.
      const { data, error } = await supabase.rpc('match_entities', {
        p_company_id: companyId,
        p_table_name: tableName,
        p_query_embedding: `[${queryEmbedding.join(',')}]`,
        p_limit: limit
      });

      if (error) {
        UnderstandingLogger.debug('embedding_rpc_error', { error });
        return [];
      }

      return data || [];
    } catch (e) {
      return [];
    }
  }
};
