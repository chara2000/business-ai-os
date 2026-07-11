/** Código interno de producto (preview antes de guardar) */
export function previewProductCodigo(): string {
  return `PRD-${Date.now().toString().slice(-6)}`;
}
