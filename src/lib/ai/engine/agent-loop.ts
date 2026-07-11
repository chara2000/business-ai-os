import { type SupabaseClient } from '@supabase/supabase-js';
import { aiChatCompletion, type ChatMessage } from '../provider';
import { AI_TOOLS } from './tools-registry';
import { ToolOrchestrator } from './tool-orchestrator';
import { ConfirmationManager } from './confirmation-manager';
import type { ConfirmationCard } from './types';

function mergeArgsDeep(target: any, source: any): any {
  if (typeof target !== 'object' || target === null) return source;
  if (typeof source !== 'object' || source === null) return source;
  
  const result = Array.isArray(target) ? [...target] : { ...target };
  
  for (const key of Object.keys(source)) {
    const sVal = source[key];
    const tVal = result[key];
    
    if (Array.isArray(sVal) && Array.isArray(tVal)) {
      result[key] = tVal.map((item, i) => sVal[i] ? mergeArgsDeep(item, sVal[i]) : item);
      if (sVal.length > tVal.length) {
        result[key].push(...sVal.slice(tVal.length));
      }
    } else if (typeof sVal === 'object' && sVal !== null && typeof tVal === 'object' && tVal !== null) {
      result[key] = mergeArgsDeep(tVal, sVal);
    } else {
      result[key] = sVal;
    }
  }
  return result;
}

export interface AgentResult {
  text: string;
  data?: unknown;
  entidad_id?: string;
  action_type?: string;
  confirmation?: ConfirmationCard;
  pendingKeys?: string[];
  pending_action?: { toolName: string; args: any };
  messages?: ChatMessage[];
}

export async function runAgentLoop(
  supabase: SupabaseClient,
  empresaId: string,
  usuarioId: string,
  systemPrompt: string,
  history: ChatMessage[],
  orchestrator: ToolOrchestrator,
  sessionId: string,
  maxIterations = 5
): Promise<AgentResult> {
  const messages = [...history];
  let iterations = 0;
  
  let finalData: unknown;
  let finalEntidadId: string | undefined;
  let finalAction: string | undefined;

  const confirmationManager = new ConfirmationManager(supabase, empresaId);

  // Tools that require explicit confirmation before DB injection
  const DESTRUCTIVE_TOOLS = ['crear_venta', 'crear_compra', 'crear_producto', 'actualizar_producto', 'registrar_pago_credito', 'registrar_gasto', 'crear_cliente', 'crear_proveedor'];

  while (iterations < maxIterations) {
    iterations++;

    // Call LLM
    const response = await aiChatCompletion({
      systemPrompt,
      messages,
      tools: AI_TOOLS,
    });

    if (response.toolCalls && response.toolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: response.text || '',
        tool_calls: response.toolCalls,
      });

      for (const call of response.toolCalls) {
        let toolResultText = '';
        const toolName = call.name;

        try {
          let args = JSON.parse(call.arguments);
          
          if (DESTRUCTIVE_TOOLS.includes(toolName)) {
            // MERGE WITH PREVIOUS ARGS IF ANY
            // Look backwards in history for a tool response with current_args for this tool
            for (let i = messages.length - 1; i >= 0; i--) {
              const m = messages[i];
              if (m.role === 'tool' && m.content) {
                try {
                  const contentObj = JSON.parse(m.content);
                  if (contentObj.error && contentObj.current_args) {
                    // Check if the tool_call_id matches a previous call to the same tool
                    const prevCall = messages.find(prev => 
                      prev.role === 'assistant' && 
                      prev.tool_calls?.some(c => c.id === m.tool_call_id && c.name === toolName)
                    );
                    if (prevCall) {
                      args = mergeArgsDeep(contentObj.current_args, args);
                      break; // Only merge once with the most recent matching call
                    }
                  }
                } catch (e) {
                  // Ignore JSON parse errors in history
                }
              }
            }

            const { card, pendingKeys } = await confirmationManager.buildConfirmation(toolName, args, sessionId);
            
            if (!card.listo_para_confirmar) {
              toolResultText = JSON.stringify({
                error: "Faltan datos obligatorios para ejecutar esta acción. Pídele al usuario los campos faltantes de forma amigable. Tus argumentos actuales han sido guardados temporalmente, recuérdalos para el siguiente turno.",
                missing_fields: pendingKeys,
                current_args: args
              });
            } else {
              // PAUSE EXECUTION - Delegate to Confirmation Manager
              messages.pop(); // Remove the incomplete assistant tool_call from history
              return {
                text: response.text || 'Tengo la información lista. Por favor revisa y confirma:',
                confirmation: card,
                pendingKeys,
                action_type: toolName,
                pending_action: { toolName, args },
                messages
              };
            }
          } else {
            // SAFE EXECUTION (Reads)
            const result = await orchestrator.executeTool(toolName, args);
            toolResultText = JSON.stringify({
              success: true,
              data: result
            });
          }

        } catch (err) {
          toolResultText = JSON.stringify({
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error executing tool'
          });
        }

        messages.push({
          role: 'tool',
          content: toolResultText,
          tool_call_id: call.id,
        });
      }
      
    } else {
      messages.push({
        role: 'assistant',
        content: response.text || ''
      });
      return {
        text: response.text || '',
        messages
      };
    }
  }

  return {
    text: 'Se alcanzó el límite de interacciones. Intenta de nuevo.',
    messages
  };
}
