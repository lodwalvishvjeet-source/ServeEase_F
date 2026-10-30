import http from 'http';
import mongoose from 'mongoose';
import './src/config/env.js';
import { validateServerEnv } from './src/config/validateEnv.js';
import app, { allowedOrigins, isOriginAllowed } from './src/app.js';
import { connectDB } from './src/config/db.js';
import { initSocket } from './src/socket/index.js';

const PORT = process.env.PORT || 5001;

let isServerStarting = false;
const startServer = async () => {
  if (isServerStarting) {
    console.warn('⚠️ Server startup already in progress. Ignoring duplicate call.');
    return;
  }
  isServerStarting = true;

  console.log('===============================================');
  console.log('🚀 Initializing ServeEase Backend Server...');
  console.log('===============================================');

  validateServerEnv({ exitOnError: process.env.ALLOW_DEGRADED_MODE !== 'true' });

  const dbConnected = await connectDB();
  if (!dbConnected) {
    console.error('===============================================');
    console.error('❌ [MongoDB] Database connection failed.');
    console.error('🛑 Server startup aborted. The database must be connected before accepting requests.');
    console.error('👉 Please check network access, Atlas IP whitelist, and server/.env configuration.');
    console.error('===============================================');
    process.exit(1);
  }

  const httpServer = http.createServer(app);
  const io = initSocket(httpServer, allowedOrigins, (origin, callback) => {
    callback(null, isOriginAllowed(origin));
  });

  const server = httpServer.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 ServeEase API Server running on port ${PORT}`);
    console.log(`🔗 Local URL: http://localhost:${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    console.log(`💬 Socket.IO real-time chat & notifications initialized`);
    console.log(`✅ ServeEase API server started successfully`);
    console.log(`===============================================`);
  });

  let isShuttingDown = false;
  const shutdown = async (signal) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    console.log(`\n🛑 Received ${signal}. Gracefully shutting down ServeEase server...`);

    if (io) {
      try {
        await new Promise((resolve) => {
          io.close(() => resolve());
        });
        console.log('👋 Socket.IO server closed.');
      } catch (ioErr) {
        console.error('⚠️ Error closing Socket.IO:', ioErr.message);
      }
    }

    server.close(async (err) => {
      if (err) {
        console.error('⚠️ Error closing HTTP server:', err.message);
      } else {
        console.log('👋 HTTP server closed.');
      }

      try {
        if (mongoose.connection.readyState !== 0) {
          await mongoose.connection.close(false);
          console.log('👋 MongoDB connection cleanly closed.');
        }
      } catch (dbErr) {
        console.error('⚠️ Error closing MongoDB connection:', dbErr.message);
      }

      process.exit(err ? 1 : 0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer();
