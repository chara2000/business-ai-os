export class ToolCache {
  private cache = new Map<string, { result: any, expiresAt: number }>();
  
  constructor(private defaultTtlMs = 15000) {}

  generateKey(toolName: string, args: unknown): string {
    return `${toolName}:${JSON.stringify(args)}`;
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.result;
  }

  set(key: string, result: any, ttlMs?: number) {
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs)
    });
  }

  clear() {
    this.cache.clear();
  }
}
