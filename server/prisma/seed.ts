import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

type EgyptZoneData = {
  governorates: Array<{
    sourceId: string;
    nameAr: string;
    nameEn: string;
    children: Array<{
      sourceId: string;
      nameAr: string;
      nameEn: string;
      originalNameAr?: string;
      originalNameEn?: string;
    }>;
  }>;
};

const GOVERNORATE_ALIASES: Record<string, string[]> = {
  الأسكندرية: ['الإسكندرية'],
};

function loadEgyptZones(): EgyptZoneData {
  const filePath = path.join(__dirname, 'data', 'egypt-zones.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function upsertZoneByName(name: string, data: { description?: string; basePrice?: number; parentId?: string | null }, aliases: string[] = []) {
  const existing =
    (await prisma.zone.findUnique({ where: { name }, select: { id: true } })) ||
    (aliases.length > 0
      ? await prisma.zone.findFirst({
          where: { OR: aliases.map((alias) => ({ name: alias })) },
          select: { id: true },
        })
      : null);

  if (existing) {
    return prisma.zone.update({
      where: { id: existing.id },
      data: {
        name,
        description: data.description,
        basePrice: data.basePrice ?? 0,
        parentId: data.parentId ?? null,
      },
    });
  }

  return prisma.zone.create({
    data: {
      name,
      description: data.description,
      basePrice: data.basePrice ?? 0,
      ...(data.parentId ? { parentId: data.parentId } : {}),
    },
  });
}

async function seedEgyptZones() {
  const data = loadEgyptZones();
  const byEnglishName = new Map<string, Awaited<ReturnType<typeof upsertZoneByName>>>();

  for (const governorate of data.governorates) {
    const parent = await upsertZoneByName(
      governorate.nameAr,
      {
        description: `${governorate.nameEn} governorate`,
        basePrice: 0,
      },
      GOVERNORATE_ALIASES[governorate.nameAr] || [],
    );
    byEnglishName.set(governorate.nameEn, parent);

    for (const child of governorate.children) {
      await upsertZoneByName(child.nameAr, {
        description: `${child.nameEn || child.originalNameEn || child.nameAr} - ${governorate.nameAr}`,
        basePrice: 0,
        parentId: parent.id,
      });
    }
  }

  return { byEnglishName };
}

async function ensurePricingRule(zoneId: string, standardPrice: number, expressPrice: number, sameDayPrice: number, driverPayout?: number) {
  return prisma.pricingRule.upsert({
    where: { zoneId },
    update: {},
    create: { zoneId, standardPrice, expressPrice, sameDayPrice, driverPayout },
  });
}

async function findChildZone(parentId: string, names: string[]) {
  return prisma.zone.findFirst({
    where: {
      parentId,
      OR: names.map((name) => ({ name })),
    },
  });
}

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

  // المناطق المصرية: 27 محافظة و396 مدينة/منطقة من ملف بيانات محلي.
  const { byEnglishName } = await seedEgyptZones();
  const cairoZone = byEnglishName.get('Cairo')!;
  const gizaZone = byEnglishName.get('Giza')!;
  const alexZone = byEnglishName.get('Alexandria')!;
  const gharbiyaZone = byEnglishName.get('Gharbiya')!;
  const tantaZone = await findChildZone(gharbiyaZone.id, ['طنطا']);

  // قواعد التسعير (بالجنيه المصري). لا يتم تعديل الأسعار القائمة للحفاظ على إعدادات التشغيل.
  await ensurePricingRule(cairoZone.id, 25, 40, 70, 15);
  await ensurePricingRule(gizaZone.id, 30, 50, 80, 18);
  await ensurePricingRule(alexZone.id, 45, 75, 120);
  await ensurePricingRule(gharbiyaZone.id, 35, 60, 100);

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
      itemPrice:          350,
      deliveryFee:        40,
      addonsTotal:        0,
      grandTotal:         390,
      addons:             [],
      totalPrice:         390,
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
      itemPrice:       500,
      deliveryFee:     45,
      addonsTotal:     15,
      grandTotal:      560,
      addons:          [{ name: 'تغليف قابل للكسر', amount: 15 }],
      totalPrice:      560,
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
      itemPrice:          900,
      deliveryFee:        100,
      addonsTotal:        25,
      grandTotal:         1025,
      addons:             [{ name: 'خدمة إرجاع', amount: 25 }],
      totalPrice:         1025,
      zoneId:             tantaZone?.id ?? gharbiyaZone.id,
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
      orderTotal:     1025,
      companyProfit:  105,
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
