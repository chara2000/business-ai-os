import { useAppStore } from '@/stores/appStore';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** ID del usuario en tabla `usuarios` (desde store) */
export function getUsuarioId(): string | null {
  return useAppStore.getState().usuario?.id ?? null;
}

export function generateDocNumber(prefix: string) {
  const stamp = Date.now().toString().slice(-6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${stamp}${rand}`;
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type MonthlyBucket = { mes: string; ingresos: number; gastos: number; ventas?: number; objetivo?: number; key: string };

/** Agrupa ventas y gastos por mes (últimos N meses) */
export function aggregateCashflow(
  ventas: { total: number; created_at: string }[],
  gastos: { monto: number; created_at: string }[],
  months = 6,
) {
  const now = new Date();
  const buckets: MonthlyBucket[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    buckets.push({ mes: MESES[d.getMonth()], ingresos: 0, gastos: 0, ventas: 0, objetivo: 0, key });
  }

  const bucketMap = new Map(buckets.map((b) => [b.key, b]));

  ventas.forEach((v) => {
    const d = new Date(v.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const row = bucketMap.get(key);
    if (row) {
      row.ingresos += v.total || 0;
      row.ventas = (row.ventas ?? 0) + (v.total || 0);
      row.objetivo = Math.round(row.ingresos * 1.1);
    }
  });

  gastos.forEach((g) => {
    const d = new Date(g.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const row = bucketMap.get(key);
    if (row) row.gastos += g.monto || 0;
  });

  return buckets.map(({ mes, ingresos, gastos, ventas: v, objetivo }) => ({
    mes,
    ingresos,
    gastos,
    ventas: v ?? ingresos,
    objetivo: objetivo ?? Math.round(ingresos * 1.1),
  }));
}

/** Agrupa gastos por categoría */
export function aggregateGastosByCategory(
  gastos: { categoria: string; monto: number }[],
  colors: string[],
) {
  const map: Record<string, number> = {};
  gastos.forEach((g) => {
    map[g.categoria] = (map[g.categoria] || 0) + (g.monto || 0);
  });
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([categoria, monto], i) => ({
      categoria,
      monto,
      color: colors[i % colors.length],
    }));
}

export function filterByPeriod<T extends { created_at: string }>(
  rows: T[],
  periodo: 'semana' | 'mes' | 'trimestre' | 'año' | 'anual',
): T[] {
  const now = new Date();
  let from: Date;
  switch (periodo) {
    case 'semana':
      from = new Date(now.getTime() - 7 * 86400000);
      break;
    case 'trimestre':
      from = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case 'año':
    case 'anual':
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case 'mes':
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return rows.filter((r) => new Date(r.created_at) >= from);
}
