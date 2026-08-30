import { Server } from 'socket.io';
import { env } from '../config/env.js';

let io;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientUrl, credentials: true },
  });

  io.on('connection', (socket) => {
    // Admin dashboard clients join a room to receive live updates
    socket.on('join:admin', () => socket.join('admin-room'));
    socket.on('disconnect', () => {});
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error('Socket.IO not initialized yet');
  return io;
}

// Emit helpers — call these from controllers after DB writes
export const emitNewOrder = (order) => io?.to('admin-room').emit('order:new', order);
export const emitOrderStatusChange = (order) => io?.to('admin-room').emit('order:status', order);
export const emitInventoryChange = (product) => io?.to('admin-room').emit('inventory:update', product);
