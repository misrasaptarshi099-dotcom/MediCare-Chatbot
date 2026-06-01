/**
 * In-Memory Rate Limiter
 *
 * Provides per-key rate limiting using a sliding-window counter stored in a
 * module-level Map. Because Next.js serverless functions retain module state
 * across warm invocations, this is effective at blocking burst abuse without
 * requiring Redis or Firestore writes.
 *
 * Stale entries are lazily pruned on every check to prevent unbounded growth.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// Module-level singleton — survives across warm invocations
const store = new Map<string, RateLimitEntry>()

// Prune expired entries every 100 calls to prevent memory leaks
let callsSincePrune = 0
const PRUNE_INTERVAL = 100

function pruneExpired() {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key)
    }
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Check and consume a rate-limit token for the given key.
 *
 * @param key       Unique identifier (e.g. IP, UID, phone number)
 * @param limit     Maximum number of requests allowed in the window
 * @param windowMs  Window duration in milliseconds
 * @returns         Whether the request is allowed, remaining tokens, and reset time
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  if (limit <= 0 || windowMs <= 0) {
    return { allowed: false, remaining: 0, resetAt: Date.now() }
  }

  callsSincePrune++
  if (callsSincePrune >= PRUNE_INTERVAL) {
    pruneExpired()
    callsSincePrune = 0
  }

  const now = Date.now()
  const entry = store.get(key)

  // No existing entry or window has expired — start fresh
  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  // Window is still active
  if (entry.count < limit) {
    entry.count++
    return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
  }

  // Rate limit exceeded
  return { allowed: false, remaining: 0, resetAt: entry.resetAt }
}

/**
 * Build a prefixed key to namespace different rate-limit rules.
 * Example: rateLimitKey('chat-minute', '1.2.3.4') → 'chat-minute:1.2.3.4'
 */
export function rateLimitKey(prefix: string, identifier: string): string {
  return `${prefix}:${identifier}`
}

/**
 * Extract the client IP from a Next.js request.
 * Falls back to 'unknown' if no forwarding header is present.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}
