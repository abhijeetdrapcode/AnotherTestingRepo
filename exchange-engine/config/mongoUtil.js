import mongoose from 'mongoose';
import { logger } from 'drapcode-logger';

const DB_REPLICA = process.env.DB_REPLICA;
let mongoDBConnection = '';
const connections = new Map();
// Connection state tracking
let defaultConnection = null;

// Connection pool configuration
const POOL_CONFIG = {
  maxPoolSize: 100, // Maximum number of connections in the pool
  minPoolSize: 10, // Minimum number of connections in the pool
  maxIdleTimeMS: 60000, // Maximum time a connection can remain idle
  waitQueueTimeoutMS: 10000, // Maximum time to wait for a connection
  connectTimeoutMS: 10000, // Maximum time to establish a connection
  socketTimeoutMS: 45000, // Maximum time to wait for operations
  serverSelectionTimeoutMS: 5000, // Maximum time to select a server
  heartbeatFrequencyMS: 10000, // How often to check server health
  retryWrites: true, // Retry write operations if they fail
  retryReads: true, // Retry read operations if they fail
};

/**
 * Create a MongoDB connection with connection pooling
 * @param {Object} options - Connection options
 * @param {string} options.host - MongoDB host
 * @param {string} options.database - Database name
 * @param {string} [options.username] - Username
 * @param {string} [options.password] - Password
 * @param {boolean} [options.isDefault] - Whether this is the default connection
 * @returns {Promise<mongoose.Connection>} MongoDB connection
 */
export const createMongoConnection = async ({
  host,
  database,
  username = '',
  password = '',
  isDefault = false,
}) => {
  const connectionKey = `${host}/${database}`;
  const connection = await getConnection(host, database);
  if (connection) {
    return connection;
  }

  try {
    // Build connection URL
    let connectionUrl = `mongodb://${host}`;
    if (username) {
      connectionUrl = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(
        password,
      )}@${host}`;
    }
    if (DB_REPLICA) {
      connectionUrl += `?replicaSet=${DB_REPLICA}`;
    }

    // Create connection with pooling configuration
    const connection = await mongoose.createConnection(connectionUrl, {
      ...POOL_CONFIG,
      dbName: database,
      autoIndex: false,
    });

    // Set up connection event handlers
    connection.on('connected', () => {
      logger.info(`MongoDB connected: ${connectionKey}`);
    });

    connection.on('error', (err) => {
      console.error('********** $$$$$$ ********');
      console.error('Connection Broke from Database');
      logger.error(`MongoDB connection error (${connectionKey}):`, err);
      process.exit(1);
    });

    connection.on('disconnected', () => {
      logger.warn(`MongoDB disconnected (${connectionKey}), attempting reconnection...`);
    });

    connection.on('reconnected', () => {
      logger.info(`MongoDB reconnected (${connectionKey})`);
    });

    // Store connection
    connections.set(connectionKey, connection);

    if (isDefault) {
      defaultConnection = connection;
    }

    return connection;
  } catch (error) {
    logger.error(`Failed to create MongoDB connection (${connectionKey}):`, error);
    throw error;
  }
};

export const closeAllConnections = async () => {
  if (mongoDBConnection) {
    try {
      if (connections.has(connectionKey)) {
        const connection = connections.get(connectionKey);
        connections.delete(connectionKey);
        connection.close();
      }
    } catch (error) {}
  }
};

/**
 * Get a database connection from the pool
 * @param {string} host - MongoDB host
 * @param {string} database - Database name
 * @returns {Promise<mongoose.Connection>} MongoDB connection
 */
const getConnection = async (host, database) => {
  const connectionKey = `${host}/${database}`;
  logger.info(`Total MongoDB connection (${connections.length})`);

  if (connections.has(connectionKey)) {
    const connection = connections.get(connectionKey);
    if (connection.readyState === 1) {
      return connection;
    }
    // Remove stale connection
    connections.delete(connectionKey);
    return null;
  }
  return null;
};
