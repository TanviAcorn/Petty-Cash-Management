const nodemailer = require("nodemailer");
const { getUserEmail } = require("./userUtils");

// Normalize FRONTEND_URL: support comma-separated values and pick the first valid URL
function getFrontendBaseUrl() {
  const raw = process.env.FRONTEND_URL || "http://localhost:5174";
  // If multiple URLs are provided, separated by commas, pick the first one
  const first = String(raw).split(",")[0].trim();
  return first || "http://localhost:5174";
}

// Return all configured frontend URLs (first assumed public, second internal if present)
function getFrontendUrls() {
  const raw = process.env.FRONTEND_URL || "http://localhost:5174";
  return String(raw)
    .split(",")
    .map((s) => s.trim())
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
  const secure =
    String(process.env.SMTP_SECURE || "").toLowerCase() === "true" ||
    port === 465;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP is not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in your .env"
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
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
 * @param {string} [options.from] - Sender email
 * @param {string} [options.replyTo] - Reply-to email
 * @param {Object} [options.user] - User object with email and name
 * @param {Array<Object>} [options.attachments] - Array of attachment objects
 * @returns {Promise} Nodemailer sendMail result
 */
async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
  replyTo,
  user,
  cc,
  bcc,
  attachments = [], // Add attachments parameter with default empty array
}) {
  const tx = getTransporter();

  // Get the sender's email
  const sender = user
    ? getUserEmail(user)
    : from || process.env.FROM_EMAIL || process.env.SMTP_USER;

  // Format the 'from' field with user's name if available
  const fromField = user?.firstName
    ? `"${user.firstName}${
        user.lastName ? " " + user.lastName : ""
      }" <${sender}>`
    : sender;

  // Prepare email options
  const mailOptions = {
    from: fromField,
    to,
    cc,
    bcc,
    subject,
    html,
    text,
    replyTo: replyTo || sender,
  };

  // Add attachments if provided
  if (attachments && attachments.length > 0) {
    mailOptions.attachments = attachments;
  }

  return await tx.sendMail(mailOptions);
}

function buildAdminNewRequestEmail(newRequest) {
  const urls = getFrontendUrls();
  const publicLink = `${urls[0]}/requests/${newRequest.id}`;
  const internalLink = urls[1] ? `${urls[1]}/requests/${newRequest.id}` : null;
  const submittedAt = new Date(
    newRequest.created_at || Date.now()
  ).toLocaleString();

  // Use the ADMIN_EMAIL from environment variables
  const adminEmail = process.env.ADMIN_EMAIL;

  const to = adminEmail || "admin@example.com";
  const subject = `New Petty Cash Request Submitted (#${newRequest.id})`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>New Petty Cash Request Submitted</h2>
      <p>A new request has been submitted in the Petty Cash Management System.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Employee</td><td style="padding:6px 8px; border-bottom:1px solid #eee;"><strong>${
          newRequest.employee_name
        }</strong> (${newRequest.employee_email})</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Date</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${submittedAt}</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Category</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${
          newRequest.category_name || "-"
        }</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Company</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${
          newRequest.company_name || "-"
        }</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Reason</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${
          newRequest.reason || "-"
        }</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Amount</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${
          newRequest.amount
        }</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Location</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${
          newRequest.location || "-"
        }</td></tr>
      </table>
      <div style="margin-top:16px;">
        <p>Please review the request using the appropriate link below:</p>
        <a href="${publicLink}" style="background:#1976d2; color:#fff; padding:10px 14px; border-radius:6px; text-decoration:none; display:inline-block; margin-right: 10px;">Review (Public)</a>
        ${
          internalLink
            ? `<a href="${internalLink}" style="background:#455a64; color:#fff; padding:10px 14px; border-radius:6px; text-decoration:none; display:inline-block;">Review (Internal)</a>`
            : ""
        }
      </div>
      <p style="color:#666; font-size:12px;">If you are already logged in, you will be redirected to the Requests Review page.</p>
    </div>
  `;
  return { subject, html };
}

function buildUserStatusEmail(requestRow) {
  const status = String(requestRow.status || "").toLowerCase();
  const subject = `Your Petty Cash Request (#${requestRow.id}) has been ${status}`;
  const message =
    status === "approved"
      ? "approved"
      : status === "rejected"
      ? "rejected"
      : "updated";
  const urls = getFrontendUrls();
  const publicLink = `${urls[0]}/my-requests`;
  const internalLink = urls[1] ? `${urls[1]}/my-requests` : null;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>Your request has been ${message}</h2>
      <p>Request details:</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Status</td><td style="padding:6px 8px; border-bottom:1px solid #eee;"><strong>${
          requestRow.status
        }</strong></td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Category</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${
          requestRow.category_name || "-"
        }</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Company</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${
          requestRow.company_name || "-"
        }</td></tr>
        <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Amount</td><td style="padding:6px 8px; border-bottom:1px solid #eee;">${
          requestRow.amount
        }</td></tr>
      </table>
      <div style="margin-top:16px;">
         <p>You can view your requests using the appropriate link below:</p>
        <a href="${publicLink}" style="background:#1976d2; color:#fff; padding:10px 14px; border-radius:6px; text-decoration:none; display:inline-block; margin-right: 10px;">View My Requests (Public)</a>
        ${
          internalLink
            ? `<a href="${internalLink}" style="background:#455a64; color:#fff; padding:10px 14px; border-radius:6px; text-decoration:none; display:inline-block;">View My Requests (Internal)</a>`
            : ""
        }
      </div>
    </div>
  `;
  return { subject, html };
}

function buildPaymentInitiatedEmail({ request, payment }) {
  const urls = getFrontendUrls(); // Assuming this function is available
  const publicUrl = urls[0] || "http://localhost:5174";
  const internalUrl = urls[1] || null;
  const publicLink = `${publicUrl}/requests/${request.id}/upload-receipt`;
  const internalLink = internalUrl
    ? `${internalUrl}/requests/${request.id}/upload-receipt`
    : null;
  
  // Check if this is an intercompany transfer
  const isIntercompany = request.previousCompany && request.previousCompany !== (request.company_name || request.company);
  
  const subject = `Payment Initiated${isIntercompany ? ' (Intercompany)' : ''}: Request #${request.id} (${
    request.employee_name || request.employeeName || ""
  })`; // The attachments list contains file metadata (name, size, type)

  const receiptAttachments = (payment.receiptAttachments || []).filter(
    (a) => a
  );
  const hasReceiptAttachments = receiptAttachments.length > 0;

  const paymentProofAttachments = (
    payment.paymentProofAttachments || []
  ).filter((a) => a);
  const hasPaymentProofAttachments = paymentProofAttachments.length > 0;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Payment Initiated${isIntercompany ? ' <span style="color: #9c27b0;">(Intercompany Transfer)</span>' : ''}</h2>
        <p>The admin has initiated payment for the following petty cash request. Please find the payment details below.</p>
  
        ${isIntercompany ? `
        <div style="background-color: #f3e5f5; border-left: 4px solid #9c27b0; padding: 12px; margin-bottom: 20px; border-radius: 4px;">
          <h3 style="margin: 0 0 8px 0; color: #9c27b0;">⚠️ Intercompany Transfer</h3>
          <p style="margin: 0; color: #4a148c;">
            <strong>Original Company:</strong> ${request.previousCompany}<br>
            <strong>New Company (Pay to):</strong> ${request.company_name || request.company}
          </p>
          <p style="margin: 8px 0 0 0; font-size: 0.9em; color: #6a1b9a;">
            This expense has been transferred from ${request.previousCompany} to ${request.company_name || request.company}. 
            Please process payment under the new company.
          </p>
        </div>
        ` : ''}
  
        <h3>Request Details</h3>
        <table style="border-collapse: collapse; width: 100%; max-width: 640px; margin-bottom: 16px;">
      <tr><td style="padding:8px; border-bottom:1px solid #eee; width: 180px;"><strong>Request ID</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">#${
        request.id
      }</td></tr>
      <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Employee</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${
        request.employee_name || request.employeeName
      } (${request.employee_email || request.employeeEmail})</td></tr>
      <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Company</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${
        request.company_name || request.company || "-"
      }${isIntercompany ? ' <span style="color: #9c27b0; font-weight: bold;">(Transferred)</span>' : ''}</td></tr>
      ${isIntercompany ? `<tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Original Company</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${request.previousCompany}</td></tr>` : ''}
        <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Category</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${
          request.category_name || request.category || "-"
        }</td></tr>
        <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Location</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${
          request.location || "-"
        }</td></tr>
        <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Amount</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${
          request.amount
        } ${request.currency || ""}</td></tr>
        <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Description</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${
          request.reason || request.description || "-"
        }</td></tr>
        </table>
  
  <h3 style="margin-top: 20px; margin-bottom: 8px;">Payment Details</h3>
  <table style="border-collapse: collapse; width: 100%; max-width: 640px; margin-bottom: 16px;">
  <tr><td style="padding:8px; border-bottom:1px solid #eee; width: 180px;"><strong>Payment Method</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${
    payment.method
  }</td></tr>
  ${
    payment.reference
      ? `<tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Reference</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${payment.reference}</td></tr>`
      : ""
  }
  <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Paid Amount</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${
    payment.paidAmount || request.amount
  } ${request.currency || ""}</td></tr>
  <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Paid Date</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${
    payment.paidDate
      ? new Date(payment.paidDate).toLocaleDateString()
      : new Date().toLocaleDateString()
  }</td></tr>
  ${
    payment.notes
      ? `<tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Notes</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${payment.notes}</td></tr>`
      : ""
  }
  ${
    payment.processedBy
      ? `<tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Processed By</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${payment.processedBy}</td></tr>`
      : ""
  }
   </table>
   
   ${
     hasReceiptAttachments
       ? `
   <h3 style="margin-top: 20px; margin-bottom: 8px;">Receipt Attachments (${
     receiptAttachments.length
   })</h3>
   <div style="background-color: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 4px; padding: 12px; margin-bottom: 20px;">
   <p style="margin: 0 0 8px 0; color: #333;">The following payment receipt files are attached to this email:</p>
  <ul style="margin: 0; padding-left: 20px;">
   ${receiptAttachments
     .map(
       (file, index) => `<li style="margin-bottom: 4px;">
   📎 <span style="color: #1976d2;">${
     file.originalName || file.filename || `Attachment ${index + 1}`
   }</span>
   ${
     file.size
       ? `<span style="color: #666; font-size: 0.9em; margin-left: 8px;">(${(
           file.size / 1024
         ).toFixed(1)} KB)</span>`
       : ""
   }
  </li>`
     )
     .join("")}
  </ul>
   </div>
   `
       : ""
   }
   
  ${
    hasPaymentProofAttachments
      ? `
   <h3 style="margin-top: 20px; margin-bottom: 8px;">Payment Proof Attachments (${
     paymentProofAttachments.length
   })</h3>
  <div style="background-color: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 4px; padding: 12px; margin-bottom: 20px;">
  <p style="margin: 0 0 8px 0; color: #333;">The following payment proof files are attached:</p>
  <ul style="margin: 0; padding-left: 20px;">
   ${paymentProofAttachments
     .map(
       (file) => `<li style="margin-bottom: 4px;">
   <span style="color: #1976d2; text-decoration: none;">${
     file.originalName || file.filename || "Payment Proof"
   }</span>
   ${
     file.size
       ? `<span style="color: #666; font-size: 0.9em; margin-left: 8px;">(${(
           file.size / 1024
         ).toFixed(1)} KB)</span>`
       : ""
   }
  </li>`
     )
     .join("")}
  </ul>
   </div>
  `
      : ""
  }
   
 <div style="margin: 24px 0; padding: 16px; background-color: #e8f4fd; border-radius: 4px;">
  <h3 style="margin-top: 0; color: #0d47a1;">Next Steps</h3>
 <p style="margin-bottom: 12px;">Please process this payment and upload the payment receipt using the link below:</p>
 <div style="margin-top: 12px;">
<a href="${publicLink}" style="background:#1976d2; color:#fff; padding:10px 16px; border-radius:4px; text-decoration:none; display:inline-block; font-weight:500; margin-right: 8px;">
   Upload Payment Receipt (Public)
</a>
   ${
     internalLink
       ? `
<a href="${internalLink}" style="background:#455a64; color:#fff; padding:10px 16px; border-radius:4px; text-decoration:none; display:inline-block; font-weight:500;">
   Upload Payment Receipt (Internal)
  </a>
   `
       : ""
   }
 </div>
</div>
 
   <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; color: #666; line-height: 1.5;">
   <p style="margin: 0 0 8px 0;"><strong>Important:</strong> This is an automated notification. Please do not reply to this email.</p>
  <p style="margin: 0 0 4px 0;">If you encounter any issues, please contact your system administrator.</p>
  </div>
  </div>
  `;
  return { subject, html };
}

module.exports = {
  sendEmail,
  buildAdminNewRequestEmail,
  buildUserStatusEmail,
  getTransporter,
  buildPaymentInitiatedEmail,
};
