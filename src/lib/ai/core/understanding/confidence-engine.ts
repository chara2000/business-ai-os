import { UNDERSTANDING_CONFIG } from './config';

export const ConfidenceEngine = {
  isConfident: (score: number): boolean => {
    return score >= UNDERSTANDING_CONFIG.CONFIDENCE_THRESHOLD;
  },

  calculateOverallConfidence: (scores: number[]): number => {
    if (scores.length === 0) return 0;
    const sum = scores.reduce((a, b) => a + b, 0);
    return sum / scores.length;
  }
};
