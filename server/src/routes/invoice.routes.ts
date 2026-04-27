import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateInvoicePDF } from '../services/pdf.service';
import { prisma } from '../lib/prisma';

const router = Router();

// POST /api/invoices/generate/:orderId
router.post('/generate/:orderId', authenticate, async (req: AuthRequest, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (req.user?.role === 'CLIENT' && order.clientId !== req.user.userId)
      return res.status(403).json({ error: 'Forbidden' });

    const pdfUrl = await generateInvoicePDF(req.params.orderId);

    const invoice = await prisma.invoice.upsert({
      where: { orderId: req.params.orderId },
      update: { pdfUrl },
      create: { orderId: req.params.orderId, pdfUrl },
    });

    return res.json({ invoice });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to generate invoice' });
  }
});

// GET /api/invoices/:orderId/download
router.get('/:orderId/download', authenticate, async (req: AuthRequest, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { orderId: req.params.orderId },
      include: { order: true },
    });

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (req.user?.role === 'CLIENT' && invoice.order.clientId !== req.user.userId)
      return res.status(403).json({ error: 'Forbidden' });

    if (!invoice.pdfUrl) {
      // Regenerate
      const pdfUrl = await generateInvoicePDF(req.params.orderId);
      await prisma.invoice.update({ where: { orderId: req.params.orderId }, data: { pdfUrl } });
      invoice.pdfUrl = pdfUrl;
    }

    const filename = `invoice-${req.params.orderId}.pdf`;
    const filepath = path.join(process.cwd(), 'uploads', 'invoices', filename);

    if (!fs.existsSync(filepath)) {
      const pdfUrl = await generateInvoicePDF(req.params.orderId);
      await prisma.invoice.update({ where: { orderId: req.params.orderId }, data: { pdfUrl } });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.sendFile(path.resolve(filepath));
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to download invoice' });
  }
});

export default router;
