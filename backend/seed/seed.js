'use strict';

/**
 * Seed the configured database with the sample content set.
 *
 *   npm run seed            # wipes the content collections, then inserts samples
 *   npm run seed -- --keep  # inserts without deleting existing documents
 */

require('../config/env');

const { connectDatabase, disconnectDatabase } = require('../config/database');
const { seedDatabase } = require('./sampleData');

async function main() {
  const clear = !process.argv.includes('--keep');

  console.log('[seed] connecting...');
  await connectDatabase();

  if (clear) {
    console.log('[seed] clearing content collections (sample data only)');
  }

  const summary = await seedDatabase({ clear });
  console.log('[seed] done:', summary);

  await disconnectDatabase();
  process.exit(0);
}

main().catch(async (error) => {
  console.error('[seed] failed:', error.message);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
