import { app } from './config/serverConfig';
import { ENV } from './config/env';
import { useSupabase, validateSupabaseConnection } from './config/supabase';
import flightRouter from './routes/flightRoutes';
import { errorMiddleware } from './middleware/errorMiddleware';
import { airportsDatabase } from './repositories/airportsDatabase';
import { airportSyncService } from './services/airportSyncService';
import net from 'net';

// Mount Health Check Route
app.get('/health', async (req, res) => {
  let isDbConnected = false;
  if (useSupabase) {
    isDbConnected = await validateSupabaseConnection();
  }
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: actualPort,
    supabase: useSupabase ? (isDbConnected ? 'CONNECTED' : 'DISCONNECTED') : 'FALLBACK_IN_MEMORY'
  });
});

// Mount API routes
app.use('/api', flightRouter);

// Centralized error handling
app.use(errorMiddleware);

/**
 * Port auto-detection utility.
 * Attempts to listen on starting port. If in use, tries next port recursively.
 */
async function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const testServer = net.createServer();
    testServer.unref();
    testServer.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️ Port ${startPort} is occupied. Trying next port...`);
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(err);
      }
    });
    testServer.listen(startPort, () => {
      testServer.close(() => {
        resolve(startPort);
      });
    });
  });
}

let actualPort = ENV.PORT;
let serverInstance: any = null;

/**
 * Bootstrap server applications and listeners
 */
async function bootstrap() {
  try {
    console.log('📦 Initializing Airports Database...');
    await airportsDatabase.initialize();
    console.log('✅ Airports Database initialized.');

    // Start background syncing service
    airportSyncService.start();

    // Auto-detect and resolve ports to avoid EADDRINUSE errors
    actualPort = await findAvailablePort(ENV.PORT);

    // Initialize server listener
    serverInstance = app.listen(actualPort, () => {
      console.log(`\n====================================================`);
      console.log(`🚀 FLIGHT MANAGEMENT SYSTEM RUNNING ON PORT ${actualPort}`);
      console.log(`⚙️  Suppressed direct warnings - running fully robustly.`);
      console.log(`🔄 Mode: ${useSupabase ? 'Supabase Live Connected' : 'In-Memory Resilient Fallback Enabled'}`);
      console.log(`====================================================\n`);
    });

    // Graceful shutdowns
    const shutdown = (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Shutting down server gracefully...`);
      airportSyncService.stop();
      if (serverInstance) {
        serverInstance.close(() => {
          console.log('✅ Server listener closed. Exiting process.');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Prevent nodemon duplicate instances by cleaning up usr2 restarts
    process.once('SIGUSR2', () => {
      console.log('🔄 nodemon restart detected. Releasing port resources...');
      airportSyncService.stop();
      if (serverInstance) {
        serverInstance.close(() => {
          process.kill(process.pid, 'SIGUSR2');
        });
      } else {
        process.kill(process.pid, 'SIGUSR2');
      }
    });

  } catch (error) {
    console.error('❌ Critical bootstrap error occurred:', error);
    process.exit(1);
  }
}

// Global Exception Boundaries
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception thrown:', error);
});

bootstrap();
