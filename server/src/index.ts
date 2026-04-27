import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import http from 'http';
import { Server } from 'socket.io';
import { initSocket } from './socket';

import authRoutes from './routes/auth.routes';
import orderRoutes from './routes/order.routes';
import userRoutes from './routes/user.routes';
import zoneRoutes from './routes/zone.routes';
import ticketRoutes from './routes/ticket.routes';
import invoiceRoutes from './routes/invoice.routes';
import refundRoutes from './routes/refund.routes';
import analyticsRoutes from './routes/analytics.routes';
import driverRoutes from './routes/driver.routes';
import pricingRoutes from './routes/pricing.routes';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  },
});

initSocket(io);

// Make io available globally
app.set('io', io);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Static files for invoices
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/pricing-rules', pricingRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export { io };
