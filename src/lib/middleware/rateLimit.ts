import { NextResponse } from 'next/server';

// In-memory rate limit store (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * Check rate limit for an IP address
 * Returns null if allowed, or a NextResponse if rate limited
 */
export function checkRateLimit(
  ip: string,
  config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 }
): NextResponse | null {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  // Clean up old entries periodically
  if (Math.random() < 0.01) {
    cleanupOldEntries();
  }

  if (!record || now > record.resetTime) {
    // First request or window expired
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return null;
  }

  if (record.count >= config.maxRequests) {
    // Rate limited
    return NextResponse.json(
      {
        error: 'Too many requests',
        message: 'Please wait before making more requests',
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(record.resetTime).toISOString(),
          'Retry-After': Math.ceil((record.resetTime - now) / 1000).toString(),
        },
      }
    );
  }

  // Increment count
  record.count++;
  return null;
}

/**
 * Clean up expired entries from the rate limit map
 */
function cleanupOldEntries(): void {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

/**
 * Rate limit middleware helper
 * Returns the rate limit response if limited, otherwise null
 */
export function rateLimit(
  request: Request,
  config?: RateLimitConfig
): NextResponse | null {
  const ip = getClientIP(request);
  return checkRateLimit(ip, config);
}
