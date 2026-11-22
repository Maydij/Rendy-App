/**
 * @name UrlResolutionUtils
 * @description [Business Logic]: Multi-tier environment domain and base URL resolver for Rendy.
 * Automatically identifies the execution context across 3 distinct tiers:
 * 1. Localhost (Development): http://localhost:3000
 * 2. Staging (QA / Pre-production): https://rendystaging.vercel.app
 * 3. Production: Configured corporate domain (e.g. https://rendy.com) with defensive fallback.
 * Employs zero-trust host validation to defend against Host-Header Poisoning and SSRF attacks.
 */

export const CANONICAL_DOMAINS = {
  LOCAL: 'http://localhost:3000',
  STAGING: 'https://rendystaging.vercel.app',
  // Default fallback for production until the commercial domain is purchased and bound
  PRODUCTION_FALLBACK: 'https://rendystaging.vercel.app',
} as const;

/**
 * Whitelist regex patterns to prevent Host-Header injection / poisoning attacks.
 */
const TRUSTED_HOST_PATTERNS: RegExp[] = [
  /^localhost(:\d+)?$/,
  /^127\.0\.0\.1(:\d+)?$/,
  /^rendystaging\.vercel\.app$/,
  /^[a-zA-Z0-9-]+\.vercel\.app$/,
  /^rendy\.[a-z]+$/,
  /^[a-zA-Z0-9-]+\.rendy\.[a-z]+$/,
];

/**
 * @name isTrustedHost
 * @description [Security]: Verifies whether an incoming HTTP Host header belongs to authorized
 * Rendy infrastructure (localhost, Vercel preview/staging subdomains, or verified corporate domains).
 */
export function isTrustedHost(host: string): boolean {
  if (!host || typeof host !== 'string') return false;
  const cleanHost = host.trim().toLowerCase();
  return TRUSTED_HOST_PATTERNS.some((pattern) => pattern.test(cleanHost));
}

/**
 * @name cleanBaseUrl
 * @description [Helper]: Strips trailing slashes from a URL to prevent double-slash path concatenation.
 */
export function cleanBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * @name resolveAppBaseUrl
 * @description [Business Logic]: Determines the authoritative base URL for magic links, QR codes,
 * and email notifications. Priority hierarchy:
 * 1. Active HTTP Request Headers (x-forwarded-host / host) if trusted.
 * 2. Explicit Environment Variable (NEXT_PUBLIC_APP_URL) if valid and context-appropriate.
 * 3. Vercel System Variables (VERCEL_PROJECT_PRODUCTION_URL, VERCEL_URL).
 * 4. Staging / Localhost fallback depending on VERCEL_ENV or NODE_ENV.
 */
export function resolveAppBaseUrl(
  requestHeaders?: Headers | { get(name: string): string | null }
): string {
  // 1. Dynamic Request Inspection (highest precision when invoked within Server Actions or RSC)
  if (requestHeaders) {
    const forwardedHost = requestHeaders.get('x-forwarded-host');
    const directHost = requestHeaders.get('host');
    const incomingHost = (forwardedHost || directHost)?.split(',')[0].trim();

    if (incomingHost && isTrustedHost(incomingHost)) {
      const forwardedProto = requestHeaders.get('x-forwarded-proto')?.split(',')[0].trim();
      const isLocal = incomingHost.startsWith('localhost') || incomingHost.startsWith('127.0.0.1');
      const protocol = forwardedProto || (isLocal ? 'http' : 'https');
      return cleanBaseUrl(`${protocol}://${incomingHost}`);
    }
  }

  // 2. Explicit NEXT_PUBLIC_APP_URL evaluation
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const isVercelEnvironment = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

  if (envUrl && envUrl.length > 0) {
    // If deployed on Vercel but someone inadvertently configured localhost, ignore it
    const isLocalhostUrl = envUrl.includes('localhost') || envUrl.includes('127.0.0.1');
    if (!isVercelEnvironment || !isLocalhostUrl) {
      return cleanBaseUrl(envUrl);
    }
  }

  // 3. Vercel System Deployment Variables (automatically injected by Vercel platform)
  const vercelEnv = process.env.VERCEL_ENV; // 'production' | 'preview' | 'development'

  if (vercelEnv === 'preview') {
    // In staging / preview branch environments
    if (process.env.VERCEL_URL) {
      return cleanBaseUrl(`https://${process.env.VERCEL_URL}`);
    }
    return CANONICAL_DOMAINS.STAGING;
  }

  if (vercelEnv === 'production') {
    // In Vercel production: check if a custom production domain was bound
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      return cleanBaseUrl(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
    }
    return CANONICAL_DOMAINS.PRODUCTION_FALLBACK;
  }

  // 4. Fallback based on Node execution environment
  if (process.env.NODE_ENV === 'production') {
    return CANONICAL_DOMAINS.STAGING;
  }

  return CANONICAL_DOMAINS.LOCAL;
}

/**
 * @name buildInvitationMagicLinkUrl
 * @description [Business Logic]: Constructs a fully qualified single-use activation URL
 * containing the 256-bit cryptographic invitation token and pre-filled temporary access code.
 */
export function buildInvitationMagicLinkUrl(
  token: string,
  tempPassword: string,
  requestHeaders?: Headers | { get(name: string): string | null }
): string {
  const baseUrl = resolveAppBaseUrl(requestHeaders);
  return `${baseUrl}/invitacion/${token}?code=${encodeURIComponent(tempPassword)}`;
}
