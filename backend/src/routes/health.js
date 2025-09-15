const express = require('express');
const router = express.Router();
const { getTransporter } = require('../utils/mailer');
const { sendEmail } = require('../utils/mailer');

// Verify SMTP connection and auth
router.get('/smtp-verify', async (req, res) => {
  try {
    const tx = getTransporter();
    await tx.verify();
    res.json({ ok: true, message: 'SMTP connection/auth verified' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Send a test email to the specified recipient
router.post('/smtp-test', async (req, res) => {
  try {
    const to = req.body?.to || process.env.ADMIN_EMAIL;
    if (!to) return res.status(400).json({ ok: false, error: 'Missing recipient (to) and ADMIN_EMAIL not set' });
    const info = await sendEmail({
      to,
      subject: 'Petty Cash SMTP test',
      html: '<p>This is a test email from Petty Cash backend.</p>'
    });
    res.json({ ok: true, messageId: info.messageId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
