import { ConfirmationManager } from './src/lib/ai/engine/confirmation-manager';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://mock.supabase.co', 'mock-key');
const manager = new ConfirmationManager(supabase, 'mock-empresa');

const args = {
  proveedor: 'Suzuki',
  productos: [
    { nombre: 'Manzanas', cantidad: 10, costo_unitario: 20000, precio_venta: 35000 }
  ],
  metodo_pago: 'Nequi'
};

manager.buildConfirmation('crear_compra', args, 'mock-session')
  .then(res => console.log('SUCCESS:', JSON.stringify(res, null, 2)))
  .catch(err => console.error('ERROR:', err));
