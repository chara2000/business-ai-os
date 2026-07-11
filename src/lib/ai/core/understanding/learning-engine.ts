import { SupabaseClient } from '@supabase/supabase-js';
import { EntityType } from './types';
import { AliasManager } from './alias-manager';
import { UnderstandingLogger } from './logger';

export const LearningEngine = {
  /**
   * Llamado cuando el usuario corrige a la IA explícitamente, o cuando en un 
   * flujo interactivo el usuario cambia la entidad sugerida por otra.
   */
  observeCorrection: async (
    supabase: SupabaseClient, 
    companyId: string, 
    entityType: EntityType, 
    wrongQuery: string, 
    correctEntityId: string
  ): Promise<void> => {
    UnderstandingLogger.info('learning_triggered', { wrongQuery, correctEntityId, entityType });
    await AliasManager.registerAlias(supabase, companyId, entityType, correctEntityId, wrongQuery);
  }
};
