import mongoose from 'mongoose';
const DB_REPLICA = process.env.DB_REPLICA;
let mongoDBConnection = '';

export const createConnection = async (host, database, username = '', password = '') => {
  let connectionUrl = `mongodb://${host}`;
  if (username) {
    connectionUrl = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(
      password,
    )}@${host}`;
  }
  if (DB_REPLICA) {
    connectionUrl += `?replicaSet=${DB_REPLICA}`;
  }
  const dbConnection = await mongoose.createConnection(connectionUrl, {
    autoIndex: false,
    dbName: database,
  });
  dbConnection.on('error', (err) => {
    console.error(`MongoDB connection error: ${err}`);
  });

  return dbConnection;
};

const createDatabaseConnection = async (host, username = '', password = '') => {
  let connectionUrl = `mongodb://${host}`;
  if (username) {
    connectionUrl = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(
      password,
    )}@${host}`;
  }
  if (DB_REPLICA) {
    connectionUrl += `?replicaSet=${DB_REPLICA}`;
  }
  try {
    const dbConnection = await mongoose.createConnection(connectionUrl, {
      autoIndex: false,
      maxPoolSize: 100,
      minPoolSize: 100,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
    });
    dbConnection.on('error', (err) => {
      console.error(`MongoDB Database Error: ${err}`);
    });

    dbConnection.on('disconnected', () => {
      console.warn('MongoDB connection lost, attempting reconnection...');
    });
    return dbConnection;
  } catch (error) {
    console.error('MongoDB Connection Error:', error);
    throw error;
  }
};

export const connectProjectDatabase = async (host, database, username = '', password = '') => {
  if (!mongoDBConnection) {
    console.log("I don't have connection. So create a new Database connection");
    mongoDBConnection = await createDatabaseConnection(host, username, password);
  }
  if (!mongoDBConnection.readyState || mongoDBConnection.readyState !== 1) {
    console.error('MongoDB connection is not established. Retrying...');
    mongoDBConnection = await createDatabaseConnection(host, username, password);
  }
  return mongoDBConnection.useDb(database, { useCache: true });
};
export const closeAllConnections = async () => {
  if (mongoDBConnection) {
    try {
      mongoDBConnection.close();
    } catch (error) {}
  }
};

export const compareMongoSetting = (item, config) => {
  return (
    item.host === config.host &&
    item.username === config.username &&
    item.password === config.password
  );
};
