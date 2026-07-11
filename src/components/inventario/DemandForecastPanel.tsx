'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, AlertTriangle, Package, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { ActionButton } from '@/components/ui/ActionButton';
import { TablePanel } from '@/components/ui/TablePanel';
import { useClientPagination } from '@/lib/hooks/useClientPagination';
import type { DemandForecast } from '@/lib/forecast/demand';

type Resumen = {
  productos_analizados: number;
  reorden_urgente: number;
  reorden_sugerida: number;
  unidades_sugeridas: number;
};

const URGENCIA_BADGE: Record<DemandForecast['urgencia'], string> = {
  alta: 'badge-danger',
  media: 'badge-warning',
  baja: 'badge-info',
  ok: 'badge-success',
};

export function DemandForecastPanel() {
  const [loading, setLoading] = useState(true);
  const [forecasts, setForecasts] = useState<DemandForecast[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventario/prediccion');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setForecasts(json.data ?? []);
      setResumen(json.resumen ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al calcular predicción');
    }
    setLoading(false);
  };

  useEffect(() => { fetchForecast(); }, []);
  const { paginated, pagination } = useClientPagination(forecasts, 10, [forecasts.length]);

  return (
    <>
      <div className="dashboard-grid grid-4" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--accent-blue-soft)' }}>
            <Package size={22} color="var(--brand)" />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Analizados</span>
            <span className="stat-card-value">{resumen?.productos_analizados ?? '—'}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--accent-pink-soft)' }}>
            <AlertTriangle size={22} color="var(--danger)" />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Reorden urgente</span>
            <span className="stat-card-value">{resumen?.reorden_urgente ?? '—'}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--accent-yellow-soft)' }}>
            <TrendingUp size={22} color="var(--warning)" />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Sugerencias</span>
            <span className="stat-card-value">{resumen?.reorden_sugerida ?? '—'}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--accent-teal-soft)' }}>
            <Package size={22} color="var(--accent-teal)" />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Unidades sugeridas</span>
            <span className="stat-card-value">{resumen?.unidades_sugeridas ?? '—'}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <ActionButton size="sm" loading={loading} icon={<RefreshCw size={14} />} onClick={fetchForecast}>
          Recalcular
        </ActionButton>
      </div>

      <TablePanel pagination={pagination}>
        <table className="table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Stock</th>
              <th>Ventas 30d</th>
              <th>Prom. semanal</th>
              <th>Demanda 30d</th>
              <th>Sugerido</th>
              <th>Tendencia</th>
              <th>Urgencia</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="table-empty">Calculando predicción...</td></tr>
            ) : forecasts.length === 0 ? (
              <tr><td colSpan={8} className="table-empty">Sin datos de ventas suficientes para predecir</td></tr>
            ) : paginated.map((f) => (
              <tr key={f.producto_id}>
                <td>
                  <strong>{f.nombre}</strong>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{f.codigo}</div>
                </td>
                <td>{f.stock_actual}</td>
                <td>{f.ventas_30d}</td>
                <td>{f.promedio_semanal}</td>
                <td style={{ fontWeight: 700 }}>{f.demanda_proyectada_30d}</td>
                <td style={{ fontWeight: 700, color: f.cantidad_sugerida > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                  {f.cantidad_sugerida > 0 ? `+${f.cantidad_sugerida}` : '—'}
                </td>
                <td style={{ color: f.tendencia_pct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {f.tendencia_pct >= 0 ? '+' : ''}{f.tendencia_pct}%
                </td>
                <td><span className={`badge ${URGENCIA_BADGE[f.urgencia]}`}>{f.urgencia}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>
    </>
  );
}
