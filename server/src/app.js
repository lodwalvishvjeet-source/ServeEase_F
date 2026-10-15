import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { getConnectionState, pingDatabase } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import providerRoutes from './routes/providerRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { getCategoriesCatalog } from './controllers/providerController.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// ==========================================
// Global Middleware
// ==========================================

// Credentialed CORS
// Dynamically reads FRONTEND_URL and CLIENT_URL (supports single or comma-separated origins)
const envOrigins = [process.env.FRONTEND_URL, process.env.CLIENT_URL]
  .filter(Boolean)
  .flatMap(val => val.split(',').map(s => s.trim().replace(/\/$/, '')))
  .filter(Boolean);

const defaultDevOrigins = [
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

const allowedOrigins = Array.from(new Set([...envOrigins, ...defaultDevOrigins]));

const corsOptions = {
  origin: function (origin, callback) {
    // Allow non-browser requests or same-origin requests with no origin header (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    const normalized = origin.replace(/\/$/, '');
    if (allowedOrigins.indexOf(normalized) !== -1) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy: This origin is not allowed by Access-Control-Allow-Origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204
};

// Register CORS before all routes & handle preflight OPTIONS requests
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body & Cookie Parsing with sensible size limits (prevents payload DoS)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ==========================================
// Base & Health Routes
// ==========================================

app.get('/', (req, res) => {
  res.json({
    project: 'ServeEase — Smart Local Service Booking Platform',
    version: '2.0.0',
    status: 'Running',
    message: 'Welcome to the ServeEase API server. Health check available at /api/health'
  });
});

app.get('/api/health', async (req, res) => {
  const dbStatus = getConnectionState();
  const isConnected = dbStatus === 'connected';

  // Perform bounded read-only ping if mongoose is in connected state
  let isDbReady = false;
  if (isConnected) {
    isDbReady = await pingDatabase(1500);
  }

  const isHealthy = isConnected && isDbReady;
  const httpStatus = isHealthy ? 200 : 503;

  return res.status(httpStatus).json({
    status: isHealthy ? 'healthy' : 'degraded',
    system: 'ServeEase API Server',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    services: {
      server: 'operational',
      database: isHealthy ? 'connected' : (isConnected ? 'unresponsive' : dbStatus),
      auth: 'operational (customer, provider, admin)'
    }
  });
});

// ==========================================
// API Feature Routes
// ==========================================

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.get('/api/categories', getCategoriesCatalog);
app.get('/api/services/categories', getCategoriesCatalog);

// 404 Handler for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

export { allowedOrigins };
export default app;
