import type { Request, Response, NextFunction } from 'express';

const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();

    let entry = requestCounts.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      requestCounts.set(key, entry);
    }

    entry.count++;

    if (entry.count > maxRequests) {
      res.status(429).json({
        error: 'Too many requests. Please wait a moment.',
        retry_after: Math.ceil((entry.resetAt - now) / 1000),
      });
      return;
    }

    next();
  };
}

// Presets
export const generalLimit = rateLimit(100, 60 * 1000);  // 100/min
export const llmLimit = rateLimit(10, 60 * 1000);        // 10/min for AI calls

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requestCounts) {
    if (now > entry.resetAt) requestCounts.delete(key);
  }
}, 5 * 60 * 1000);
