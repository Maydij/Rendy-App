import { serverEnv } from './env';

export interface RateLimitConfig {
  bucketPrefix: string;
  maxRequests: number;
  windowSeconds: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export const RATE_LIMIT_POLICIES = {
  AUTH_STRICT: {
    bucketPrefix: 'rl:auth',
    maxRequests: 5,
    windowSeconds: 15 * 60, // 5 attempts per 15 minutes
  },
  PAYMENT_STRICT: {
    bucketPrefix: 'rl:pay',
    maxRequests: 3,
    windowSeconds: 60, // 3 requests per minute
  },
  ONBOARDING_STEP: {
    bucketPrefix: 'rl:onboard',
    maxRequests: 20,
    windowSeconds: 10 * 60, // 20 step saves per 10 minutes
  },
} as const satisfies Record<string, RateLimitConfig>;

// In-memory fallback store used strictly when Redis is not configured in local dev
const memoryCounters = new Map<string, { count: number; expiresAt: number }>();
const memoryIdempotency = new Map<string, { payload: string; expiresAt: number }>();

/**
 * @name executeUpstashCommand
 * @description [Infrastructure]: Dispatches atomic REST commands to Upstash Redis.
 */
async function executeUpstashCommand<T>(commandParts: (string | number)[]): Promise<T | null> {
  const url = serverEnv.UPSTASH_REDIS_REST_URL;
  const token = serverEnv.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commandParts),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Redis command failed with status ${response.status}`);
  }

  const json = (await response.json()) as { result: T };
  return json.result;
}

/**
 * @name enforceRateLimit
 * @description [Business Logic]: Enforces distributed sliding/fixed-window rate limiting
 * across authentication, payment, and onboarding endpoints to neutralize brute-force and card-testing attacks.
 */
export async function enforceRateLimit(
  identifierHash: string,
  policy: RateLimitConfig
): Promise<RateLimitVerdict> {
  const key = `${policy.bucketPrefix}:${identifierHash}`;

  try {
    if (serverEnv.UPSTASH_REDIS_REST_URL && serverEnv.UPSTASH_REDIS_REST_TOKEN) {
      const currentCount = await executeUpstashCommand<number>(['INCR', key]);
      if (currentCount === 1) {
        await executeUpstashCommand<number>(['EXPIRE', key, policy.windowSeconds]);
      }

      const ttl = (await executeUpstashCommand<number>(['TTL', key])) ?? policy.windowSeconds;
      const count = currentCount ?? 1;

      if (count > policy.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, ttl),
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, policy.maxRequests - count),
        retryAfterSeconds: 0,
      };
    }
  } catch (error) {
    console.error('⚠️ [RedisGuard] Fallback to local rate-limit store:', error);
  }

  // Fallback deterministic counter
  const now = Date.now();
  const existing = memoryCounters.get(key);
  if (!existing || existing.expiresAt <= now) {
    memoryCounters.set(key, {
      count: 1,
      expiresAt: now + policy.windowSeconds * 1000,
    });
    return { allowed: true, remaining: policy.maxRequests - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > policy.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.expiresAt - now) / 1000),
    };
  }

  return {
    allowed: true,
    remaining: policy.maxRequests - existing.count,
    retryAfterSeconds: 0,
  };
}

/**
 * @name acquireIdempotencyLock
 * @description [Business Logic]: Atomically claims a UUIDv4 Idempotency-Key in Redis (`SETNX` with 24h TTL)
 * so concurrent or retried payment/subscription requests never execute duplicate Stripe charges.
 */
export async function acquireIdempotencyLock(
  idempotencyKey: string
): Promise<{ acquired: boolean; cachedResponse?: string }> {
  const redisKey = `idem:pay:${idempotencyKey}`;
  const ttlSeconds = 24 * 60 * 60; // 24 hours

  if (serverEnv.UPSTASH_REDIS_REST_URL && serverEnv.UPSTASH_REDIS_REST_TOKEN) {
    const setResult = await executeUpstashCommand<string | null>([
      'SET',
      redisKey,
      'IN_PROGRESS',
      'NX',
      'EX',
      ttlSeconds,
    ]);

    if (setResult === 'OK') {
      return { acquired: true };
    }

    const existingValue = await executeUpstashCommand<string | null>(['GET', redisKey]);
    return {
      acquired: false,
      cachedResponse: existingValue && existingValue !== 'IN_PROGRESS' ? existingValue : undefined,
    };
  }

  const now = Date.now();
  const existing = memoryIdempotency.get(redisKey);
  if (existing && existing.expiresAt > now) {
    return {
      acquired: false,
      cachedResponse: existing.payload !== 'IN_PROGRESS' ? existing.payload : undefined,
    };
  }

  memoryIdempotency.set(redisKey, {
    payload: 'IN_PROGRESS',
    expiresAt: now + ttlSeconds * 1000,
  });
  return { acquired: true };
}

/**
 * @name storeIdempotencyResult
 * @description [Business Logic]: Persists the finalized JSON response for an Idempotency-Key
 * for 24 hours so safe retries receive the exact original result.
 */
export async function storeIdempotencyResult(
  idempotencyKey: string,
  serializedPayload: string
): Promise<void> {
  const redisKey = `idem:pay:${idempotencyKey}`;
  const ttlSeconds = 24 * 60 * 60;

  if (serverEnv.UPSTASH_REDIS_REST_URL && serverEnv.UPSTASH_REDIS_REST_TOKEN) {
    await executeUpstashCommand<string>(['SET', redisKey, serializedPayload, 'EX', ttlSeconds]);
    return;
  }

  memoryIdempotency.set(redisKey, {
    payload: serializedPayload,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * @name releaseIdempotencyLock
 * @description [Business Logic]: Releases an in-progress Idempotency-Key lock when an
 * upstream payment initialization fails prior to creating a charge or subscription,
 * allowing safe retries without triggering HTTP 409 Conflict.
 */
export async function releaseIdempotencyLock(idempotencyKey: string): Promise<void> {
  const redisKey = `idem:pay:${idempotencyKey}`;

  if (serverEnv.UPSTASH_REDIS_REST_URL && serverEnv.UPSTASH_REDIS_REST_TOKEN) {
    await executeUpstashCommand<number>(['DEL', redisKey]);
    return;
  }

  memoryIdempotency.delete(redisKey);
}