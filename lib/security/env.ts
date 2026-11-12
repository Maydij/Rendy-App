import { z } from 'zod';

/**
 * @name emptyStringToUndefined
 * @description [Helper]: Normalizes blank environment variable assignments (`KEY=`) to `undefined`
 * so optional and defaulted Zod schemas evaluate cleanly.
 */
const emptyStringToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/**
 * @name ServerEnvSchema
 * @description [Security Governance]: Strict runtime validation schema for server-side
 * cryptographic keys, payment gateway secrets, and database credentials.
 */
const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_APP_URL: z.preprocess(
    emptyStringToUndefined,
    z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL (e.g. http://localhost:3000)')
  ),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(
    emptyStringToUndefined,
    z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL')
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(
    emptyStringToUndefined,
    z.string().min(20, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
  ),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(
    emptyStringToUndefined,
    z.string().min(20, 'SUPABASE_SERVICE_ROLE_KEY is required')
  ),

  // 32-byte (64 hex characters) AES-256-GCM Master Key for Envelope Encryption
  ENCRYPTION_MASTER_KEY: z.preprocess(
    emptyStringToUndefined,
    z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_MASTER_KEY must be exactly 64 hex characters (256-bit)')
  ),

  // Secret pepper for deterministic HMAC-SHA256 Blind Indexes on encrypted PII
  BLIND_INDEX_PEPPER: z.preprocess(
    emptyStringToUndefined,
    z.string().min(32, 'BLIND_INDEX_PEPPER must be at least 32 characters long')
  ),

  // Asymmetric EdDSA session signing secret
  SESSION_SIGNING_SECRET: z.preprocess(
    emptyStringToUndefined,
    z.string().min(48, 'SESSION_SIGNING_SECRET must be at least 48 characters long')
  ),

  // Stripe PCI-DSS Level 1 PSP Credentials
  STRIPE_SECRET_KEY: z.preprocess(
    emptyStringToUndefined,
    z.string().startsWith('sk_', 'STRIPE_SECRET_KEY must start with sk_test_ or sk_live_')
  ),
  STRIPE_WEBHOOK_SECRET: z.preprocess(
    emptyStringToUndefined,
    z.string().startsWith('whsec_', 'STRIPE_WEBHOOK_SECRET must start with whsec_')
  ),

  // Optional Redis credentials for distributed rate-limiting and idempotency locks
  UPSTASH_REDIS_REST_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  UPSTASH_REDIS_REST_TOKEN: z.preprocess(emptyStringToUndefined, z.string().min(10).optional()),

  // Official WhatsApp Business Bot number for employee activation links
  NEXT_PUBLIC_WHATSAPP_BOT_NUMBER: z.preprocess(
    emptyStringToUndefined,
    z
      .string()
      .regex(/^\d{10,15}$/, 'NEXT_PUBLIC_WHATSAPP_BOT_NUMBER must be digits only (e.g. 584121234567)')
      .default('15550000000')
  ),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

/**
 * @name validateServerEnvironment
 * @description [Business Logic]: Validates all critical security environment variables
 * before serving traffic. Terminates the process immediately if any secret is missing or weak.
 */
function validateServerEnvironment(): ServerEnv {
  const parsed = ServerEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(' | ');

    console.error('❌ [CRITICAL SECURITY FAILURE] Invalid or missing environment variables:');
    for (const issue of parsed.error.issues) {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    }

    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }

    throw new Error(`Server startup aborted due to invalid security configuration -> ${details}`);
  }

  return parsed.data;
}

export const serverEnv: ServerEnv = validateServerEnvironment();