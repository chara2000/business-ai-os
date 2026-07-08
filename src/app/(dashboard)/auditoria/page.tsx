'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Filter, User, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { useEmpresa } from '@/lib/hooks/useEmpresa';
import { ModuleShell } from '@/components/ui/ModuleShell';
import { SearchField } from '@/components/ui/SearchField';
import type { AuditoriaLog } from '@/types';

const supabase = createClient();

type LogRow = AuditoriaLog & { usuario?: { nombre: string; apellido: string } };

export default function AuditoriaPage() {
  const { empresaId } = useEmpresa();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEntidad, setFiltroEntidad] = useState('');

  const fetchLogs = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    let query = supabase
      .from('auditoria_logs')
      .select('*, usuario:usuarios(nombre, apellido)')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (filtroEntidad) query = query.eq('entidad', filtroEntidad);

    const { data, error } = await query;
    if (error) toast.error('Error al cargar auditoría');
    else setLogs(data ?? []);
    setLoading(false);
  }, [empresaId, filtroEntidad]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const entidades = [...new Set(logs.map((l) => l.entidad))];

  const filtered = logs.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.accion.toLowerCase().includes(q) ||
      l.entidad.toLowerCase().includes(q) ||
      `${l.usuario?.nombre ?? ''} ${l.usuario?.apellido ?? ''}`.toLowerCase().includes(q)
    );
  });

  const moduleStats = [
    { label: 'Registros', value: logs.length, icon: Database, tone: 'brand' as const },
    { label: 'Entidades', value: entidades.length, icon: Shield, tone: 'success' as const },
    { label: 'Hoy', value: logs.filter((l) => new Date(l.created_at).toDateString() === new Date().toDateString()).length, icon: Filter, tone: 'warning' as const },
    { label: 'Usuarios', value: new Set(logs.map((l) => l.usuario_id).filter(Boolean)).size, icon: User, tone: 'neutral' as const },
  ];

  return (
    <ModuleShell
      boundedTable
      stats={moduleStats}
      toolbar={
        <>
          <SearchField value={search} onChange={setSearch} placeholder="Buscar acción, entidad o usuario..." />
          <select className="select" value={filtroEntidad} onChange={(e) => setFiltroEntidad(e.target.value)} style={{ height: 36, minWidth: 140 }}>
            <option value="">Todas las entidades</option>
            {entidades.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </>
      }
    >
      {loading ? (
        <div className="data-panel" style={{ padding: 16 }}>
          <div className="skeleton" style={{ height: 40, width: '100%', borderRadius: 8 }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon"><Shield size={24} /></div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>Sin registros de auditoría</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Las acciones del sistema y la IA aparecerán aquí</p>
        </div>
      ) : (
        <div className="data-panel data-panel--bounded">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {new Date(l.created_at).toLocaleString('es-CO')}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {l.usuario ? `${l.usuario.nombre} ${l.usuario.apellido ?? ''}`.trim() : 'Sistema'}
                  </td>
                  <td><span className="badge badge-info">{l.accion}</span></td>
                  <td style={{ textTransform: 'capitalize' }}>{l.entidad}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.datos_nuevos ? JSON.stringify(l.datos_nuevos) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModuleShell>
  );
}
