import PDFKit from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';

export async function generateInvoicePDF(orderId: string): Promise<string> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      client: { select: { name: true, email: true, phone: true } },
      zone: true,
    },
  });

  if (!order) throw new Error('Order not found');

  const uploadsDir = path.join(process.cwd(), 'uploads', 'invoices');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filename = `invoice-${orderId}.pdf`;
  const filepath = path.join(uploadsDir, filename);
  const pdfUrl = `/uploads/invoices/${filename}`;

  return new Promise((resolve, reject) => {
    const doc = new PDFKit({ margin: 50 });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // Header
    doc.fontSize(24).fillColor('#1e3a5f').text('ShipPro Shipping Co.', { align: 'center' });
    doc.fontSize(12).fillColor('#666').text('Fast, Reliable Shipping Solutions', { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#e0e0e0');
    doc.moveDown();

    // Invoice title
    doc.fontSize(20).fillColor('#000').text('INVOICE', { align: 'right' });
    doc.fontSize(10).fillColor('#666').text(`Invoice Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
    doc.text(`Order ID: #${order.id.slice(0, 8).toUpperCase()}`, { align: 'right' });
    doc.moveDown(2);

    // Client info
    doc.fontSize(12).fillColor('#1e3a5f').text('Bill To:');
    doc.fontSize(11).fillColor('#333').text(order.client.name);
    doc.text(order.client.email);
    if (order.client.phone) doc.text(order.client.phone);
    doc.moveDown();

    // Order details table header
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#e0e0e0');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#1e3a5f').font('Helvetica-Bold');
    doc.text('Description', 50, doc.y, { width: 250 });
    doc.text('Details', 300, doc.y - doc.currentLineHeight(), { width: 250 });
    doc.font('Helvetica');
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#e0e0e0');
    doc.moveDown(0.5);

    // Rows
    const rows = [
      ['Pickup Address', order.pickupAddress],
      ['Destination', order.destination],
      ['Package Description', order.packageDescription],
      ['Weight', `${order.weight} kg`],
      ['Dimensions (L×W×H)', `${order.length}×${order.width}×${order.height} cm`],
      ['Delivery Type', order.deliveryType],
      ['Zone', order.zone?.name || 'N/A'],
      ['Status', order.status],
    ];
    doc.fontSize(10).fillColor('#333');
    rows.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(label + ':', 50, doc.y, { width: 200, continued: false });
      doc.font('Helvetica').text(value, 260, doc.y - doc.currentLineHeight(), { width: 290 });
      doc.moveDown(0.3);
    });

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#e0e0e0');
    doc.moveDown(0.5);

    // Total
    doc.fontSize(14).fillColor('#1e3a5f').font('Helvetica-Bold');
    doc.text('TOTAL AMOUNT:', 350, doc.y, { width: 100 });
    doc.text(`$${order.totalPrice.toFixed(2)}`, 460, doc.y - doc.currentLineHeight(), { width: 90, align: 'right' });

    doc.moveDown(3);
    doc.fontSize(9).fillColor('#999').font('Helvetica');
    doc.text('Thank you for choosing ShipPro! For questions, contact support@shippro.com', { align: 'center' });

    doc.end();
    stream.on('finish', () => resolve(pdfUrl));
    stream.on('error', reject);
  });
}
