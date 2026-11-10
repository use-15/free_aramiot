'use strict';

/**
 * MongoDB connection management.
 *
 * The URI always comes from the environment (MONGODB_URI); no credentials are
 * ever written into source files or sent to the browser.
 */

const mongoose = require('mongoose');

// Fail fast on query fields that are not in the schema instead of silently ignoring them.
mongoose.set('strictQuery', true);

let listenersAttached = false;

function attachConnectionLogging() {
  if (listenersAttached) return;
  listenersAttached = true;

  const { connection } = mongoose;

  connection.on('connected', () => {
    // Never log the URI itself: it can contain credentials.
    console.log(`[db] connected to MongoDB database "${connection.name}"`);
  });

  connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected');
  });

  connection.on('error', (error) => {
    console.error('[db] MongoDB connection error:', error.message);
  });
}

/**
 * Connect to MongoDB.
 * @param {string} [uri] Optional override, defaults to process.env.MONGODB_URI.
 * @returns {Promise<import('mongoose').Connection>}
 */
async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Copy .env.example to .env and provide a MongoDB connection string.'
    );
  }

  attachConnectionLogging();

  await mongoose.connect(uri, {
    // Give up quickly instead of hanging the API when MongoDB is not running.
    serverSelectionTimeoutMS: 10000,
    // Indexes are created automatically in development; production should build
    // them deliberately (see README).
    autoIndex: process.env.NODE_ENV !== 'production',
  });

  return mongoose.connection;
}

/** Close the connection (used by tests and graceful shutdown). */
async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

/** True when the connection is ready to accept queries. */
function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDatabase, disconnectDatabase, isDatabaseConnected };
