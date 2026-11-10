'use strict';

/**
 * Application entry point: connect to MongoDB, then listen.
 *
 * In development USE_IN_MEMORY_DB=true starts a throw-away in-memory MongoDB and
 * seeds sample content, so the site can be reviewed without installing MongoDB.
 */

const config = require('./config/env');
const app = require('./app');
const { connectDatabase, disconnectDatabase } = require('./config/database');

async function startInMemoryDatabase() {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const memoryServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = memoryServer.getUri('aramiot');
  console.log('[dev] in-memory MongoDB started (data is discarded on exit)');
  return memoryServer;
}

async function start() {
  let memoryServer = null;

  if (config.useInMemoryDb && !config.isProduction) {
    memoryServer = await startInMemoryDatabase();
  }

  await connectDatabase(process.env.MONGODB_URI || config.mongoUri);

  if (memoryServer) {
    const { seedDatabase } = require('./seed/sampleData');
    const summary = await seedDatabase({ clear: true });
    console.log('[dev] sample content seeded:', summary);
  }

  const server = app.listen(config.port, config.host, () => {
    console.log(`[app] ARAMIOT API listening on http://${config.host}:${config.port} (${config.nodeEnv})`);
    console.log(`[app] public website: http://localhost:${config.port}/`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[app] port ${config.port} is already in use. Set PORT in .env to a free port.`);
    } else {
      console.error('[app] failed to start HTTP server:', error.message);
    }
    process.exit(1);
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[app] ${signal} received, shutting down`);

    server.close(async () => {
      await disconnectDatabase().catch(() => {});
      if (memoryServer) await memoryServer.stop().catch(() => {});
      process.exit(0);
    });

    // Do not hang forever on lingering keep-alive sockets.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error) => {
  console.error('[app] startup failed:', error.message);
  if (error.name === 'MongooseServerSelectionError') {
    console.error(
      '[app] MongoDB is not reachable. Start MongoDB, set MONGODB_URI in .env, or run "npm run dev:memory".'
    );
  }
  process.exit(1);
});
