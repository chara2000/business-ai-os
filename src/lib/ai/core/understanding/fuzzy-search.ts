import { UNDERSTANDING_CONFIG } from './config';

export function calculateLevenshtein(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
}

export const FuzzySearch = {
  /**
   * Realiza una búsqueda aproximada usando intersección de tokens y Levenshtein
   * Devuelve un score (0 a 1) donde 1 es coincidencia exacta
   */
  match: <T>(query: string, items: T[], nameKey: string = 'name'): { item: T, score: number } | null => {
    if (!UNDERSTANDING_CONFIG.ENABLE_FUZZY_SEARCH) return null;
    
    const qTokens = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (!qTokens.length) {
      const exact = items.find(i => String((i as any)[nameKey]).toLowerCase().includes(query.toLowerCase()));
      return exact ? { item: exact, score: 0.8 } : null;
    }

    let bestMatch: T | null = null;
    let maxScore = 0;

    for (const item of items) {
      const targetName = String((item as any)[nameKey]).toLowerCase();
      let rawScore = 0;
      
      // Token intersection
      for (const t of qTokens) {
        if (targetName.includes(t)) rawScore += t.length;
        else {
          // Si no incluye directamente, probamos Levenshtein para typos ("hena" vs "gn", aunque "gn" es muy corto)
          const targetTokens = targetName.split(/\s+/);
          for (const tt of targetTokens) {
            if (tt.length > 2 && t.length > 2) {
              const dist = calculateLevenshtein(t, tt);
              if (dist <= 2) rawScore += (t.length - dist);
            }
          }
        }
      }

      if (targetName.includes(query.toLowerCase())) rawScore += 10;
      
      if (rawScore > maxScore) {
        maxScore = rawScore;
        bestMatch = item;
      }
    }

    // Normalizar el score vagamente
    const normalizedScore = Math.min(1.0, maxScore / (query.length || 1));
    
    if (maxScore > 2 && bestMatch) {
      return { item: bestMatch, score: normalizedScore };
    }
    
    return null;
  }
};
