import type { ConfirmationCard, EnrichedField } from './types';
import { ACTION_LABELS, FIELD_LABELS } from './types';

export function buildConfirmationCard(params: {
  sessionId: string;
  accion: string;
  entidad: ConfirmationCard['entidad'];
  campos: EnrichedField[];
  campos_pendientes: string[];
  listo: boolean;
}): ConfirmationCard {
  const inferidos = params.campos
    .filter((c) => ['inferido', 'historial', 'defecto'].includes(c.source))
    .map((c) => c.label);

  const acciones = ['Confirmar', 'Cancelar'];
  if (params.campos_pendientes.length > 0) {
    acciones.splice(1, 0, ...params.campos_pendientes.slice(0, 3).map((k) => `Agregar ${FIELD_LABELS[k] ?? k}`));
  }
  acciones.push('Corregir categoría', 'Cambiar proveedor', 'Modificar cantidad');

  return {
    titulo: 'Confirma el registro',
    subtitulo: ACTION_LABELS[params.accion] ?? params.accion,
    entidad: params.entidad,
    accion: params.accion,
    campos: params.campos,
    campos_inferidos: inferidos,
    campos_pendientes: params.campos_pendientes.map((k) => FIELD_LABELS[k] ?? k),
    acciones_disponibles: [...new Set(acciones)],
    session_id: params.sessionId,
    listo_para_confirmar: params.listo && params.campos_pendientes.length === 0,
  };
}

export function formatConfirmationText(card: ConfirmationCard): string {
  const lines = [
    `📋 **${card.titulo}**`,
    `_${card.subtitulo}_`,
    '',
    ...card.campos.map((c) => `• **${c.label}:** ${c.displayValue ?? c.value}${c.source !== 'usuario' ? ' _(auto)_' : ''}`),
  ];

  if (card.campos_inferidos.length) {
    lines.push('', '✔ Inferido automáticamente:', ...card.campos_inferidos.map((l) => `  • ${l}`));
  }
  if (card.campos_pendientes.length) {
    lines.push('', '⚠ Falta confirmar:', ...card.campos_pendientes.map((l) => `  • ${l}`));
  }

  lines.push('', card.listo_para_confirmar
    ? 'Responde **Confirmar** para guardar o indica correcciones.'
    : 'Completa los campos pendientes o corrige antes de confirmar.');

  return lines.join('\n');
}
