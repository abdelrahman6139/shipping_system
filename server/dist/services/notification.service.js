"use strict";
// Mock notification service - logs to console (replace with real email/SMS in production)
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.sendSMS = sendSMS;
exports.notifyOrderCreated = notifyOrderCreated;
exports.notifyOrderAssigned = notifyOrderAssigned;
exports.notifyDriverAssigned = notifyDriverAssigned;
exports.notifyStatusUpdate = notifyStatusUpdate;
exports.notifyTicketUpdate = notifyTicketUpdate;
exports.notifyRefundProcessed = notifyRefundProcessed;
async function sendEmail(data) {
    console.log(`📧 [EMAIL] To: ${data.to} | Subject: ${data.subject}`);
    console.log(`   Body: ${data.body}`);
}
async function sendSMS(phone, message) {
    console.log(`📱 [SMS] To: ${phone} | Message: ${message}`);
}
async function notifyOrderCreated(clientEmail, orderId) {
    await sendEmail({
        to: clientEmail,
        subject: 'Order Confirmation - ShipPro',
        body: `Your order #${orderId} has been placed successfully. We will notify you when it's assigned to a driver.`,
    });
}
async function notifyOrderAssigned(clientEmail, orderId, driverName) {
    await sendEmail({
        to: clientEmail,
        subject: 'Driver Assigned - ShipPro',
        body: `Your order #${orderId} has been assigned to driver ${driverName}.`,
    });
}
async function notifyDriverAssigned(driverEmail, orderId) {
    await sendEmail({
        to: driverEmail,
        subject: 'New Delivery Assigned - ShipPro',
        body: `You have been assigned a new delivery. Order ID: #${orderId}. Please check your dashboard.`,
    });
}
async function notifyStatusUpdate(clientEmail, orderId, status) {
    await sendEmail({
        to: clientEmail,
        subject: `Order Update - ShipPro`,
        body: `Your order #${orderId} status has been updated to: ${status}.`,
    });
}
async function notifyTicketUpdate(clientEmail, ticketId, status) {
    await sendEmail({
        to: clientEmail,
        subject: 'Support Ticket Update - ShipPro',
        body: `Your ticket #${ticketId} status has been updated to: ${status}.`,
    });
}
async function notifyRefundProcessed(clientEmail, orderId, amount) {
    await sendEmail({
        to: clientEmail,
        subject: 'Refund Processed - ShipPro',
        body: `A refund of $${amount} for order #${orderId} has been processed.`,
    });
}
