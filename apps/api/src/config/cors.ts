import cors from 'cors';
import { env } from './env.js';

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      env.FRONTEND_URL,
      'https://dist-rho-lilac.vercel.app',
      'http://localhost:5173',
      'http://localhost:5180',
      'http://localhost:5190',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5180',
    ];

    // Also allow any *.vercel.app subdomain
    if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(null, true); // Allow all for now — tighten in production
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
