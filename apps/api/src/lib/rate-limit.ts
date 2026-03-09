interface FixedWindowBucket {
  count: number;
  resetAt: number;
}

const fixedWindowBuckets = new Map<string, FixedWindowBucket>();
const concurrentBuckets = new Map<string, number>();

export function consumeFixedWindowRateLimit(params: {
  bucket: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; retryAfterMs: number; remaining: number } {
  const now = Date.now();
  const current = fixedWindowBuckets.get(params.bucket);

  if (!current || current.resetAt <= now) {
    fixedWindowBuckets.set(params.bucket, {
      count: 1,
      resetAt: now + params.windowMs,
    });

    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: Math.max(0, params.limit - 1),
    };
  }

  if (current.count >= params.limit) {
    return {
      allowed: false,
      retryAfterMs: Math.max(0, current.resetAt - now),
      remaining: 0,
    };
  }

  current.count += 1;
  fixedWindowBuckets.set(params.bucket, current);

  return {
    allowed: true,
    retryAfterMs: 0,
    remaining: Math.max(0, params.limit - current.count),
  };
}

export function acquireConcurrentLease(params: {
  bucket: string;
  limit: number;
}): { allowed: boolean; release: () => void } {
  const current = concurrentBuckets.get(params.bucket) ?? 0;
  if (current >= params.limit) {
    return {
      allowed: false,
      release: () => {},
    };
  }

  concurrentBuckets.set(params.bucket, current + 1);

  let released = false;
  return {
    allowed: true,
    release: () => {
      if (released) {
        return;
      }

      released = true;
      const next = Math.max(0, (concurrentBuckets.get(params.bucket) ?? 1) - 1);
      if (next === 0) {
        concurrentBuckets.delete(params.bucket);
        return;
      }

      concurrentBuckets.set(params.bucket, next);
    },
  };
}
