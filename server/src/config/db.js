const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

let pgPool = null;
let pgliteDb = null;
let activeMode = null;
let initPromise = null;

async function initConnection() {
  if (activeMode) return activeMode;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const requestedMode = (process.env.DB_MODE || 'auto').toLowerCase();

    if (requestedMode !== 'pglite') {
      const candidatePool = new Pool({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'edurisk',
        password: process.env.DB_PASSWORD || 'password',
        port: Number(process.env.DB_PORT || 5432),
        connectionTimeoutMillis: 2500,
      });

      try {
        await candidatePool.query('SELECT 1');
        candidatePool.on('error', (err) => {
          console.error('Unexpected PostgreSQL pool error:', err);
        });
        pgPool = candidatePool;
        activeMode = 'postgres';
        console.log('[DB] Connected to external PostgreSQL server.');
        return activeMode;
      } catch (err) {
        await candidatePool.end().catch(() => {});
        if (requestedMode === 'postgres') {
          throw err;
        }
        console.warn(
          `[DB] External PostgreSQL unavailable (${err.code || err.message}). Falling back to embedded PostgreSQL (PGlite).`
        );
      }
    }

    const { PGlite } = await import('@electric-sql/pglite');
    const dataDir =
      process.env.PGLITE_DATA_DIR || path.resolve(__dirname, '../../data/pgdata');

    if (dataDir !== 'memory://') {
      fs.mkdirSync(dataDir, { recursive: true });
      pgliteDb = new PGlite(dataDir);
    } else {
      pgliteDb = new PGlite();
    }
    await pgliteDb.waitReady;
    activeMode = 'pglite';
    console.log(`[DB] Connected to embedded PostgreSQL (PGlite at ${dataDir}).`);
    return activeMode;
  })();

  try {
    return await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

async function query(text, params = []) {
  await initConnection();
  if (activeMode === 'postgres') {
    return pgPool.query(text, params);
  }
  const result = await pgliteDb.query(text, params);
  return {
    rows: result.rows || [],
    rowCount: result.affectedRows ?? (result.rows ? result.rows.length : 0),
  };
}

async function exec(sql) {
  await initConnection();
  if (activeMode === 'postgres') {
    return pgPool.query(sql);
  }
  return pgliteDb.exec(sql);
}

async function withTransaction(callback) {
  await initConnection();
  if (activeMode === 'postgres') {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const res = await callback(client);
      await client.query('COMMIT');
      return res;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  return pgliteDb.transaction(async (tx) => {
    const txWrapper = {
      query: async (text, params = []) => {
        const r = await tx.query(text, params);
        return {
          rows: r.rows || [],
          rowCount: r.affectedRows ?? (r.rows ? r.rows.length : 0),
        };
      },
    };
    return callback(txWrapper);
  });
}

function getDbMode() {
  return activeMode || 'uninitialized';
}

async function close() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  if (pgliteDb) {
    await pgliteDb.close();
    pgliteDb = null;
  }
  activeMode = null;
  initPromise = null;
}

module.exports = {
  initConnection,
  query,
  exec,
  withTransaction,
  getDbMode,
  close,
};
