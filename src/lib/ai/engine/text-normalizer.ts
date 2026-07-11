/** Normaliza mensajes de voz/texto antes del motor IA */
export function normalizeUserMessage(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .trim();
}

export function detectMessageLanguage(text: string): 'es' | 'en' {
  const t = text.toLowerCase();
  const esHits = (t.match(/\b(el|la|los|las|compré|agrega|venta|cliente|proveedor|cuánto|cuanto)\b/g) ?? []).length;
  const enHits = (t.match(/\b(the|add|sale|customer|supplier|how much|inventory)\b/g) ?? []).length;
  return enHits > esHits ? 'en' : 'es';
}
