export type AIAction = {
  accion: string;
  entidad?: string;
  datos?: Record<string, unknown>;
  confirmacion_requerida?: boolean;
};

export type AIExecuteResult = {
  success: boolean;
  message: string;
  data?: unknown;
  entidad_id?: string;
};
