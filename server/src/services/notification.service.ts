// Mock notification service - logs to console (replace with real email/SMS in production)

interface NotificationData {
  to: string;
  subject: string;
  body: string;
}

export async function sendEmail(data: NotificationData): Promise<void> {
  console.log(`📧 [EMAIL] To: ${data.to} | Subject: ${data.subject}`);
  console.log(`   Body: ${data.body}`);
}

export async function sendSMS(phone: string, message: string): Promise<void> {
  console.log(`📱 [SMS] To: ${phone} | Message: ${message}`);
}

export async function notifyOrderCreated(clientEmail: string, orderId: string): Promise<void> {
  await sendEmail({
    to: clientEmail,
    subject: 'Order Confirmation - ShipPro',
    body: `Your order #${orderId} has been placed successfully. We will notify you when it's assigned to a driver.`,
  });
}

export async function notifyOrderAssigned(clientEmail: string, orderId: string, driverName: string): Promise<void> {
  await sendEmail({
    to: clientEmail,
    subject: 'Driver Assigned - ShipPro',
    body: `Your order #${orderId} has been assigned to driver ${driverName}.`,
  });
}

export async function notifyDriverAssigned(driverEmail: string, orderId: string): Promise<void> {
  await sendEmail({
    to: driverEmail,
    subject: 'New Delivery Assigned - ShipPro',
    body: `You have been assigned a new delivery. Order ID: #${orderId}. Please check your dashboard.`,
  });
}

export async function notifyStatusUpdate(clientEmail: string, orderId: string, status: string): Promise<void> {
  await sendEmail({
    to: clientEmail,
    subject: `Order Update - ShipPro`,
    body: `Your order #${orderId} status has been updated to: ${status}.`,
  });
}

export async function notifyTicketUpdate(clientEmail: string, ticketId: string, status: string): Promise<void> {
  await sendEmail({
    to: clientEmail,
    subject: 'Support Ticket Update - ShipPro',
    body: `Your ticket #${ticketId} status has been updated to: ${status}.`,
  });
}

export async function notifyRefundProcessed(clientEmail: string, orderId: string, amount: number): Promise<void> {
  await sendEmail({
    to: clientEmail,
    subject: 'Refund Processed - ShipPro',
    body: `A refund of $${amount} for order #${orderId} has been processed.`,
  });
}
