type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
  companyId?: string;
  originalText?: string;
  transcription?: string;
  correctedText?: string;
  normalizedText?: string;
  entitiesDetected?: any;
  confidence?: number;
  embeddingsUsed?: boolean;
  aliasesUsed?: string[];
  toolExecuted?: string;
  responseTimeMs?: number;
  tokensUsed?: number;
  error?: any;
  [key: string]: any;
}

export const UnderstandingLogger = {
  log: (level: LogLevel, action: string, payload: LogPayload) => {
    // Aquí idealmente enviaríamos a un servicio de observabilidad (Datadog, Sentry, Axiom, etc)
    // Por ahora registramos en consola estructuradamente
    const ts = new Date().toISOString();
    const logString = JSON.stringify({ timestamp: ts, level, action, ...payload });
    
    if (level === 'error') {
      console.error(`[UnderstandingLayer] ERROR: ${action}`, logString);
    } else if (level === 'warn') {
      console.warn(`[UnderstandingLayer] WARN: ${action}`, logString);
    } else {
      console.log(`[UnderstandingLayer] ${level.toUpperCase()}: ${action}`, logString);
    }
  },
  info: (action: string, payload: LogPayload) => UnderstandingLogger.log('info', action, payload),
  warn: (action: string, payload: LogPayload) => UnderstandingLogger.log('warn', action, payload),
  error: (action: string, payload: LogPayload) => UnderstandingLogger.log('error', action, payload),
  debug: (action: string, payload: LogPayload) => {
    if (process.env.NODE_ENV !== 'production') {
      UnderstandingLogger.log('debug', action, payload);
    }
  }
};
