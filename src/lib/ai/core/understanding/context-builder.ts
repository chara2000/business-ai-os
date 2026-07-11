import { SupabaseClient } from '@supabase/supabase-js';
import { UnderstandingCache } from './cache';
import { EntityCatalog } from './types';
import { UNDERSTANDING_CONFIG } from './config';
import { UnderstandingLogger } from './logger';

export const ContextBuilder = {
  /**
   * Obtiene el catálogo de entidades (productos, clientes, proveedores) de la empresa
   * Usa caché para evitar consultas redundantes.
   */
  getEntityCatalog: async (supabase: SupabaseClient, companyId: string): Promise<EntityCatalog> => {
    const cached = UnderstandingCache.get(companyId);
    if (cached) return cached;

    UnderstandingLogger.debug('fetch_catalog', { companyId });

    // Hacemos fetch en paralelo (limitado a 500 para evitar desbordar memoria/prompt)
    const [productos, clientes, proveedores] = await Promise.all([
      supabase.from('productos').select('id, nombre').eq('empresa_id', companyId).limit(300),
      supabase.from('clientes').select('id, nombre, apellido').eq('empresa_id', companyId).limit(100),
      supabase.from('proveedores').select('id, nombre').eq('empresa_id', companyId).limit(100),
    ]);

    const catalog: EntityCatalog = {
      productos: (productos.data || []).map(p => ({ id: p.id, name: p.nombre })),
      clientes: (clientes.data || []).map(c => ({ id: c.id, name: `${c.nombre || ''} ${c.apellido || ''}`.trim() })),
      proveedores: (proveedores.data || []).map(p => ({ id: p.id, name: p.nombre })),
    };

    UnderstandingCache.set(companyId, catalog);
    return catalog;
  },

  /**
   * Construye un string optimizado para inyectar en el 'prompt' de Whisper (u otro modelo)
   */
  buildAudioPrompt: async (supabase: SupabaseClient, companyId: string): Promise<string> => {
    if (!UNDERSTANDING_CONFIG.ENABLE_AUDIO_CONTEXT) return '';

    const catalog = await ContextBuilder.getEntityCatalog(supabase, companyId);
    
    // Whisper Context Prompts no deben ser gigantes. (Max ~224 tokens)
    // Extraemos solo los nombres, priorizando los primeros.
    const productNames = catalog.productos.slice(0, 50).map(p => p.name).join(', ');
    const clientNames = catalog.clientes.slice(0, 20).map(c => c.name).join(', ');

    let prompt = `Este audio es sobre un CRM. Términos clave: `;
    if (productNames) prompt += `Productos: ${productNames}. `;
    if (clientNames) prompt += `Clientes: ${clientNames}.`;

    return prompt.trim();
  }
};
