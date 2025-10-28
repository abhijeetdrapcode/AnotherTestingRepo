import rateLimit from 'express-rate-limit';
import { logWarn } from '../utils/logger';

/**
 * Create a rate limiter middleware
 * @param {Object} options - Rate limiter options
 * @returns {Function} Rate limiter middleware
 */
export const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // Limit each IP to 100 requests per windowMs
    message = 'Too many requests from this IP, please try again later.',
    keyGenerator = (req) => req.ip,
    skip = () => false,
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: { success: false, error: { message, code: 'RATE_LIMIT_EXCEEDED' } },
    keyGenerator,
    skip,
    handler: (req, res) => {
      logWarn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userId: req.user?.id,
        tenantId: req.tenant?.id,
      });
      res.status(429).json({
        success: false,
        error: {
          message,
          code: 'RATE_LIMIT_EXCEEDED',
        },
      });
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });
};

/**
 * Create different rate limiters for different routes
 */
export const rateLimiters = {
  // Global rate limiter
  global: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per 15 minutes
  }),

  // Auth routes rate limiter
  auth: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 failed attempts per hour
    keyGenerator: (req) => `${req.ip}-${req.body.email || req.body.userName}`,
  }),

  // API routes rate limiter
  api: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
  }),

  // File upload rate limiter
  upload: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 uploads per hour
  }),
};
