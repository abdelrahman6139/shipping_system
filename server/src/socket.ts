import { Server, Socket } from 'socket.io';

export function initSocket(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join a room based on user role / userId
    socket.on('join', (data: { userId: string; role: string }) => {
      socket.join(`user:${data.userId}`);
      socket.join(`role:${data.role}`);
      console.log(`👤 ${data.role} ${data.userId} joined`);
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });
}
