interface CachedToken {
  token: string;
  expiresAt: number;
}

export class TokenCache {
  private cache = new Map<string, CachedToken>();
  private readonly bufferMs = 5 * 60 * 1000; // Refresh 5 min before expiry

  set(userId: string, token: string, expiresInSeconds: number): void {
    this.cache.set(userId, {
      token,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    });
  }

  get(userId: string): string | undefined {
    const cached = this.cache.get(userId);
    if (!cached) return undefined;
    if (Date.now() >= cached.expiresAt - this.bufferMs) {
      this.cache.delete(userId);
      return undefined;
    }
    return cached.token;
  }

  delete(userId: string): void {
    this.cache.delete(userId);
  }

  clear(): void {
    this.cache.clear();
  }
}
