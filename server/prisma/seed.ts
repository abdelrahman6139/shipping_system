import { PrismaClient, Role, DeliveryType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Admin
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@shippro.com' },
    update: {},
    create: { name: 'Admin User', email: 'admin@shippro.com', phone: '+1-555-0100', password: adminPassword, role: 'ADMIN' },
  });

  // Create Drivers
  const driverPassword = await bcrypt.hash('driver123', 12);
  const driver1 = await prisma.user.upsert({
    where: { email: 'driver1@shippro.com' },
    update: {},
    create: { name: 'John Driver', email: 'driver1@shippro.com', phone: '+1-555-0200', password: driverPassword, role: 'DRIVER' },
  });
  const driver2 = await prisma.user.upsert({
    where: { email: 'driver2@shippro.com' },
    update: {},
    create: { name: 'Jane Delivery', email: 'driver2@shippro.com', phone: '+1-555-0201', password: driverPassword, role: 'DRIVER' },
  });

  // Create Clients
  const clientPassword = await bcrypt.hash('client123', 12);
  const client1 = await prisma.user.upsert({
    where: { email: 'client1@shippro.com' },
    update: {},
    create: { name: 'Alice Smith', email: 'client1@shippro.com', phone: '+1-555-0300', password: clientPassword, role: 'CLIENT' },
  });
  const client2 = await prisma.user.upsert({
    where: { email: 'client2@shippro.com' },
    update: {},
    create: { name: 'Bob Johnson', email: 'client2@shippro.com', phone: '+1-555-0301', password: clientPassword, role: 'CLIENT' },
  });

  // Create Zones
  const zone1 = await prisma.zone.upsert({
    where: { name: 'Downtown' },
    update: {},
    create: { name: 'Downtown', description: 'City center and surrounding downtown area', basePrice: 5.00 },
  });
  const zone2 = await prisma.zone.upsert({
    where: { name: 'Suburban' },
    update: {},
    create: { name: 'Suburban', description: 'Residential suburban neighborhoods', basePrice: 8.00 },
  });
  const zone3 = await prisma.zone.upsert({
    where: { name: 'Rural' },
    update: {},
    create: { name: 'Rural', description: 'Countryside and remote areas', basePrice: 15.00 },
  });
  const zone4 = await prisma.zone.upsert({
    where: { name: 'Industrial' },
    update: {},
    create: { name: 'Industrial', description: 'Industrial parks and warehouses', basePrice: 10.00 },
  });

  // Create Pricing Rules
  await prisma.pricingRule.upsert({
    where: { zoneId: zone1.id },
    update: {},
    create: { zoneId: zone1.id, pricePerKg: 1.2, standardMultiplier: 1.0, expressMultiplier: 1.5, sameDayMultiplier: 2.0 },
  });
  await prisma.pricingRule.upsert({
    where: { zoneId: zone2.id },
    update: {},
    create: { zoneId: zone2.id, pricePerKg: 1.5, standardMultiplier: 1.0, expressMultiplier: 1.5, sameDayMultiplier: 2.0 },
  });
  await prisma.pricingRule.upsert({
    where: { zoneId: zone3.id },
    update: {},
    create: { zoneId: zone3.id, pricePerKg: 2.0, standardMultiplier: 1.0, expressMultiplier: 1.5, sameDayMultiplier: 2.0 },
  });
  await prisma.pricingRule.upsert({
    where: { zoneId: zone4.id },
    update: {},
    create: { zoneId: zone4.id, pricePerKg: 1.8, standardMultiplier: 1.0, expressMultiplier: 1.5, sameDayMultiplier: 2.0 },
  });

  // Create Sample Orders
  const order1 = await prisma.order.create({
    data: {
      clientId: client1.id,
      driverId: driver1.id,
      pickupAddress: '123 Main St, Downtown',
      destination: '456 Oak Ave, Suburban',
      packageDescription: 'Electronics - Laptop',
      weight: 2.5,
      length: 40, width: 30, height: 10,
      deliveryType: 'EXPRESS',
      status: 'IN_TRANSIT',
      totalPrice: 20.25,
      zoneId: zone1.id,
    },
  });

  const order2 = await prisma.order.create({
    data: {
      clientId: client2.id,
      pickupAddress: '789 Pine Rd, Industrial',
      destination: '321 Elm St, Rural',
      packageDescription: 'Books and Documents',
      weight: 5.0,
      length: 50, width: 40, height: 20,
      deliveryType: 'STANDARD',
      status: 'PENDING',
      totalPrice: 25.00,
      zoneId: zone4.id,
    },
  });

  const order3 = await prisma.order.create({
    data: {
      clientId: client1.id,
      driverId: driver2.id,
      pickupAddress: '55 Commerce Blvd, Industrial',
      destination: '90 Maple Dr, Suburban',
      packageDescription: 'Clothing and Accessories',
      weight: 3.0,
      length: 60, width: 40, height: 30,
      deliveryType: 'SAME_DAY',
      status: 'DELIVERED',
      totalPrice: 46.00,
      zoneId: zone2.id,
    },
  });

  // Invoices for orders
  await prisma.invoice.upsert({
    where: { orderId: order1.id },
    update: {},
    create: { orderId: order1.id, pdfUrl: null },
  });
  await prisma.invoice.upsert({
    where: { orderId: order2.id },
    update: {},
    create: { orderId: order2.id, pdfUrl: null },
  });
  await prisma.invoice.upsert({
    where: { orderId: order3.id },
    update: {},
    create: { orderId: order3.id, pdfUrl: null },
  });

  // Driver earnings for delivered order
  await prisma.driverEarning.upsert({
    where: { orderId: order3.id },
    update: {},
    create: { driverId: driver2.id, orderId: order3.id, amount: 6.90 },
  });

  // Sample ticket
  const ticket = await prisma.ticket.create({
    data: {
      clientId: client1.id,
      orderId: order1.id,
      subject: 'Package delayed - need update',
      status: 'OPEN',
      messages: {
        create: { senderId: client1.id, message: 'My package is showing as in transit for 2 days. Please advise.' },
      },
    },
  });

  console.log('✅ Seed completed!');
  console.log('\n🔑 Demo credentials:');
  console.log('  Admin:  admin@shippro.com  / admin123');
  console.log('  Driver: driver1@shippro.com / driver123');
  console.log('  Client: client1@shippro.com / client123');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
