import type { SupabaseClient } from '@supabase/supabase-js';
import { Router } from './router';
import { Planner } from './planner';
import { ToolOrchestrator } from './tool-orchestrator';
import { MemoryManager } from './memory-manager';
import { buildAgentContext } from './context-manager';
import { runAgentLoop } from './agent-loop';
import type { EngineResponse } from './types';

export async function runActionEngine(params: {
  supabase: SupabaseClient;
  empresaId: string;
  usuarioId: string;
  message: string;
  permisos?: string[];
  channel?: 'web' | 'whatsapp' | 'telegram';
  prefillDatos?: Record<string, unknown>;
}): Promise<EngineResponse> {
  const {
    supabase, empresaId, usuarioId, message, channel = 'web', permisos = []
  } = params;

  // 1. Initial basic check for clear command
  const lmsg = message.toLowerCase().trim();
  if (lmsg === 'cancelar' || lmsg === 'reiniciar' || lmsg === 'reset') {
    const mem = new MemoryManager(supabase, empresaId, usuarioId);
    await mem.clearShortTermMemory();
    return {
      tipo: 'cancelado',
      texto: '❌ Acción cancelada. ¿En qué más te ayudo?'
    };
  }

  // 2. Memory & Context
  const memoryManager = new MemoryManager(supabase, empresaId, usuarioId);
  let session = await memoryManager.getShortTermMemory();
  const context = await buildAgentContext(supabase, empresaId, usuarioId, channel, session, permisos);

  // 3. Router
  const agentType = Router.routeMessage(message);

  // 4. Planner
  const planner = new Planner();
  const planningPrompt = planner.generatePlanningPrompt();

  // 5. System Prompt Construction
  const systemPrompt = `
Eres un Agente Autónomo especializado del CRM (Especialidad: ${agentType}).
${planningPrompt}
Reglas: No uses SQL libre. Usa estrictamente las herramientas dadas.

CONTEXTO ACTUAL DEL NEGOCIO:
${context.businessContextStr}
`;

  // 6. Orchestrator
  // Assuming a generic role 'admin' for now, replace with true context roles when auth expands
  const orchestrator = new ToolOrchestrator(supabase, empresaId, usuarioId, 'admin', permisos);

  // 7. Agent Loop
  const history = session?.history || [];
  history.push({ role: 'user', content: message });

  const result = await runAgentLoop(
    supabase, 
    empresaId, 
    usuarioId, 
    systemPrompt, 
    history, 
    orchestrator,
    session?.id || crypto.randomUUID()
  );

  // Save conversation progress
  const updatedHistory = result.messages || history;
  if (result.pending_action) {
    if (!session) {
      session = { id: crypto.randomUUID(), usuario_id: usuarioId, empresa_id: empresaId, history: [], expires_at: '' };
    }
    session.state = { ...session.state, pending_action: result.pending_action };
  }
  
  await memoryManager.saveShortTermMemory(updatedHistory, session?.id, session?.state);

  // 8. Return response
  return {
    tipo: result.confirmation ? 'confirmacion' : (result.action_type ? 'ejecutado' : 'mensaje'),
    texto: result.text,
    confirmacion: result.confirmation,
    session_id: session?.id,
    resultado: result.data ? { success: true, message: 'Ejecutado correctamente', data: result.data } : undefined
  };
}
