import type { ConfirmationCard, EnrichedField } from '@/lib/ai/engine/types';
import { TELEGRAM_PRODUCT_REQUIRED } from '@/lib/ai/engine/business-rules';

const PENDING_LABELS: Record<string, string> = {
  nombre: '📦 Nombre',
  cantidad: '🔢 Cantidad',
  precio_costo: '💰 Precio de compra',
  precio_venta: '🏷️ Precio de venta',
  categoria: '📂 Categoría',
};

function fieldValue(campos: EnrichedField[], ...keys: string[]): string | null {
  const f = campos.find((c) => keys.includes(c.key));
  if (!f || f.value == null || f.value === '') return null;
  return f.displayValue ?? String(f.value);
}

function fieldNum(campos: EnrichedField[], ...keys: string[]): number {
  const f = campos.find((c) => keys.includes(c.key));
  if (!f?.value) return 0;
  const raw = String(f.value).replace(/[^\d.,-]/g, '');
  const n = Number(raw.replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(n) ? Number(f.value) : n;
}

function formatMoney(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') return `$${Math.round(value).toLocaleString('es-CO')}`;
  const raw = String(value).trim();
  const normalized = /^\d{1,3}(\.\d{3})+$/.test(raw)
    ? raw.replace(/\./g, '')
    : raw.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized.replace(/[^\d-]/g, ''));
  if (Number.isNaN(n)) return `$${raw}`;
  return `$${n.toLocaleString('es-CO')}`;
}

function formatCantidad(campos: EnrichedField[]): string | null {
  const qty = fieldValue(campos, 'cantidad', 'stock_actual');
  if (!qty) return null;
  const unidad = fieldValue(campos, 'unidad') ?? 'unidad';
  const plural = unidad.toLowerCase() === 'unidad' ? 'unidades' : unidad;
  return `${qty} ${plural}`;
}

function capitalizeName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function getAutoConfigLines(campos: EnrichedField[]): string[] {
  const autoKeys = new Set(['unidad', 'stock_minimo', 'bodega', 'sucursal', 'tasa_iva', 'proveedor', 'marca']);
  const lines: string[] = [];
  for (const c of campos) {
    if (!autoKeys.has(c.key)) continue;
    if (!['inferido', 'historial', 'defecto'].includes(c.source)) continue;
    if (c.value == null || c.value === '') continue;
    const label = c.key === 'tasa_iva' ? 'IVA' : c.label;
    const val = c.key === 'unidad' ? capitalizeName(String(c.displayValue ?? c.value)) : (c.displayValue ?? c.value);
    lines.push(`• ${label}: ${val}`);
  }
  return lines;
}

function formatProductoPendiente(card: ConfirmationCard): string {
  const nombre = fieldValue(card.campos, 'nombre', 'producto') ?? 'Producto';
  const pending = card.pendientes_keys ?? [];

  const lines = [
    `📦 Producto: ${capitalizeName(nombre)}`,
    '',
    'Solo necesito estos datos:',
    '',
  ];

  for (const key of TELEGRAM_PRODUCT_REQUIRED) {
    if (!pending.includes(key)) continue;
    lines.push(`${PENDING_LABELS[key] ?? key}:`);
  }

  lines.push('', 'Escríbelos o envíalos por voz.');
  return lines.join('\n');
}

function formatProductoListo(card: ConfirmationCard): string {
  const nombre = capitalizeName(fieldValue(card.campos, 'nombre', 'producto') ?? 'Producto');
  const codigo = fieldValue(card.campos, 'codigo') ?? `PRD-${Math.floor(1000 + Math.random() * 9000)}`;
  const categoria = fieldValue(card.campos, 'categoria');
  const cantidad = formatCantidad(card.campos);
  const compraVal = fieldNum(card.campos, 'precio_costo', 'precio_compra');
  const ventaVal = fieldNum(card.campos, 'precio_venta');
  const margen = ventaVal > 0 ? Math.round(((ventaVal - compraVal) / ventaVal) * 100) : 0;

  const lines = [
    '🤖 Producto listo para registrar',
    '',
    `📦 ${nombre}`,
    `🆔 ${codigo}`,
  ];

  if (categoria) lines.push(`📂 ${categoria}`);
  if (cantidad) lines.push(`🔢 Stock: ${cantidad}`);
  if (compraVal > 0) lines.push(`💰 Compra: ${formatMoney(compraVal)}`);
  if (ventaVal > 0) lines.push(`🏷️ Venta: ${formatMoney(ventaVal)}`);
  if (compraVal > 0 && ventaVal > 0) lines.push(`📈 Margen: ${margen}%`);
  lines.push('🟢 Estado: Disponible');

  const autoLines = getAutoConfigLines(card.campos);
  if (autoLines.length) {
    lines.push('', '⚙️ Configurado automáticamente:', ...autoLines);
  }

  lines.push('', '¿Qué deseas hacer?');
  return lines.join('\n');
}

function formatProducto(card: ConfirmationCard): string {
  if (!card.listo_para_confirmar) return formatProductoPendiente(card);
  return formatProductoListo(card);
}

function formatCompraPendiente(card: ConfirmationCard): string {
  const productosField = card.campos.find(c => c.key === 'productos')?.value as any[] | undefined;
  const nombre = productosField?.[0]?.nombre ?? fieldValue(card.campos, 'nombre', 'producto') ?? 'Producto';
  const pending = card.pendientes_keys ?? [];
  const labels: Record<string, string> = {
    nombre: '📦 Producto',
    cantidad: '🔢 Cantidad',
    proveedor: '🏭 Proveedor',
    precio_costo: '💰 Precio unitario',
    metodo_pago: '💵 Método de pago',
    productos: '📦 Productos (Faltan detalles de los productos)'
  };

  const lines = [
    '🛒 Compra pendiente',
    '',
    `📦 ${capitalizeName(nombre)}`,
    '',
    'Solo necesito estos datos:',
    '',
  ];

  for (const key of pending) {
    lines.push(`${labels[key] ?? key}:`);
  }

  lines.push('', 'Escríbelos o envíalos por voz.');
  return lines.join('\n');
}

function formatCompraListo(card: ConfirmationCard): string {
  const productosField = card.campos.find(c => c.key === 'productos')?.value as any[] | undefined;
  const primerProducto = productosField?.[0];
  const nombre = capitalizeName(primerProducto?.nombre ?? fieldValue(card.campos, 'nombre', 'producto') ?? 'Producto');
  const proveedor = fieldValue(card.campos, 'proveedor') || 'automático';
  const cantidad = primerProducto?.cantidad ?? fieldValue(card.campos, 'cantidad') ?? '1';
  const categoria = primerProducto?.categoria ?? 'Sin categoría';
  
  // Get prices
  const rawUnitario = primerProducto?.costo_unitario ?? primerProducto?.precio_costo;
  const unitario = rawUnitario ? Number(String(rawUnitario).replace(/[^\d.-]/g, '')) : fieldNum(card.campos, 'precio_costo', 'precio_compra');
  const rawVenta = primerProducto?.precio_venta;
  const ventaVal = rawVenta ? Number(String(rawVenta).replace(/[^\d.-]/g, '')) : fieldNum(card.campos, 'precio_venta');
  
  const margen = ventaVal > 0 && unitario > 0 ? Math.round(((ventaVal - unitario) / ventaVal) * 100) : 43;

  const codigo = fieldValue(card.campos, 'codigo') ?? (card as any).args?.codigo ?? `PRD-${Math.floor(1000 + Math.random() * 9000)}`;
  const metodo = fieldValue(card.campos, 'metodo_pago');
  const esCredito = metodo === 'credito' || card.campos.some((c) => c.key === 'es_credito' && c.value === true);

  const lines = [
    '🛒 Compra lista para registrar',
    '',
    `📦 ${nombre}`,
    `🆔 ${codigo}`,
    `📂 ${categoria}`,
    `🔢 Stock: ${cantidad} unidades`,
    `💰 Compra: ${formatMoney(unitario)}`,
    `🏷️ Venta: ${formatMoney(ventaVal > 0 ? ventaVal : Math.round(unitario * 1.3))}`,
    `📈 Margen: ${margen}%`,
    '🟢 Estado: Disponible',
    '',
    '⚙️ Configurado automáticamente:',
    `• Proveedor: ${proveedor}`,
    '• Unidad: Unidad',
    '• IVA: 0%',
    '• Stock mínimo: 5',
    '• Bodega: Central',
    '• Sucursal: Principal',
    '',
    '¿Qué deseas hacer?'
  ];

  return lines.join('\n');
}

function formatCompra(card: ConfirmationCard): string {
  if (!card.listo_para_confirmar) return formatCompraPendiente(card);
  return formatCompraListo(card);
}

function formatGenerico(card: ConfirmationCard): string {
  if (!card.listo_para_confirmar) {
    const lines = [`📋 ${card.subtitulo ?? card.titulo}`, '', 'Faltan datos:', ''];
    for (const p of card.campos_pendientes) lines.push(`• ${p}`);
    lines.push('', 'Complétalos por texto o voz.');
    return lines.join('\n');
  }

  const lines = ['🤖 Listo para confirmar', '', `📋 ${card.subtitulo ?? card.titulo}`, ''];
  for (const c of card.campos) {
    if (c.value == null || c.value === '') continue;
    lines.push(`• ${c.label}: ${c.displayValue ?? c.value}`);
  }
  lines.push('', '¿Qué deseas hacer?');
  return lines.join('\n');
}

export function formatTelegramConfirmation(card: ConfirmationCard): string {
  if (card.entidad === 'producto' && ['crear_producto', 'actualizar_producto'].includes(card.accion)) {
    return formatProducto(card);
  }
  if (card.accion === 'crear_compra') {
    return formatCompra(card);
  }
  return formatGenerico(card);
}

export function buildConfirmationKeyboard(sessionId: string) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Registrar', callback_data: `ai:confirm:${sessionId}` },
        { text: '✏️ Editar', callback_data: `ai:edit:${sessionId}` },
      ],
      [{ text: '❌ Cancelar', callback_data: `ai:cancel:${sessionId}` }],
    ],
  };
}

export function parseConfirmationCallback(data: string): { action: 'confirm' | 'edit' | 'cancel'; sessionId: string } | null {
  const m = data.match(/^ai:(confirm|edit|cancel):([0-9a-f-]{36})$/i);
  if (!m) return null;
  return { action: m[1] as 'confirm' | 'edit' | 'cancel', sessionId: m[2] };
}
