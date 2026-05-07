const nodemailer = require("nodemailer");
const { getUserEmail } = require("./userUtils");

// Normalize FRONTEND_URL: support comma-separated values and pick the first valid URL
function getFrontendBaseUrl() {
  const raw = process.env.FRONTEND_URL || "http://localhost:5174";
  const first = String(raw).split(",")[0].trim().replace(/\/$/, '');
  const url = first || "http://localhost:5174";
  if (/^https?:\/\/\d+\.\d+\.\d+\.\d+/.test(url) || url.includes('localhost')) {
    console.warn('[Mailer] WARNING: FRONTEND_URL is a local/IP address:', url,
      '— email links will not work for external recipients. Set FRONTEND_URL to the production domain.');
  }
  return url;
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
  attachments = [],
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
  const submittedAt = new Date(newRequest.created_at || Date.now()).toLocaleString();

  const subject = `Petty Cash Request #${newRequest.id} - Approval Required`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        
        <!-- Header -->
        <div style="background: #3B82F6; padding: 30px 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Approval Required</h1>
        </div>
        
        <!-- Content -->
        <div style="background: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          
          <p style="margin: 0 0 20px 0; color: #374151; font-size: 15px; line-height: 1.5;">
            The following petty cash request has been submitted and requires your review.
          </p>
          
          <!-- Request Details Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; background: #f9fafb; border-radius: 6px; overflow: hidden;">
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; width: 140px;">Request ID</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 500;">#${newRequest.id}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Date</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${submittedAt}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Requested By</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${newRequest.employee_name} (${newRequest.employee_email})</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Company</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${newRequest.company_name || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Category</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${newRequest.category_name || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Amount</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 600;">${newRequest.amount} ${newRequest.currency || 'GBP'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; color: #6b7280; font-size: 13px;">Description</td>
              <td style="padding: 12px 16px; color: #111827; font-size: 14px;">${newRequest.reason || '-'}</td>
            </tr>
          </table>
          
          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0 20px 0;">
            <a href="${publicLink}" style="display: inline-block; background: #3B82F6; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">Review & Approve Request</a>
          </div>
          
          <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 13px; text-align: center;">
            Please review the request details and take appropriate action through the approval page.
          </p>
          
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 20px; padding: 15px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">This is an automated notification from PocketPro HR.</p>
        </div>
        
      </div>
    </body>
    </html>
  `;
  
  return { subject, html };
}

function buildUserStatusEmail(requestRow) {
  const status = String(requestRow.status || "").toLowerCase();
  const isApproved = status === "approved";
  const isRejected = status === "rejected";
  
  const subject = `Petty Cash Request #${requestRow.id} - ${isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Updated'}`;
  
  const urls = getFrontendUrls();
  const publicLink = `${urls[0]}/my-requests`;
  
  const statusText = isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Updated';
  const headerTitle = `Request ${statusText}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        
        <!-- Header -->
        <div style="background: #3B82F6; padding: 30px 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">${headerTitle}</h1>
        </div>
        
        <!-- Content -->
        <div style="background: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          
          <p style="margin: 0 0 20px 0; color: #374151; font-size: 15px; line-height: 1.5;">
            Your petty cash request has been ${statusText.toLowerCase()}.
          </p>
          
          <!-- Request Details Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; background: #f9fafb; border-radius: 6px; overflow: hidden;">
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; width: 140px;">Request ID</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 500;">#${requestRow.id}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Status</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 500;">${statusText}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Company</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${requestRow.company_name || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Category</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${requestRow.category_name || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; ${isRejected && requestRow.rejection_reason ? 'border-bottom: 1px solid #e5e7eb;' : ''} color: #6b7280; font-size: 13px;">Amount</td>
              <td style="padding: 12px 16px; ${isRejected && requestRow.rejection_reason ? 'border-bottom: 1px solid #e5e7eb;' : ''} color: #111827; font-size: 14px; font-weight: 600;">${requestRow.amount} ${requestRow.currency || 'GBP'}</td>
            </tr>
            ${isRejected && requestRow.rejection_reason ? `
            <tr>
              <td style="padding: 12px 16px; color: #6b7280; font-size: 13px;">Reason</td>
              <td style="padding: 12px 16px; color: #111827; font-size: 14px;">${requestRow.rejection_reason}</td>
            </tr>
            ` : ''}
          </table>
          
          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0 20px 0;">
            <a href="${publicLink}" style="display: inline-block; background: #3B82F6; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">View My Requests</a>
          </div>
          
          <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 13px; text-align: center;">
            ${isApproved ? 'Your request will be processed for payment shortly.' : isRejected ? 'Please contact your manager if you have questions.' : 'Check your requests page for more details.'}
          </p>
          
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 20px; padding: 15px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">This is an automated notification from PocketPro HR.</p>
        </div>
        
      </div>
    </body>
    </html>
  `;
  
  return { subject, html };
}

function buildPaymentInitiatedEmail({ request, payment }) {
  const urls = getFrontendUrls();
  const publicLink = `${urls[0]}/requests/${request.id}/upload-receipt`;
  
  // Check if this is an intercompany transfer
  const isIntercompany = request.previousCompany && request.previousCompany !== (request.company_name || request.company);
  
  const subject = `Payment Initiated${isIntercompany ? ' (Intercompany)' : ''} - Request #${request.id}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        
        <!-- Header -->
        <div style="background: #3B82F6; padding: 30px 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Payment Initiated${isIntercompany ? ' (Intercompany)' : ''}</h1>
        </div>
        
        <!-- Content -->
        <div style="background: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          
          <p style="margin: 0 0 20px 0; color: #374151; font-size: 15px; line-height: 1.5;">
            The admin has initiated payment for the following petty cash request.
          </p>
          
          ${isIntercompany ? `
          <!-- Intercompany Transfer Alert -->
          <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
            <p style="margin: 0 0 8px 0; color: #92400E; font-weight: 600; font-size: 14px;">⚠️ Intercompany Transfer</p>
            <p style="margin: 0; color: #78350F; font-size: 13px; line-height: 1.5;">
              <strong>Original Company:</strong> ${request.previousCompany}<br>
              <strong>New Company:</strong> ${request.company_name || request.company}<br>
              <span style="font-size: 12px;">This expense has been transferred. Please process payment under the new company.</span>
            </p>
          </div>
          ` : ''}
          
          <!-- Request Details Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; background: #f9fafb; border-radius: 6px; overflow: hidden;">
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; width: 140px;">Request ID</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 500;">#${request.id}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Employee</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${request.employee_name || request.employeeName} (${request.employee_email || request.employeeEmail})</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Company</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${request.company_name || request.company || '-'}${isIntercompany ? ' <span style="color: #F59E0B; font-weight: 500;">(Transferred)</span>' : ''}</td>
            </tr>
            ${isIntercompany ? `
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Original Company</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${request.previousCompany}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Category</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${request.category_name || request.category || '-'}</td>
            </tr>
            ${request.location ? `
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Location</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${request.location}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Amount</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 600;">${request.amount} ${request.currency || 'GBP'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; color: #6b7280; font-size: 13px;">Description</td>
              <td style="padding: 12px 16px; color: #111827; font-size: 14px;">${request.reason || request.description || '-'}</td>
            </tr>
          </table>
          
          <!-- Payment Details -->
          <p style="margin: 20px 0 10px 0; color: #111827; font-size: 15px; font-weight: 600;">Payment Details</p>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; background: #f9fafb; border-radius: 6px; overflow: hidden;">
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; width: 140px;">Payment Method</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${payment.method}</td>
            </tr>
            ${payment.reference ? `
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Reference</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${payment.reference}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Paid Amount</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 600;">${payment.paidAmount || request.amount} ${request.currency || 'GBP'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; ${payment.notes ? 'border-bottom: 1px solid #e5e7eb;' : ''} color: #6b7280; font-size: 13px;">Paid Date</td>
              <td style="padding: 12px 16px; ${payment.notes ? 'border-bottom: 1px solid #e5e7eb;' : ''} color: #111827; font-size: 14px;">${payment.paidDate ? new Date(payment.paidDate).toLocaleDateString() : new Date().toLocaleDateString()}</td>
            </tr>
            ${payment.notes ? `
            <tr>
              <td style="padding: 12px 16px; color: #6b7280; font-size: 13px;">Notes</td>
              <td style="padding: 12px 16px; color: #111827; font-size: 14px;">${payment.notes}</td>
            </tr>
            ` : ''}
          </table>
          
          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0 20px 0;">
            <a href="${publicLink}" style="display: inline-block; background: #3B82F6; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">Upload Payment Receipt</a>
          </div>
          
          <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 13px; text-align: center;">
            Please process this payment and upload the payment receipt using the link above.
          </p>
          
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 20px; padding: 15px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">This is an automated notification from PocketPro HR.</p>
        </div>
        
      </div>
    </body>
    </html>
  `;
  
  return { subject, html };
}

function buildBulkPaymentEmail({ requests, groupedByCompany }) {
  const urls = getFrontendUrls();
  const publicLink = `${urls[0]}/approved`;
  
  const totalRequests = requests.length;
  const totalAmount = requests.reduce((sum, req) => sum + Number(req.amount || 0), 0);
  const companies = Object.keys(groupedByCompany);
  
  const subject = `Payment Initiated - ${totalRequests} Request(s) for Processing`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
        
        <!-- Header -->
        <div style="background: #3B82F6; padding: 30px 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Payment Initiated</h1>
        </div>
        
        <!-- Content -->
        <div style="background: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          
          <p style="margin: 0 0 20px 0; color: #374151; font-size: 15px; line-height: 1.5;">
            The admin has initiated payment for the following ${totalRequests} approved petty cash request(s).
          </p>
          
          <!-- Summary Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; background: #f9fafb; border-radius: 6px; overflow: hidden;">
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; width: 140px;">Total Requests</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 500;">${totalRequests}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Total Amount</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 600;">£${totalAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; vertical-align: top;">Companies</td>
              <td style="padding: 12px 16px; color: #111827; font-size: 14px;">
                <table style="width: 100%; border-collapse: collapse;">
                  ${companies.map((company, idx) => {
                    const count = groupedByCompany[company].length;
                    const companyTotal = groupedByCompany[company].reduce((sum, req) => sum + Number(req.amount || 0), 0);
                    return `
                    <tr>
                      <td style="padding: 4px 0; color: #111827; font-size: 14px;">${company}</td>
                      <td style="padding: 4px 0; color: #6b7280; font-size: 13px; text-align: right;">${count} request(s) - £${companyTotal.toFixed(2)}</td>
                    </tr>
                    `;
                  }).join('')}
                </table>
              </td>
            </tr>
          </table>
          
          ${companies.map(companyName => {
            const companyRequests = groupedByCompany[companyName];
            const companyTotal = companyRequests.reduce((sum, req) => sum + Number(req.amount || 0), 0);
            
            return `
            <!-- Company Section -->
            <div style="margin-bottom: 30px;">
              <h2 style="margin: 0 0 15px 0; color: #111827; font-size: 16px; font-weight: 600; border-bottom: 2px solid #3B82F6; padding-bottom: 8px;">
                ${companyName} (${companyRequests.length} request(s) - £${companyTotal.toFixed(2)})
              </h2>
              
              <!-- Requests Table -->
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #f9fafb; border-radius: 6px; overflow: hidden;">
                <thead>
                  <tr style="background: #F3F4F6;">
                    <th style="padding: 10px 12px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600; border-bottom: 2px solid #e5e7eb;">ID</th>
                    <th style="padding: 10px 12px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Employee</th>
                    <th style="padding: 10px 12px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Category</th>
                    <th style="padding: 10px 12px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Location</th>
                    <th style="padding: 10px 12px; text-align: right; color: #6b7280; font-size: 12px; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Amount</th>
                    <th style="padding: 10px 12px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Description</th>
                  </tr>
                </thead>
                <tbody>
                  ${companyRequests.map((req, idx) => `
                  <tr style="${idx % 2 === 0 ? 'background: #ffffff;' : 'background: #f9fafb;'}">
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 13px; font-weight: 600;">#${req.id}</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 13px;">${req.employee_name || req.employeeName}</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 13px;">${req.category_name || req.category || '-'}</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 13px;">${req.location || '-'}</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 13px; font-weight: 600; text-align: right;">£${Number(req.amount || 0).toFixed(2)}</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 13px;">${(req.reason || req.description || '-').substring(0, 50)}${(req.reason || req.description || '').length > 50 ? '...' : ''}</td>
                  </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            `;
          }).join('')}
          
          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0 20px 0;">
            <a href="${publicLink}" style="display: inline-block; background: #3B82F6; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">View All Approved Requests</a>
          </div>
          
          <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 13px; text-align: center;">
            Please process these payments and upload payment receipts for each request.
          </p>
          
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 20px; padding: 15px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">This is an automated notification from PocketPro HR.</p>
        </div>
        
      </div>
    </body>
    </html>
  `;
  
  return { subject, html };
}

module.exports = {
  sendEmail,
  buildAdminNewRequestEmail,
  buildUserStatusEmail,
  getTransporter,
  buildPaymentInitiatedEmail,
  buildBulkPaymentEmail,
};

function buildL1ManagerApprovalEmail(request, l1Manager) {
  const urls = getFrontendUrls();
  // Include the request ID as a query param so the L1 manager lands directly
  // on the correct request after logging in via the email link.
  const publicLink = `${urls[0]}/l1-approvals?requestId=${request.id}`;
  const submittedAt = new Date(request.created_at || Date.now()).toLocaleString();

  const subject = `Travel Request #${request.id} - L1 Approval Required`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        
        <!-- Header -->
        <div style="background: #8B5CF6; padding: 30px 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">L1 Approval Required</h1>
        </div>
        
        <!-- Content -->
        <div style="background: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          
          <p style="margin: 0 0 20px 0; color: #374151; font-size: 15px; line-height: 1.5;">
            Dear ${l1Manager.firstName || 'Manager'},
          </p>
          
          <p style="margin: 0 0 20px 0; color: #374151; font-size: 15px; line-height: 1.5;">
            A travel request has been submitted by your team member and requires your approval before it can be sent to admin for final processing.
          </p>
          
          <!-- Request Details Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; background: #f9fafb; border-radius: 6px; overflow: hidden;">
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; width: 140px;">Request ID</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 500;">#${request.id}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Date</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${submittedAt}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Requested By</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${request.employee_name} (${request.employee_email})</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Company</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${request.company_name || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Category</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${request.category_name || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Amount</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 600;">${request.amount} ${request.currency || 'GBP'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; color: #6b7280; font-size: 13px;">Description</td>
              <td style="padding: 12px 16px; color: #111827; font-size: 14px;">${request.reason || '-'}</td>
            </tr>
          </table>
          
          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0 20px 0;">
            <a href="${publicLink}" style="display: inline-block; background: #8B5CF6; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">Review & Approve Request</a>
          </div>
          
          <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 13px; text-align: center;">
            Please review the travel request details and approve or reject it. Once approved, it will be forwarded to admin for final processing.
          </p>
          
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 20px; padding: 15px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">This is an automated notification from PocketPro HR.</p>
        </div>
        
      </div>
    </body>
    </html>
  `;
  
  return { subject, html };
}

function buildL1ApprovalNotificationEmail(request, isApproved) {
  const status = isApproved ? 'Approved' : 'Rejected';
  const subject = `Travel Request #${request.id} - L1 ${status}`;
  
  const urls = getFrontendUrls();
  const publicLink = `${urls[0]}/my-requests`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        
        <!-- Header -->
        <div style="background: ${isApproved ? '#10B981' : '#EF4444'}; padding: 30px 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">L1 Manager ${status}</h1>
        </div>
        
        <!-- Content -->
        <div style="background: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          
          <p style="margin: 0 0 20px 0; color: #374151; font-size: 15px; line-height: 1.5;">
            Your travel request has been ${isApproved ? 'approved by your L1 manager and forwarded to admin for final processing' : 'rejected by your L1 manager'}.
          </p>
          
          <!-- Request Details Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; background: #f9fafb; border-radius: 6px; overflow: hidden;">
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; width: 140px;">Request ID</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 500;">#${request.id}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Status</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 500;">${status}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Company</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${request.company_name || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Category</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${request.category_name || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; ${!isApproved && request.l1_rejection_reason ? 'border-bottom: 1px solid #e5e7eb;' : ''} color: #6b7280; font-size: 13px;">Amount</td>
              <td style="padding: 12px 16px; ${!isApproved && request.l1_rejection_reason ? 'border-bottom: 1px solid #e5e7eb;' : ''} color: #111827; font-size: 14px; font-weight: 600;">${request.amount} ${request.currency || 'GBP'}</td>
            </tr>
            ${!isApproved && request.l1_rejection_reason ? `
            <tr>
              <td style="padding: 12px 16px; color: #6b7280; font-size: 13px;">Reason</td>
              <td style="padding: 12px 16px; color: #111827; font-size: 14px;">${request.l1_rejection_reason}</td>
            </tr>
            ` : ''}
          </table>
          
          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0 20px 0;">
            <a href="${publicLink}" style="display: inline-block; background: #3B82F6; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">View My Requests</a>
          </div>
          
          <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 13px; text-align: center;">
            ${isApproved ? 'Your request is now pending admin approval.' : 'Please contact your manager if you have questions.'}
          </p>
          
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 20px; padding: 15px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">This is an automated notification from PocketPro HR.</p>
        </div>
        
      </div>
    </body>
    </html>
  `;
  
  return { subject, html };
}

module.exports = {
  sendEmail,
  buildAdminNewRequestEmail,
  buildUserStatusEmail,
  getTransporter,
  buildPaymentInitiatedEmail,
  buildBulkPaymentEmail,
  buildL1ManagerApprovalEmail,
  buildL1ApprovalNotificationEmail,
};

