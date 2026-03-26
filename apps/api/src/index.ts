import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import { corsMiddleware } from './config/cors.js';
import { errorHandler } from './middleware/error.js';
import { generalLimit } from './middleware/rate-limit.js';
import routes from './routes/index.js';
import { env } from './config/env.js';
import { supabaseAdmin } from './config/supabase.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for SPA with inline scripts
  crossOriginEmbedderPolicy: false,
}));

// Middleware
app.use(corsMiddleware);
app.use(express.json({ limit: '2mb' }));
app.use(generalLimit);

// Health check with DB connectivity
app.get('/health', async (_req, res) => {
  try {
    const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
    res.json({
      status: error ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      db: error ? 'disconnected' : 'connected',
    });
  } catch {
    res.status(503).json({ status: 'unhealthy', timestamp: new Date().toISOString(), db: 'error' });
  }
});

// API routes
app.use('/api/v1', routes);

// Global async error handler — catches unhandled promise rejections from async route handlers
app.use('/api', (err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API error:', err.message || err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handler (for API routes)
app.use('/api', errorHandler);

// Serve static frontend (production only — built files from apps/web/dist)
const frontendPath = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath, { maxAge: '1h' }));
  // SPA fallback: serve index.html for any non-API route
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
  console.log(`Serving frontend from ${frontendPath}`);
}

// Start server
app.listen(env.PORT, () => {
  console.log(`LEAP API running on port ${env.PORT}`);
  console.log(`CORS origin: ${env.FRONTEND_URL}`);
});

export default app;
