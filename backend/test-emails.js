/**
 * Email Template Testing Script
 * 
 * This script tests all three email templates with sample data
 * Sends emails only to: priyal.makwana@acornuniversalconsultancy.com
 * 
 * Usage: node test-emails.js
 */

require('dotenv').config();
const { sendEmail, buildAdminNewRequestEmail, buildUserStatusEmail, buildPaymentInitiatedEmail, buildBulkPaymentEmail } = require('./src/utils/mailer');
const fs = require('fs');
const path = require('path');

const TEST_EMAIL = 'priyal.makwana@acornuniversalconsultancy.com';

// Create sample attachment files for testing
function createSampleAttachments() {
  const attachments = [];
  
  // Sample PDF content (minimal valid PDF)
  const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Test Receipt) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000317 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n410\n%%EOF');
  
  attachments.push({
    filename: 'test-receipt.pdf',
    content: pdfContent,
    contentType: 'application/pdf'
  });
  
  // Sample image content (1x1 PNG)
  const pngContent = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  
  attachments.push({
    filename: 'test-invoice.png',
    content: pngContent,
    contentType: 'image/png'
  });
  
  return attachments;
}

// Sample data for testing
const sampleRequest = {
  id: 12345,
  employee_name: 'John Doe',
  employee_email: 'john.doe@example.com',
  company_name: 'Jambo Suppliers Ltd',
  category_name: 'Events',
  amount: '£10.00',
  currency: 'GBP',
  reason: 'Team lunch meeting with clients to discuss Q1 strategy',
  created_at: new Date().toISOString(),
  status: 'pending'
};

const sampleApprovedRequest = {
  ...sampleRequest,
  id: 12346,
  status: 'approved',
  amount: '£25.50'
};

const sampleRejectedRequest = {
  ...sampleRequest,
  id: 12347,
  status: 'rejected',
  amount: '£150.00',
  rejection_reason: 'Missing receipt attachment. Please resubmit with proper documentation.'
};

const samplePaymentRequest = {
  ...sampleRequest,
  id: 12348,
  status: 'approved',
  amount: '£75.00',
  company_name: 'Docpharm GmbH',
  category_name: 'Travel',
  location: 'ITC',
  attachments: '1760373156141-787096845-IMG_9479.jpeg,1760525025003-940185322-receipt.pdf',
  reason: 'Train tickets for client meeting in Frankfurt'
};

const sampleIntercompanyRequest = {
  ...samplePaymentRequest,
  id: 12349,
  previousCompany: 'Lifexa BV',
  company_name: 'Docpharm GmbH',
  amount: '£120.00',
  location: 'ITC',
  attachments: '1760373156141-787096845-hotel-receipt.pdf',
  reason: 'Hotel accommodation for conference (transferred from Lifexa BV to Docpharm GmbH)'
};

async function testEmail1_NewRequest() {
  console.log('\n📧 Test 1: New Request Email (Admin Notification) WITH ATTACHMENTS');
  console.log('─'.repeat(60));
  
  try {
    const { subject, html } = buildAdminNewRequestEmail(sampleRequest);
    const attachments = createSampleAttachments();
    
    console.log('Subject:', subject);
    console.log('Sending to:', TEST_EMAIL);
    console.log('Attachments:', attachments.length, 'files');
    
    const result = await sendEmail({
      to: TEST_EMAIL,
      subject: `[TEST] ${subject}`,
      html,
      replyTo: sampleRequest.employee_email,
      attachments: attachments
    });
    
    console.log('✅ Email sent successfully with attachments!');
    console.log('Message ID:', result.messageId);
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
  }
}

async function testEmail2_ApprovedStatus() {
  console.log('\n📧 Test 2: Approved Status Email (User Notification)');
  console.log('─'.repeat(60));
  
  try {
    const { subject, html } = buildUserStatusEmail(sampleApprovedRequest);
    
    console.log('Subject:', subject);
    console.log('Sending to:', TEST_EMAIL);
    
    const result = await sendEmail({
      to: TEST_EMAIL,
      subject: `[TEST] ${subject}`,
      html
    });
    
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', result.messageId);
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
  }
}

async function testEmail3_RejectedStatus() {
  console.log('\n📧 Test 3: Rejected Status Email (User Notification)');
  console.log('─'.repeat(60));
  
  try {
    const { subject, html } = buildUserStatusEmail(sampleRejectedRequest);
    
    console.log('Subject:', subject);
    console.log('Sending to:', TEST_EMAIL);
    
    const result = await sendEmail({
      to: TEST_EMAIL,
      subject: `[TEST] ${subject}`,
      html
    });
    
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', result.messageId);
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
  }
}

async function testEmail4_PaymentInitiated() {
  console.log('\n📧 Test 4: Payment Initiated Email (Normal Payment) WITH ATTACHMENTS');
  console.log('─'.repeat(60));
  
  try {
    const attachments = createSampleAttachments();
    
    const { subject, html } = buildPaymentInitiatedEmail({
      request: samplePaymentRequest,
      payment: {
        method: 'Bank Transfer',
        reference: 'TXN-2026-001234',
        paidAmount: '£75.00',
        paidDate: new Date().toISOString(),
        notes: 'Payment processed via HSBC business account',
        processedBy: 'admin@acornuniversalconsultancy.com'
      }
    });
    
    console.log('Subject:', subject);
    console.log('Sending to:', TEST_EMAIL);
    console.log('Attachments:', attachments.length, 'files');
    
    const result = await sendEmail({
      to: TEST_EMAIL,
      subject: `[TEST] ${subject}`,
      html,
      attachments: attachments
    });
    
    console.log('✅ Email sent successfully with attachments!');
    console.log('Message ID:', result.messageId);
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
  }
}

async function testEmail5_IntercompanyPayment() {
  console.log('\n📧 Test 5: Payment Initiated Email (Intercompany Transfer) WITH ATTACHMENTS');
  console.log('─'.repeat(60));
  
  try {
    const attachments = createSampleAttachments();
    
    const { subject, html } = buildPaymentInitiatedEmail({
      request: sampleIntercompanyRequest,
      payment: {
        method: 'Bank Transfer',
        reference: 'TXN-2026-001235',
        paidAmount: '£120.00',
        paidDate: new Date().toISOString(),
        notes: 'Intercompany transfer - original company: Lifexa BV, new company: Docpharm GmbH',
        processedBy: 'admin@acornuniversalconsultancy.com',
        receiptAttachments: attachments
      }
    });
    
    console.log('Subject:', subject);
    console.log('Sending to:', TEST_EMAIL);
    console.log('Attachments:', attachments.length, 'files');
    
    const result = await sendEmail({
      to: TEST_EMAIL,
      subject: `[TEST] ${subject}`,
      html,
      attachments: attachments
    });
    
    console.log('✅ Email sent successfully with attachments!');
    console.log('Message ID:', result.messageId);
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
  }
}

async function testEmail6_BulkPayment() {
  console.log('\n📧 Test 6: Bulk Payment Email (Multiple Requests)');
  console.log('─'.repeat(60));
  
  try {
    const bulkRequests = [
      {
        id: 12350,
        employee_name: 'John Doe',
        employee_email: 'john.doe@example.com',
        company_name: 'Docpharm GmbH',
        category_name: 'Travel',
        location: 'ITC',
        amount: 75.00,
        currency: 'GBP',
        reason: 'Train tickets for client meeting in Frankfurt'
      },
      {
        id: 12351,
        employee_name: 'Jane Smith',
        employee_email: 'jane.smith@example.com',
        company_name: 'Docpharm GmbH',
        category_name: 'Events',
        location: 'ITC',
        amount: 120.50,
        currency: 'GBP',
        reason: 'Team lunch with clients'
      },
      {
        id: 12352,
        employee_name: 'Mike Johnson',
        employee_email: 'mike.johnson@example.com',
        company_name: 'Lifexa BV',
        category_name: 'Office Supplies',
        location: 'Amsterdam Office',
        amount: 45.00,
        currency: 'GBP',
        reason: 'Printer paper and stationery'
      },
      {
        id: 12353,
        employee_name: 'Sarah Williams',
        employee_email: 'sarah.williams@example.com',
        company_name: 'Lifexa BV',
        category_name: 'Travel',
        location: 'Amsterdam Office',
        amount: 200.00,
        currency: 'GBP',
        reason: 'Hotel accommodation for conference'
      }
    ];
    
    const groupedByCompany = bulkRequests.reduce((acc, req) => {
      const company = req.company_name || 'Unknown';
      if (!acc[company]) {
        acc[company] = [];
      }
      acc[company].push(req);
      return acc;
    }, {});
    
    const { subject, html } = buildBulkPaymentEmail({
      requests: bulkRequests,
      groupedByCompany
    });
    
    console.log('Subject:', subject);
    console.log('Sending to:', TEST_EMAIL);
    console.log('Total Requests:', bulkRequests.length);
    console.log('Companies:', Object.keys(groupedByCompany).join(', '));
    
    const result = await sendEmail({
      to: TEST_EMAIL,
      subject: `[TEST] ${subject}`,
      html
    });
    
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', result.messageId);
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
  }
}

async function runAllTests() {
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  PETTY CASH EMAIL TEMPLATE TESTING');
  console.log('═'.repeat(60));
  console.log('Test recipient:', TEST_EMAIL);
  console.log('SMTP Host:', process.env.SMTP_HOST);
  console.log('SMTP User:', process.env.SMTP_USER);
  console.log('═'.repeat(60));
  
  // Add delay between emails to avoid rate limiting
  await testEmail1_NewRequest();
  await delay(2000);
  
  await testEmail2_ApprovedStatus();
  await delay(2000);
  
  await testEmail3_RejectedStatus();
  await delay(2000);
  
  await testEmail4_PaymentInitiated();
  await delay(2000);
  
  await testEmail5_IntercompanyPayment();
  await delay(2000);
  
  await testEmail6_BulkPayment();
  
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  ALL TESTS COMPLETED');
  console.log('═'.repeat(60));
  console.log('✅ Check your inbox:', TEST_EMAIL);
  console.log('📧 You should receive 6 test emails');
  console.log('⚠️  Check spam folder if emails not in inbox');
  console.log('═'.repeat(60));
  console.log('\n');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run all tests
runAllTests()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
