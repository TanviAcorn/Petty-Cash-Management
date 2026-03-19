/**
 * Test script to proceed request #212 to payment
 * This will send payment email to priyal.makwana@acornuniversalconsultancy.com
 */

require('dotenv').config();
const sql = require('mssql');
const { poolPromise } = require('./src/config/db');
const { sendEmail, buildPaymentInitiatedEmail } = require('./src/utils/mailer');
const fs = require('fs');
const path = require('path');

const REQUEST_ID = 212;
const TEST_EMAIL = 'priyal.makwana@acornuniversalconsultancy.com';

async function proceedToPayment() {
  console.log('\n📋 Processing Request #212 to Payment');
  console.log('─'.repeat(60));
  
  try {
    const pool = await poolPromise;
    
    // 1. Fetch the request details
    console.log('Fetching request details...');
    const requestResult = await pool.request()
      .input('id', sql.Int, REQUEST_ID)
      .query('SELECT * FROM petty_cash_requests WHERE id = @id');
    
    const request = requestResult.recordset[0];
    
    if (!request) {
      console.error('❌ Request not found!');
      return;
    }
    
    console.log('✅ Request found:', {
      id: request.id,
      employee: request.employee_name,
      company: request.company_name,
      amount: request.amount,
      currency: request.currency,
      status: request.status
    });
    
    if (request.status !== 'approved' && request.status !== 'intercompany') {
      console.error('❌ Request is not approved! Current status:', request.status);
      return;
    }
    
    // 2. Check if payment record already exists
    const existingPayment = await pool.request()
      .input('requestId', sql.Int, REQUEST_ID)
      .query('SELECT * FROM petty_cash_payments WHERE request_id = @requestId');
    
    if (existingPayment.recordset.length > 0) {
      console.log('⚠️  Payment record already exists. Deleting old record...');
      await pool.request()
        .input('requestId', sql.Int, REQUEST_ID)
        .query('DELETE FROM petty_cash_payments WHERE request_id = @requestId');
    }
    
    // 3. Create payment record
    console.log('Creating payment record...');
    const paymentData = {
      method: 'Bank Transfer',
      reference: 'TEST-TXN-' + Date.now(),
      paidAmount: request.amount,
      paidDate: new Date().toISOString(),
      notes: 'Test payment initiated for flow verification',
      adminEmail: TEST_EMAIL
    };
    
    await pool.request()
      .input('requestId', sql.Int, REQUEST_ID)
      .input('method', sql.NVarChar(100), paymentData.method)
      .input('reference', sql.NVarChar(200), paymentData.reference)
      .input('paidAmount', sql.Decimal(18,2), Number(paymentData.paidAmount))
      .input('paidDate', sql.DateTime2, new Date(paymentData.paidDate))
      .input('notes', sql.NVarChar(sql.MAX), paymentData.notes)
      .input('adminEmail', sql.NVarChar(320), paymentData.adminEmail)
      .query(`
        INSERT INTO petty_cash_payments 
          (request_id, method, reference, paid_amount, paid_date, notes, status, created_by_email, sent_to_payment)
        VALUES 
          (@requestId, @method, @reference, @paidAmount, @paidDate, @notes, 'processed', @adminEmail, 1);
        
        UPDATE petty_cash_requests 
        SET status = 'processed'
        WHERE id = @requestId;
      `);
    
    console.log('✅ Payment record created');
    
    // 4. Prepare attachments from request
    const emailAttachments = [];
    if (request.attachments) {
      try {
        const attachmentList = JSON.parse(request.attachments);
        console.log(`Found ${attachmentList.length} attachment(s) in request`);
        
        for (const attachment of attachmentList) {
          try {
            const filePath = path.join(__dirname, 'uploads', attachment.filename);
            if (fs.existsSync(filePath)) {
              const fileContent = fs.readFileSync(filePath);
              emailAttachments.push({
                filename: attachment.originalName || attachment.filename,
                content: fileContent,
                contentType: attachment.mimetype || 'application/octet-stream'
              });
              console.log(`  ✅ Attached: ${attachment.originalName || attachment.filename}`);
            } else {
              console.log(`  ⚠️  File not found: ${attachment.filename}`);
            }
          } catch (err) {
            console.error(`  ❌ Error reading file ${attachment.filename}:`, err.message);
          }
        }
      } catch (err) {
        console.error('Error parsing attachments:', err.message);
      }
    }
    
    // 5. Build and send email
    console.log('\nSending payment email...');
    const { subject, html } = buildPaymentInitiatedEmail({
      request: request,
      payment: paymentData
    });
    
    await sendEmail({
      to: TEST_EMAIL,
      cc: 'ishika.gupta@astutehealthcare.co.uk',
      subject: `[TEST] ${subject}`,
      html,
      attachments: emailAttachments,
      user: {
        firstName: 'Payment',
        lastName: 'System',
        email: process.env.FROM_EMAIL || process.env.SMTP_USER
      }
    });
    
    console.log('✅ Payment email sent successfully!');
    console.log('\n📧 Email Details:');
    console.log('  To:', TEST_EMAIL);
    console.log('  CC: ishika.gupta@astutehealthcare.co.uk');
    console.log('  Subject:', subject);
    console.log('  Attachments:', emailAttachments.length);
    console.log('\n🔗 Upload Receipt Link:');
    console.log(`  http://103.206.209.210:5176/requests/${REQUEST_ID}/upload-receipt`);
    console.log('\n✅ Request #212 has been processed to payment!');
    console.log('─'.repeat(60));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

proceedToPayment();
