/**
 * In-memory sliding-window limiter. Per-instance only: on Fluid Compute each
 * warm instance has its own map, so this is best-effort abuse damping, not a
 * hard guarantee. Fine at this site's scale; revisit with a shared store if
 * that ever changes.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();
  return {
    allow(key: string, now: number = Date.now()): boolean {
      const cutoff = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}

/** Shared limiter for /api/subscribe: 5 attempts per 10 minutes per IP. */
export const subscribeLimiter = createRateLimiter({ limit: 5, windowMs: 600_000 });
