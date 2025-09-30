const nodemailer = require('nodemailer');
const { getUserEmail } = require('./userUtils');

// Normalize FRONTEND_URL: support comma-separated values and pick the first valid URL
function getFrontendBaseUrl() {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5174';
  // If multiple URLs are provided, separated by commas, pick the first one
  const first = String(raw).split(',')[0].trim();
  return first || 'http://localhost:5174';
}

// Return all configured frontend URLs (first assumed public, second internal if present)
function getFrontendUrls() {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5174';
  return String(raw)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

// Create a reusable transporter using SMTP settings from environment
// Required env vars:
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE(optional), FROM_EMAIL(optional), ADMIN_EMAIL, FRONTEND_URL
let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

  if (!host || !user || !pass) {
    throw new Error('SMTP is not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in your .env');
  }

  transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  return transporter;
}

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string|Array<string>} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML email content
 * @param {string} [options.text] - Plain text email content
 * @param {string|Array<string>} [options.cc] - CC email(s)
 * @param {string|Array<string>} [options.bcc] - BCC email(s)
 * @param {string} [options.from] - Sender email (will be overridden by user email if provided)
 * @param {string} [options.replyTo] - Reply-to email
 * @param {Object} [options.user] - User object containing email and name for sender
 * @returns {Promise} Nodemailer sendMail result
 */
async function sendEmail({ to, subject, html, text, from, replyTo, user, cc, bcc }) {
  const tx = getTransporter();
  
  // Get the sender's email - use user's email if available, otherwise use provided from or default
  const sender = user ? getUserEmail(user) : (from || process.env.FROM_EMAIL || process.env.SMTP_USER);
  
  // Format the 'from' field with user's name if available
  const fromField = user?.firstName 
    ? `"${user.firstName}${user.lastName ? ' ' + user.lastName : ''}" <${sender}>`
    : sender;
  
  const info = await tx.sendMail({ 
    from: fromField, 
    to, 
    cc,
    bcc,
    subject, 
    html, 
    text,
    replyTo: replyTo || sender
  });
  
  return info;
}

function buildAdminNewRequestEmail(newRequest) {
  const urls = getFrontendUrls();
  const publicLink = `${urls[0]}/requests/${newRequest.id}`;
  const internalLink = urls[1] ? `${urls[1]}/requests/${newRequest.id}` : null;
  const submittedAt = new Date(newRequest.created_at || Date.now()).toLocaleString();
  
  // Use the ADMIN_EMAIL from environment variables
  const adminEmail = process.env.ADMIN_EMAIL;

  const to = adminEmail || 'admin@example.com';
  const subject = `New Petty Cash Request Submitted (#${newRequest.id})`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>New Petty Cash Request Submitted</h2>
      <p>A new request has been submitted in the Petty Cash Management System.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Employee</td><td style="padding:6px 8px; border-bottom:1px solid #eee;"><strong>${newRequest.employee_name}</strong> (${newRequest.employee_email})</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Date</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${submittedAt}</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Category</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${newRequest.category_name || '-'}</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Company</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${newRequest.company_name || '-'}</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Amount</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${newRequest.amount}</td></tr>
      </table>
      <div style="margin-top:16px;">
        <p>Please review the request using the appropriate link below:</p>
        <a href="${publicLink}" style="background:#1976d2; color:#fff; padding:10px 14px; border-radius:6px; text-decoration:none; display:inline-block; margin-right: 10px;">Review (Public)</a>
        ${internalLink ? `<a href="${internalLink}" style="background:#455a64; color:#fff; padding:10px 14px; border-radius:6px; text-decoration:none; display:inline-block;">Review (Internal)</a>` : ''}
      </div>
      <p style="color:#666; font-size:12px;">If you are already logged in, you will be redirected to the Requests Review page.</p>
    </div>
  `;
  return { subject, html };
}

function buildUserStatusEmail(requestRow) {
  const status = String(requestRow.status || '').toLowerCase();
  const subject = `Your Petty Cash Request (#${requestRow.id}) has been ${status}`;
  const message = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'updated';
  const urls = getFrontendUrls();
  const publicLink = `${urls[0]}/my-requests`;
  const internalLink = urls[1] ? `${urls[1]}/my-requests` : null;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>Your request has been ${message}</h2>
      <p>Request details:</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Status</td><td style="padding:6px 8px; border-bottom:1px solid #eee;"><strong>${requestRow.status}</strong></td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Category</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${requestRow.category_name || '-'}</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Company</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${requestRow.company_name || '-'}</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Amount</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${requestRow.amount}</td></tr>
      </table>
      <div style="margin-top:16px;">
         <p>You can view your requests using the appropriate link below:</p>
        <a href="${publicLink}" style="background:#1976d2; color:#fff; padding:10px 14px; border-radius:6px; text-decoration:none; display:inline-block; margin-right: 10px;">View My Requests (Public)</a>
        ${internalLink ? `<a href="${internalLink}" style="background:#455a64; color:#fff; padding:10px 14px; border-radius:6px; text-decoration:none; display:inline-block;">View My Requests (Internal)</a>` : ''}
      </div>
    </div>
  `;
  return { subject, html };
}

function buildPaymentInitiatedEmail({ request, payment }) {
  const urls = getFrontendUrls();
  const publicUrl = urls[0] || 'http://localhost:5174';
  const internalUrl = urls[1] || null;
  const publicLink = `${publicUrl}/requests/${request.id}/upload-receipt`;
  const internalLink = internalUrl ? `${internalUrl}/requests/${request.id}/upload-receipt` : null;
  const subject = `Payment Initiated: Request #${request.id} (${request.employee_name || request.employeeName || ''})`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Proceed to Payment Triggered</h2>
      <p>The admin has initiated payment for the following petty cash request. Please upload the payment receipt using the link below.</p>
      <h3>Request Details</h3>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Request ID</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">#${request.id}</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Employee</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${request.employee_name || request.employeeName} (${request.employee_email || request.employeeEmail})</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Company</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${request.company_name || request.company || '-'}</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Category</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${request.category_name || request.category || '-'}</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Amount</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${request.amount}</td></tr>
      </table>
      <h3 style="margin-top:16px;">Payment Details</h3>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Method</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${payment.method}</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Reference</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${payment.reference || '-'}</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Paid Amount</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${payment.paidAmount}</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Paid Date</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${payment.paidDate}</td></tr>
        ${payment.notes ? `<tr><td style=\"padding:6px 8px; border-bottom:1px solid #eee;\">Notes</td><td style=\"padding:6px 8px; border-bottom:1px solid #eee;\">${payment.notes}</td></tr>` : ''}
      </table>
      <div style="margin-top:16px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <a href="${publicLink}" style="background:#1976d2; color:#fff; padding:10px 14px; border-radius:6px; text-decoration:none; display:inline-block;">Upload Receipt (Public)</a>
        ${internalLink ? `<a href="${internalLink}" style="background:#455a64; color:#fff; padding:10px 14px; border-radius:6px; text-decoration:none; display:inline-block;">Upload Receipt (Internal)</a>` : ''}
      </div>
      <p style="color:#666; font-size:14px; margin-top:8px;">
        Please upload the payment receipt after completing the transaction.
      </p>
      <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #eee; font-size: 12px; color: #777;">
        <p>If the buttons do not work, use the links below:</p>
        <p><b>Public URL (for external access):</b> <a href="${publicLink}">${publicLink}</a></p>
        ${internalLink ? `<p><b>Internal URL (for local network access):</b> <a href="${internalLink}">${internalLink}</a></p>` : ''}
      </div>
    </div>
  `;
  return { subject, html };
}

module.exports = { sendEmail, buildAdminNewRequestEmail, buildUserStatusEmail, getTransporter, buildPaymentInitiatedEmail };
