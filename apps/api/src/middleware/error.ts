import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const timestamp = new Date().toISOString();
  const endpoint = `${req.method} ${req.path}`;
  const userId = (req as any).user?.id || 'anonymous';

  console.error(JSON.stringify({
    timestamp, level: 'error', endpoint, userId,
    error: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  }));

  let status = 500;
  let message = 'Something went wrong. Please try again later.';

  if (err.message.includes('not found')) { status = 404; message = 'Resource not found.'; }
  else if (err.message.includes('Invalid token') || err.message.includes('expired')) { status = 401; message = 'Session expired. Please sign in again.'; }
  else if (err.message.includes('permission') || err.message.includes('forbidden')) { status = 403; message = 'Access denied.'; }
  else if (err.message.includes('required') || err.message.includes('invalid')) { status = 400; message = err.message; }

  res.status(status).json({ error: message, timestamp });
}
