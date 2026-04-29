import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function generateShipmentNumber(): string {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `SHP-${ts}${rnd}`.slice(0, 14);
}

async function main() {
  console.log('🌱 بدء زراعة قاعدة البيانات...');

  // مدير النظام
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where:  { email: 'admin@shipping.com.eg' },
    update: {},
    create: { name: 'أحمد المدير', email: 'admin@shipping.com.eg', phone: '01001234567', password: adminPassword, role: 'ADMIN' },
  });

  // السائقين
  const driverPassword = await bcrypt.hash('driver123', 12);
  const driver1 = await prisma.user.upsert({
    where:  { email: 'driver1@shipping.com.eg' },
    update: {},
    create: { name: 'محمد السائق', email: 'driver1@shipping.com.eg', phone: '01112345678', password: driverPassword, role: 'DRIVER', commissionType: 'PERCENTAGE', commissionValue: 15 },
  });
  const driver2 = await prisma.user.upsert({
    where:  { email: 'driver2@shipping.com.eg' },
    update: {},
    create: { name: 'علي المندوب', email: 'driver2@shipping.com.eg', phone: '01212345678', password: driverPassword, role: 'DRIVER', commissionType: 'FIXED', commissionValue: 20 },
  });

  // العملاء / التجار
  const clientPassword = await bcrypt.hash('client123', 12);
  const client1 = await prisma.user.upsert({
    where:  { email: 'client1@shipping.com.eg' },
    update: {},
    create: { name: 'فاطمة التاجرة', email: 'client1@shipping.com.eg', phone: '01501234567', password: clientPassword, role: 'CLIENT' },
  });
  const client2 = await prisma.user.upsert({
    where:  { email: 'client2@shipping.com.eg' },
    update: {},
    create: { name: 'حسن المتجر', email: 'client2@shipping.com.eg', phone: '01201234567', password: clientPassword, role: 'CLIENT' },
  });

  // المناطق المصرية
  const cairoZone = await prisma.zone.upsert({
    where:  { name: 'القاهرة' },
    update: {},
    create: { name: 'القاهرة', description: 'القاهرة الكبرى والمحافظة', basePrice: 0 },
  });
  const gizaZone = await prisma.zone.upsert({
    where:  { name: 'الجيزة' },
    update: {},
    create: { name: 'الجيزة', description: 'محافظة الجيزة والأحياء المجاورة', basePrice: 0 },
  });
  const alexZone = await prisma.zone.upsert({
    where:  { name: 'الإسكندرية' },
    update: {},
    create: { name: 'الإسكندرية', description: 'محافظة الإسكندرية', basePrice: 0 },
  });
  const deltaZone = await prisma.zone.upsert({
    where:  { name: 'الدلتا' },
    update: {},
    create: { name: 'الدلتا', description: 'محافظات الوجه البحري', basePrice: 0 },
  });

  // قواعد التسعير (بالجنيه المصري)
  await prisma.pricingRule.upsert({
    where:  { zoneId: cairoZone.id },
    update: {},
    create: { zoneId: cairoZone.id, standardPrice: 25, expressPrice: 40, sameDayPrice: 70, driverPayout: 15 },
  });
  await prisma.pricingRule.upsert({
    where:  { zoneId: gizaZone.id },
    update: {},
    create: { zoneId: gizaZone.id, standardPrice: 30, expressPrice: 50, sameDayPrice: 80, driverPayout: 18 },
  });
  await prisma.pricingRule.upsert({
    where:  { zoneId: alexZone.id },
    update: {},
    create: { zoneId: alexZone.id, standardPrice: 45, expressPrice: 75, sameDayPrice: 120 },
  });
  await prisma.pricingRule.upsert({
    where:  { zoneId: deltaZone.id },
    update: {},
    create: { zoneId: deltaZone.id, standardPrice: 35, expressPrice: 60, sameDayPrice: 100 },
  });

  // طلبات نموذجية
  const order1 = await prisma.order.create({
    data: {
      shipmentNumber:     generateShipmentNumber(),
      clientId:           client1.id,
      driverId:           driver1.id,
      pickupAddress:      'شارع التحرير، وسط البلد، القاهرة',
      destination:        '٢٣ شارع الهرم، الجيزة',
      packageDescription: 'ملابس',
      recipientName:      'سمر أحمد',
      recipientPhone:     '01098765432',
      deliveryType:       'EXPRESS',
      status:             'IN_TRANSIT',
      totalPrice:         40,
      zoneId:             gizaZone.id,
      collectionStatus:   'NOT_COLLECTED',
    },
  });

  const order2 = await prisma.order.create({
    data: {
      shipmentNumber:  generateShipmentNumber(),
      clientId:        client2.id,
      pickupAddress:   '٥ شارع الجمهورية، الإسكندرية',
      destination:     '١٢ شارع سيدي جابر، الإسكندرية',
      deliveryType:    'STANDARD',
      status:          'PENDING',
      totalPrice:      45,
      zoneId:          alexZone.id,
      collectionStatus: 'NOT_COLLECTED',
    },
  });

  const order3 = await prisma.order.create({
    data: {
      shipmentNumber:     generateShipmentNumber(),
      clientId:           client1.id,
      driverId:           driver2.id,
      pickupAddress:      '٨ شارع عرابي، المنصورة',
      destination:        '٣ شارع النيل، طنطا',
      packageDescription: 'إلكترونيات',
      recipientName:      'كريم محمود',
      recipientPhone:     '01534567890',
      deliveryType:       'SAME_DAY',
      status:             'DELIVERED',
      totalPrice:         100,
      zoneId:             deltaZone.id,
      collectionStatus:   'DRIVER_COLLECTED',
    },
  });

  // فواتير
  await prisma.invoice.upsert({ where: { orderId: order1.id }, update: {}, create: { orderId: order1.id, pdfUrl: null } });
  await prisma.invoice.upsert({ where: { orderId: order2.id }, update: {}, create: { orderId: order2.id, pdfUrl: null } });
  await prisma.invoice.upsert({ where: { orderId: order3.id }, update: {}, create: { orderId: order3.id, pdfUrl: null } });

  // أرباح السائق على الطلب المسلّم
  await prisma.driverEarning.upsert({
    where:  { orderId: order3.id },
    update: {},
    create: {
      driverId:       driver2.id,
      orderId:        order3.id,
      amount:         20,         // مستحقات السائق الثابتة
      orderTotal:     100,
      companyProfit:  80,
      commissionType: 'FIXED',
      commissionValue: 20,
    },
  });

  // تذكرة دعم
  await prisma.ticket.create({
    data: {
      clientId: client1.id,
      orderId:  order1.id,
      subject:  'تأخير في التوصيل',
      status:   'OPEN',
      messages: {
        create: { senderId: client1.id, message: 'طلبي في الطريق منذ يومين، متى سيصل؟' },
      },
    },
  });

  console.log('\n✅ اكتملت زراعة قاعدة البيانات!');
  console.log('\n🔑 بيانات الدخول التجريبية:');
  console.log('  المدير:   admin@shipping.com.eg  / admin123');
  console.log('  السائق:   driver1@shipping.com.eg / driver123');
  console.log('  العميل:   client1@shipping.com.eg / client123');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
