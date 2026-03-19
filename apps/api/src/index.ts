import express from 'express';
import { corsMiddleware } from './config/cors.js';
import { errorHandler } from './middleware/error.js';
import routes from './routes/index.js';
import { env } from './config/env.js';

const app = express();

// Middleware
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v1', routes);

// Error handler
app.use(errorHandler);

// Start server
app.listen(env.PORT, () => {
  console.log(`LES API running on port ${env.PORT}`);
  console.log(`CORS origin: ${env.FRONTEND_URL}`);
});

export default app;
