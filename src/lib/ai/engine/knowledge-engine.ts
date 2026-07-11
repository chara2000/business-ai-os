/** Base de conocimiento: palabras clave → categoría de negocio */
import { FIELD_LABELS } from './types';
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Eléctrico': [
    'bombilla', 'bombillo', 'foco', 'lámpara', 'lampara', 'cable', 'thhn', 'interruptor',
    'tomacorriente', 'breaker', 'fusible', 'led', 'fluorescente', 'iluminación', 'iluminacion',
    'ax100', 'tubo led', 'batería', 'bateria', 'baterías', 'baterias',
  ],
  'Iluminación': ['spot', 'panel led', 'downlight', 'reflector'],
  'Herramientas': [
    'martillo', 'destornillador', 'taladro', 'llave', 'alicate', 'sierra', 'pala', 'pico',
    'cincel', 'nivel', 'cinta métrica', 'broca',
  ],
  'Plomería': [
    'tubo', 'pvc', 'codos', 'tee', 'llave de paso', 'grifería', 'griferia', 'sifón', 'sifon',
    'cañería', 'caneria', 'empaque', 'teflón',
  ],
  'Pinturas': ['pintura', 'brocha', 'rodillo', 'thinner', 'esmalte', 'latex', 'barniz'],
  Automotriz: ['llanta', 'llantas', 'neumático', 'neumatico', 'rin', 'rines', 'filtro de aceite', 'bujía', 'bujia'],
  'Ferretería general': ['tornillo', 'clavo', 'perno', 'tuerca', 'arandela', 'bisagra', 'cerradura'],
  'Construcción': ['cemento', 'arena', 'ladrillo', 'bloque', 'varilla', 'malla', 'alambre'],
};

const UNIT_DEFAULTS: Record<string, string> = {
  cable: 'metro', thhn: 'metro', pintura: 'galón', cemento: 'bulto',
};

/** Sinónimos de campos para correcciones conversacionales */
export const FIELD_SYNONYMS: Record<string, string> = {
  proveedor: 'proveedor',
  proveedores: 'proveedor',
  categoría: 'categoria',
  categoria: 'categoria',
  marca: 'marca',
  cantidad: 'cantidad',
  stock: 'cantidad',
  unidades: 'cantidad',
  precio: 'precio_venta',
  'precio venta': 'precio_venta',
  'precio compra': 'precio_costo',
  compra: 'precio_costo',
  iva: 'tasa_iva',
  cliente: 'cliente',
  producto: 'nombre',
  nombre: 'nombre',
  bodega: 'bodega',
  sucursal: 'sucursal',
  descripción: 'descripcion',
  descripcion: 'descripcion',
  código: 'codigo',
  codigo: 'codigo',
  'código barras': 'codigo_barras',
  'stock mínimo': 'stock_minimo',
  'stock minimo': 'stock_minimo',
};

export function inferCategoryFromText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return null;
}

export function inferUnitFromText(text: string): string {
  const lower = text.toLowerCase();
  for (const [kw, unit] of Object.entries(UNIT_DEFAULTS)) {
    if (lower.includes(kw)) return unit;
  }
  return 'unidad';
}

export function normalizeFieldKey(input: string): string | null {
  const key = input.trim().toLowerCase();
  return FIELD_SYNONYMS[key] ?? (FIELD_LABELS[key] ? key : null);
}

const KNOWN_BRANDS = ['bosch', 'suzuki', 'dewalt', 'stanley', 'black+decker', 'makita', 'truper', 'pretul', 'disco'];

export function inferMarcaFromText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const brand of KNOWN_BRANDS) {
    if (lower.includes(brand)) {
      return brand.charAt(0).toUpperCase() + brand.slice(1).replace('+', '+');
    }
  }
  return null;
}

export function getKnowledgeHints(productName: string): {
  categoria?: string;
  unidad?: string;
  marca?: string;
} {
  return {
    categoria: inferCategoryFromText(productName) ?? undefined,
    unidad: inferUnitFromText(productName),
    marca: inferMarcaFromText(productName) ?? undefined,
  };
}
