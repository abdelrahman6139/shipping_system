import PDFKit from 'pdfkit';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
// @ts-ignore
import arabicReshaper from 'arabic-reshaper';
// @ts-ignore
import bidiFactory from 'bidi-js';
import { prisma } from '../lib/prisma';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const FONT_PATH  = path.join(__dirname, '..', 'assets', 'fonts', 'Amiri-Regular.ttf');
const bidi       = bidiFactory();

/**
 * Reshape and visually reorder Arabic text so PDFKit (LTR engine) renders it correctly.
 * For mixed Arabic/Latin strings, pass each segment separately.
 */
function ar(text: string): string {
  if (!text || !text.trim()) return text;
  const reshaped = arabicReshaper.convertArabic(text);
  const levels   = bidi.getEmbeddingLevels(reshaped, 'rtl');
  return bidi.getReorderedString(reshaped, levels, 0);
}

/** Format Egyptian Pound */
function egp(amount: number): string {
  return `${amount.toFixed(2)} ج.م`;  // ج.م
}

function arabicStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING:    'معلق',
    ASSIGNED:   'تم التعيين',
    PICKED_UP:  'تم الاستلام',
    IN_TRANSIT: 'في الطريق',
    DELIVERED:  'تم التسليم',
    COLLECTED:  'تم التحصيل',
    CANCELLED:  'ملغي',
    RETURNED:   'مرتجع',
  };
  return map[status] || status;
}

function arabicDelivery(type: string): string {
  const map: Record<string, string> = {
    STANDARD: 'توصيل عادي',
    EXPRESS:  'توصيل سريع',
    SAME_DAY: 'نفس اليوم',
  };
  return map[type] || type;
}

function arabicCollection(status: string): string {
  const map: Record<string, string> = {
    NOT_COLLECTED:      'لم يتم التحصيل',
    DRIVER_COLLECTED:   'السائق استلم الكاش',
    COMPANY_RECEIVED:   'وصل للشركة',
    SETTLED_TO_MERCHANT: 'تمت التسوية مع التاجر',
  };
  return map[status] || status;
}

export async function generateInvoicePDF(orderId: string): Promise<string> {
  const order = await prisma.order.findUnique({
    where:   { id: orderId },
    include: {
      client: { select: { name: true, email: true, phone: true } },
      zone:   true,
    },
  });
  if (!order) throw new Error('الطلب غير موجود');

  const uploadsDir = path.join(process.cwd(), 'uploads', 'invoices');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const filename = `invoice-${orderId}.pdf`;
  const filepath = path.join(uploadsDir, filename);
  const pdfUrl   = `/uploads/invoices/${filename}`;

  const trackingUrl = `${CLIENT_URL}/track/${order.shipmentNumber}`;
  const qrBuffer    = await QRCode.toBuffer(trackingUrl, { width: 110, margin: 1 });

  // Check if Amiri font exists; fall back to Helvetica if not
  const fontExists = fs.existsSync(FONT_PATH);

  return new Promise((resolve, reject) => {
    const doc    = new PDFKit({ margin: 40, size: 'A4' });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    if (fontExists) {
      doc.registerFont('Arabic', FONT_PATH);
    }

    const setFont = (size: number, bold = false) => {
      if (fontExists) {
        doc.font('Arabic').fontSize(size);
      } else {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
      }
    };

    const W = doc.page.width;

    /* ══ Header bar ══ */
    doc.rect(0, 0, W, 75).fill('#1e3a5f');
    setFont(20, true);
    doc.fillColor('#ffffff').text(ar('شركة الشحن المصرية'), 0, 15, { align: 'center' });
    setFont(10);
    doc.fillColor('#a8c4e0').text(ar('خدمات الشحن والتوصيل السريع في مصر'), 0, 42, { align: 'center' });

    /* ══ Shipment number + QR ══ */
    let y = 90;
    setFont(14, true);
    doc.fillColor('#1e3a5f').text(ar('بوليصة شحن'), 40, y, { align: 'right', width: W - 160 });
    setFont(10);
    doc.fillColor('#444')
       .text(ar(`رقم الشحنة: ${order.shipmentNumber}`), 40, y + 22, { align: 'right', width: W - 160 })
       .text(ar(`تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG')}`), 40, y + 38, { align: 'right', width: W - 160 })
       .text(ar(`رقم الطلب: #${order.id.slice(0, 8).toUpperCase()}`), 40, y + 54, { align: 'right', width: W - 160 });

    // QR code top-right
    try {
      doc.image(qrBuffer, W - 135, y, { width: 95 });
      setFont(7);
      doc.fillColor('#888').text(ar('امسح للتتبع'), W - 135, y + 98, { width: 95, align: 'center' });
    } catch (_) { /* ignore QR failure */ }

    y = 210;
    doc.moveTo(40, y).lineTo(W - 40, y).strokeColor('#dee2e6').lineWidth(1).stroke();
    y += 12;

    /* ══ Sender + Recipient columns ══ */
    const colW = (W - 100) / 2;

    // Right column — Sender
    doc.rect(40, y, colW, 115).fillAndStroke('#f8f9fa', '#dee2e6');
    setFont(11, true);
    doc.fillColor('#1e3a5f').text(ar('بيانات المرسل'), 40, y + 10, { align: 'right', width: colW - 8 });
    setFont(9);
    doc.fillColor('#333')
       .text(ar(order.client.name), 40, y + 28, { align: 'right', width: colW - 8 })
       .text(order.client.email || '', 40, y + 44, { align: 'right', width: colW - 8 })
       .text(order.client.phone || ar('—'), 40, y + 60, { align: 'right', width: colW - 8 })
       .text(ar(order.pickupAddress), 40, y + 76, { align: 'right', width: colW - 8 });

    // Left column — Recipient
    const col2 = 60 + colW;
    doc.rect(col2, y, colW, 115).fillAndStroke('#f8f9fa', '#dee2e6');
    setFont(11, true);
    doc.fillColor('#1e3a5f').text(ar('بيانات المستلم'), col2, y + 10, { align: 'right', width: colW - 8 });
    setFont(9);
    doc.fillColor('#333')
       .text(ar(order.recipientName || '—'), col2, y + 28, { align: 'right', width: colW - 8 })
       .text(order.recipientPhone || ar('—'), col2, y + 44, { align: 'right', width: colW - 8 })
       .text(ar(order.destination), col2, y + 60, { align: 'right', width: colW - 8 });

    y += 128;

    /* ══ Shipment details table ══ */
    setFont(12, true);
    doc.fillColor('#1e3a5f').text(ar('تفاصيل الشحنة'), 40, y, { align: 'right', width: W - 80 });
    y += 18;

    const rows: [string, string][] = [
      ['نوع الخدمة',      arabicDelivery(order.deliveryType)],
      ['المنطقة',         order.zone?.name || '—'],
      ['وصف الطرد',       order.packageDescription || '—'],
      ['ملاحظات',         order.notes || '—'],
      ['حالة الشحنة',     arabicStatus(order.status)],
      ['التحصيل',         arabicCollection(order.collectionStatus)],
    ];

    rows.forEach(([label, value], i) => {
      const rowBg = i % 2 === 0 ? '#ffffff' : '#f8f9fa';
      const rowY  = y + i * 22;
      doc.rect(40, rowY, W - 80, 20).fill(rowBg);
      setFont(9, true);
      doc.fillColor('#555').text(ar(label + ':'), 40, rowY + 4, { align: 'right', width: 130 });
      setFont(9);
      doc.fillColor('#333').text(ar(value), 180, rowY + 4, { align: 'right', width: W - 230 });
    });

    y += rows.length * 22 + 10;
    doc.moveTo(40, y).lineTo(W - 40, y).strokeColor('#dee2e6').stroke();
    y += 12;

    /* ══ Total amount box ══ */
    doc.rect(W - 200, y, 160, 50).fillAndStroke('#1e3a5f', '#1e3a5f');
    setFont(9);
    doc.fillColor('#a8c4e0').text(ar('إجمالي مبلغ الشحن'), W - 200, y + 8, { width: 160, align: 'center' });
    setFont(16, true);
    doc.fillColor('#ffffff').text(egp(order.totalPrice), W - 200, y + 24, { width: 160, align: 'center' });

    /* ══ Cash collection warning ══ */
    if (order.collectionStatus === 'NOT_COLLECTED') {
      y += 65;
      doc.rect(40, y, W - 80, 32).fillAndStroke('#fff3cd', '#ffc107');
      setFont(9, true);
      doc.fillColor('#856404').text(
        ar('⚠  لم يتم التحصيل — المبلغ مستحق للتاجر من الشركة'),
        40, y + 9,
        { width: W - 80, align: 'center' }
      );
    }

    /* ══ Footer ══ */
    setFont(7);
    doc.fillColor('#aaa').text(
      ar(`شكراً لثقتكم  •  support@shipping.com.eg  •  ${order.shipmentNumber}`),
      40, doc.page.height - 30,
      { width: W - 80, align: 'center' }
    );

    doc.end();
    stream.on('finish', () => resolve(pdfUrl));
    stream.on('error', reject);
  });
}
