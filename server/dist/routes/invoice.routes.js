"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_1 = require("../middleware/auth");
const pdf_service_1 = require("../services/pdf.service");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
// POST /api/invoices/generate/:orderId
router.post('/generate/:orderId', auth_1.authenticate, async (req, res) => {
    try {
        const order = await prisma_1.prisma.order.findUnique({ where: { id: req.params.orderId } });
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        if (req.user?.role === 'CLIENT' && order.clientId !== req.user.userId)
            return res.status(403).json({ error: 'Forbidden' });
        const pdfUrl = await (0, pdf_service_1.generateInvoicePDF)(req.params.orderId);
        const invoice = await prisma_1.prisma.invoice.upsert({
            where: { orderId: req.params.orderId },
            update: { pdfUrl },
            create: { orderId: req.params.orderId, pdfUrl },
        });
        return res.json({ invoice });
    }
    catch (err) {
        return res.status(500).json({ error: err.message || 'Failed to generate invoice' });
    }
});
// GET /api/invoices/:orderId/download
router.get('/:orderId/download', auth_1.authenticate, async (req, res) => {
    try {
        const invoice = await prisma_1.prisma.invoice.findUnique({
            where: { orderId: req.params.orderId },
            include: { order: true },
        });
        if (!invoice)
            return res.status(404).json({ error: 'Invoice not found' });
        if (req.user?.role === 'CLIENT' && invoice.order.clientId !== req.user.userId)
            return res.status(403).json({ error: 'Forbidden' });
        if (!invoice.pdfUrl) {
            // Regenerate
            const pdfUrl = await (0, pdf_service_1.generateInvoicePDF)(req.params.orderId);
            await prisma_1.prisma.invoice.update({ where: { orderId: req.params.orderId }, data: { pdfUrl } });
            invoice.pdfUrl = pdfUrl;
        }
        const filename = `invoice-${req.params.orderId}.pdf`;
        const filepath = path_1.default.join(process.cwd(), 'uploads', 'invoices', filename);
        if (!fs_1.default.existsSync(filepath)) {
            const pdfUrl = await (0, pdf_service_1.generateInvoicePDF)(req.params.orderId);
            await prisma_1.prisma.invoice.update({ where: { orderId: req.params.orderId }, data: { pdfUrl } });
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.sendFile(path_1.default.resolve(filepath));
    }
    catch (err) {
        return res.status(500).json({ error: err.message || 'Failed to download invoice' });
    }
});
exports.default = router;
