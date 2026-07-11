export const UNDERSTANDING_CONFIG = {
  ENABLE_EMBEDDINGS: process.env.ENABLE_EMBEDDINGS === 'true',
  ENABLE_ALIAS_ENGINE: process.env.ENABLE_ALIAS_ENGINE !== 'false',
  ENABLE_FUZZY_SEARCH: process.env.ENABLE_FUZZY_SEARCH !== 'false',
  ENABLE_LEARNING: process.env.ENABLE_LEARNING !== 'false',
  ENABLE_AUDIO_CONTEXT: process.env.ENABLE_AUDIO_CONTEXT !== 'false',
  CONFIDENCE_THRESHOLD: Number(process.env.CONFIDENCE_THRESHOLD) || 0.7,
  CACHE_TTL: Number(process.env.CACHE_TTL) || 3600, // 1 hour by default
};
