'use client';

import { Check, X, Sparkles, Pencil, AlertCircle } from 'lucide-react';
import type { ConfirmationCard } from '@/lib/ai/engine/types';

type Props = {
  card: ConfirmationCard;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onSuggest: (text: string) => void;
};

export function ActionConfirmationCard({ card, loading, onConfirm, onCancel, onSuggest }: Props) {
  return (
    <div className="ai-confirm-card">
      <div className="ai-confirm-card__header">
        <Sparkles size={18} color="var(--brand-deep)" />
        <div>
          <h4>{card.titulo}</h4>
          <p>{card.subtitulo}</p>
        </div>
      </div>

      <div className="ai-confirm-card__grid">
        {card.campos.map((c) => (
          <div key={c.key} className="ai-confirm-card__field">
            <span className="ai-confirm-card__label">{c.label}</span>
            <span className="ai-confirm-card__value">{c.displayValue ?? String(c.value ?? '—')}</span>
            {c.source !== 'usuario' && (
              <span className="ai-confirm-card__badge">auto</span>
            )}
          </div>
        ))}
      </div>

      {card.campos_inferidos.length > 0 && (
        <div className="ai-confirm-card__section ai-confirm-card__section--ok">
          <Check size={14} />
          <span>Inferido: {card.campos_inferidos.join(', ')}</span>
        </div>
      )}

      {card.campos_pendientes.length > 0 && (
        <div className="ai-confirm-card__section ai-confirm-card__section--warn">
          <AlertCircle size={14} />
          <span>Falta: {card.campos_pendientes.join(', ')}</span>
        </div>
      )}

      <div className="ai-confirm-card__actions">
        <button
          type="button"
          className="btn-primary"
          disabled={loading || !card.listo_para_confirmar}
          onClick={onConfirm}
        >
          <Check size={14} /> Confirmar
        </button>
        <button type="button" className="btn-ghost" disabled={loading} onClick={onCancel}>
          <X size={14} /> Cancelar
        </button>
        <button type="button" className="btn-ghost" disabled={loading} onClick={() => onSuggest('Cambia la categoría por ')}>
          <Pencil size={14} /> Corregir
        </button>
      </div>
    </div>
  );
}
