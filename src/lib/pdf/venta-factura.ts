import type { Empresa, Venta } from '@/types';

type VentaConItems = Venta & {
  items_venta?: { cantidad: number; precio_unitario: number; subtotal: number; producto?: { nombre: string; codigo?: string } }[];
};

export function printVentaFactura(venta: VentaConItems, empresa?: Partial<Empresa> | null) {
  const items = venta.items_venta ?? [];
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Factura ${venta.numero}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; color: #111; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .meta { color: #555; font-size: 13px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border-bottom: 1px solid #ddd; padding: 10px 8px; text-align: left; font-size: 13px; }
    th { background: #f5f5f5; }
    .totals { margin-left: auto; width: 280px; }
    .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
    .total { font-size: 18px; font-weight: bold; border-top: 2px solid #111; margin-top: 8px; padding-top: 8px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>${empresa?.nombre ?? 'Business OS'}</h1>
  <div class="meta">${empresa?.direccion ?? ''} ${empresa?.ciudad ? '· ' + empresa.ciudad : ''}</div>
  <div class="grid">
    <div>
      <strong>Factura / Venta</strong><br/>
      Nº ${venta.numero}<br/>
      Fecha: ${new Date(venta.created_at).toLocaleString('es-CO')}
    </div>
    <div>
      <strong>Cliente</strong><br/>
      ${venta.cliente?.nombre ?? 'Consumidor final'} ${venta.cliente?.apellido ?? ''}<br/>
      Método: ${venta.metodo_pago}
    </div>
  </div>
  <table>
    <thead><tr><th>Producto</th><th>Cant.</th><th>P. Unit.</th><th>Subtotal</th></tr></thead>
    <tbody>
      ${items.map((it) => `
        <tr>
          <td>${it.producto?.nombre ?? 'Producto'}</td>
          <td>${it.cantidad}</td>
          <td>$${(it.precio_unitario ?? 0).toLocaleString('es-CO')}</td>
          <td>$${(it.subtotal ?? 0).toLocaleString('es-CO')}</td>
        </tr>`).join('')}
    </tbody>
  </table>
  <div class="totals">
    <div><span>Subtotal</span><span>$${(venta.subtotal ?? 0).toLocaleString('es-CO')}</span></div>
    <div><span>Descuento</span><span>$${(venta.descuento ?? 0).toLocaleString('es-CO')}</span></div>
    <div><span>Impuestos</span><span>$${(venta.impuestos ?? 0).toLocaleString('es-CO')}</span></div>
    <div class="total"><span>Total</span><span>$${(venta.total ?? 0).toLocaleString('es-CO')}</span></div>
  </div>
  <p style="margin-top:40px;font-size:11px;color:#888;">Documento generado por Business OS</p>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
