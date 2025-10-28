import { createAdapter } from '@socket.io/redis-adapter';
import { redisClient } from 'drapcode-redis';

let ioInstance = null;

export const setupSocketWithRedis = (io) => {
  const subClient = redisClient.duplicate();
  redisClient.on('error', (err) => {
    console.error('Redis pubClient error:', err);
  });
  subClient.on('error', (err) => {
    console.error('Redis subClient error:', err);
  });
  io.adapter(createAdapter(redisClient, subClient));
  ioInstance = io;

  registerSocketEvents(io);
};

export const registerSocketEvents = (io) => {
  io.on('connection', (socket) => {
    const { userId, tenantId } = socket?.handshake?.auth || {};
    if (userId) {
      socket.join(userId);
      console.log(`✅ User ${userId} joined room: ${userId}, socket ID: ${socket.id}`);
    }
    if (tenantId) {
      const tenantRoom = `tenant:${tenantId}`;
      socket.join(tenantRoom);
      console.log(`🏢 User ${userId} joined tenant room: ${tenantRoom}`);
    }
    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
    socket.on('error', (err) => {
      console.error(`⚠️ Socket error (${socket.id}):`, err);
    });
  });
};

export const emitToUser = (userId, event, data) => {
  if (!ioInstance) {
    console.warn('⚠️ Cannot emit, Socket.IO not initialized');
    return;
  }
  if (userId) {
    console.log(`📢 Emitting "${event}" to user ${userId}`);
    ioInstance.to(userId).emit(event, data);
  } else {
    console.log(`📢 Broadcasting "${event}" to all connected users`);
    ioInstance.emit(event, data);
  }
};

export const emitToTenant = (tenantId, event, data) => {
  if (!ioInstance) {
    console.warn('⚠️ Cannot emit, Socket.IO not initialized');
    return;
  }
  if (!tenantId) {
    console.warn('⚠️ emitToTenant called without tenantId');
    return;
  }
  const tenantRoom = `tenant:${tenantId}`;
  console.log(`🏢 Emitting "${event}" to tenant room: ${tenantRoom}`);
  ioInstance.to(tenantRoom).emit(event, data);
};
