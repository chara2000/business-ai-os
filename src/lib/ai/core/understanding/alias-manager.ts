import { SupabaseClient } from '@supabase/supabase-js';
import { EntityType, AliasRecord } from './types';
import { UNDERSTANDING_CONFIG } from './config';
import { UnderstandingLogger } from './logger';
import { UniversalNormalizer } from './normalizer';

export const AliasManager = {
  findAlias: async (
    supabase: SupabaseClient, 
    companyId: string, 
    entityType: EntityType, 
    query: string
  ): Promise<AliasRecord | null> => {
    if (!UNDERSTANDING_CONFIG.ENABLE_ALIAS_ENGINE) return null;

    const normalized = UniversalNormalizer.normalizeEntityName(query);

    // Búsqueda ILIKE / Trigram 
    const { data, error } = await supabase
      .from('entity_aliases')
      .select('*')
      .eq('company_id', companyId)
      .eq('entity_type', entityType)
      .ilike('alias', `%${normalized}%`)
      .order('confidence', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      UnderstandingLogger.error('alias_search_error', { error });
      return null;
    }

    if (data) {
      UnderstandingLogger.debug('alias_found', { query, alias: data.alias, entityId: data.entity_id });
      return data;
    }

    return null;
  },

  registerAlias: async (
    supabase: SupabaseClient, 
    companyId: string, 
    entityType: EntityType, 
    entityId: string, 
    alias: string
  ): Promise<void> => {
    if (!UNDERSTANDING_CONFIG.ENABLE_LEARNING) return;

    const normalized = UniversalNormalizer.normalizeEntityName(alias);
    
    // Ignorar alias muy cortos o idénticos al ID
    if (normalized.length < 3) return;

    const { error } = await supabase
      .from('entity_aliases')
      .upsert({
        company_id: companyId,
        entity_type: entityType,
        entity_id: entityId,
        alias: normalized,
        confidence: 1.0
      }, { onConflict: 'company_id, entity_type, entity_id, alias' });

    if (error) {
      UnderstandingLogger.error('register_alias_error', { error });
    } else {
      UnderstandingLogger.info('alias_learned', { entityType, alias: normalized, entityId });
    }
  }
};
