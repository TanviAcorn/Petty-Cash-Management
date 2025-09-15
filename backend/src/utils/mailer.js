const nodemailer = require('nodemailer');

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

async function sendEmail({ to, subject, html, text, from, replyTo }) {
  const tx = getTransporter();
  // Prefer dynamic from if provided, otherwise fall back to configured sender
  const sender = from || process.env.FROM_EMAIL || process.env.SMTP_USER;
  const info = await tx.sendMail({ from: sender, to, subject, html, text, replyTo });
  return info;
}

function buildAdminNewRequestEmail(newRequest) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
  const loginLink = `${frontendUrl}/login?next=/all-requests`;
  const submittedAt = new Date(newRequest.created_at || Date.now()).toLocaleString();

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
      <p style="margin-top:16px;">
        <a href="${loginLink}" style="background:#1976d2; color:#fff; padding:10px 14px; border-radius:6px; text-decoration:none;">Review Requests</a>
      </p>
      <p style="color:#666; font-size:12px;">If you are already logged in, you will be redirected to the All Requests page.</p>
    </div>
  `;
  return { subject, html };
}

function buildUserStatusEmail(requestRow) {
  const status = String(requestRow.status || '').toLowerCase();
  const subject = `Your Petty Cash Request (#${requestRow.id}) has been ${status}`;
  const message = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'updated';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
  const link = `${frontendUrl}/my-requests`;

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
      <p style="margin-top:16px;">
        <a href="${link}" style="background:#1976d2; color:#fff; padding:10px 14px; border-radius:6px; text-decoration:none;">View My Requests</a>
      </p>
    </div>
  `;
  return { subject, html };
}

module.exports = { sendEmail, buildAdminNewRequestEmail, buildUserStatusEmail, getTransporter };
