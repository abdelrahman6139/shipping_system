"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = initSocket;
function initSocket(io) {
    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);
        // Join a room based on user role / userId
        socket.on('join', (data) => {
            socket.join(`user:${data.userId}`);
            socket.join(`role:${data.role}`);
            console.log(`👤 ${data.role} ${data.userId} joined`);
        });
        socket.on('disconnect', () => {
            console.log(`❌ Client disconnected: ${socket.id}`);
        });
    });
}
