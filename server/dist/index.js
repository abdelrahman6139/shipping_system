"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const socket_1 = require("./socket");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const order_routes_1 = __importDefault(require("./routes/order.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const zone_routes_1 = __importDefault(require("./routes/zone.routes"));
const ticket_routes_1 = __importDefault(require("./routes/ticket.routes"));
const invoice_routes_1 = __importDefault(require("./routes/invoice.routes"));
const refund_routes_1 = __importDefault(require("./routes/refund.routes"));
const analytics_routes_1 = __importDefault(require("./routes/analytics.routes"));
const driver_routes_1 = __importDefault(require("./routes/driver.routes"));
const pricing_routes_1 = __importDefault(require("./routes/pricing.routes"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        credentials: true,
    },
});
exports.io = io;
(0, socket_1.initSocket)(io);
// Make io available globally
app.set('io', io);
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// Static files for invoices
app.use('/uploads', express_1.default.static('uploads'));
// Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/orders', order_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/zones', zone_routes_1.default);
app.use('/api/tickets', ticket_routes_1.default);
app.use('/api/invoices', invoice_routes_1.default);
app.use('/api/refunds', refund_routes_1.default);
app.use('/api/analytics', analytics_routes_1.default);
app.use('/api/driver', driver_routes_1.default);
app.use('/api/pricing-rules', pricing_routes_1.default);
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
    });
});
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
