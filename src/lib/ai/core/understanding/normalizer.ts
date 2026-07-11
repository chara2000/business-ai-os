export const UniversalNormalizer = {
  /**
   * Normaliza un nombre de entidad (Producto, Cliente, Marca)
   * Ej: "baterías para la moto Suzuki GN" -> "BATERIA SUZUKI GN"
   */
  normalizeEntityName: (name: string): string => {
    let n = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Eliminar artículos y preposiciones comunes
    const stopWords = ['para', 'la', 'el', 'los', 'las', 'de', 'del', 'un', 'una', 'unos', 'unas', 'mi', 'mis'];
    const regex = new RegExp(`\\b(${stopWords.join('|')})\\b`, 'gi');
    n = n.replace(regex, ' ');

    // Convertir plurales muy comunes a singular (heurística simple)
    n = n.replace(/\bbaterias?\b/g, 'bateria');
    n = n.replace(/\bllantas?\b/g, 'llanta');
    n = n.replace(/\bfiltros?\b/g, 'filtro');
    n = n.replace(/\baceites?\b/g, 'aceite');
    
    // Normalizar abreviaciones comunes
    n = n.replace(/\bcll\b/g, 'calle');
    n = n.replace(/\bcra\b/g, 'carrera');
    n = n.replace(/\bav\b/g, 'avenida');

    // Limpiar espacios extra y caracteres especiales extraños
    n = n.replace(/[^a-z0-9\s-]/g, '');
    n = n.replace(/\s+/g, ' ').trim();

    return n.toUpperCase();
  },

  /**
   * Normaliza números escritos o sucios
   * Ej: "veinte mil" -> 20000, "$25,000" -> 25000
   */
  normalizeQuantity: (value: string | number): number | null => {
    if (typeof value === 'number') return value;
    let t = value.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Mapeo básico de naturales
    const naturalMap: Record<string, number> = {
      uno: 1, una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
      seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
      veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50
    };

    // "veinte mil"
    if (t.includes('mil')) {
      const numPart = t.replace('mil', '').trim();
      if (naturalMap[numPart]) return naturalMap[numPart] * 1000;
      const parsed = parseFloat(numPart);
      if (!isNaN(parsed)) return parsed * 1000;
    }

    if (naturalMap[t]) return naturalMap[t];

    const cleanNumber = value.replace(/[^\d.]/g, '');
    const num = parseFloat(cleanNumber);
    return isNaN(num) ? null : num;
  },

  normalizeEmail: (email: string): string => {
    let t = email.toLowerCase().trim();
    t = t.replace(/\s+arroba\s+/g, '@');
    t = t.replace(/\s+punto\s+/g, '.');
    t = t.replace(/\s+/g, '');
    return t;
  }
};
