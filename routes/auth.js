const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const nodemailer = require('nodemailer');
const auth    = require('../middleware/auth');

const SECRET = process.env.JWT_SECRET || 'supportdesk_secret_change_in_production';

// In-memory reset tokens (use DB in production for persistence)
const resetTokens = new Map();

function getMailer() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.office365.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { ciphers: 'SSLv3' }
  });
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });
  if (email.length > 150 || password.length > 100)
    return res.status(400).json({ error: 'Invalid credentials format' });
  try {
    const db = req.app.get('db');
    const { rows } = await db.query(
      `SELECT user_id, full_name, email, role, password_hash
       FROM users WHERE email = $1 AND is_active = true`,
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { userID: user.user_id, name: user.full_name, role: user.role },
      SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
    res.json({ token, user: { name: user.full_name, role: user.role, email: user.email } });
  } catch (e) {
    console.error('Login error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const db = req.app.get('db');
    const { rows } = await db.query(
      `SELECT user_id, full_name, email FROM users WHERE email = $1 AND is_active = true`, [email]
    );
    // Always return success to prevent email enumeration
    if (!rows.length) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const user  = rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 60 * 60 * 1000; // 1 hour
    resetTokens.set(token, { userID: user.user_id, email: user.email, expiry });

    const appUrl = process.env.APP_URL || 'https://tms-support-desk1-production.up.railway.app';
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    const mailer = getMailer();
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: 'TMS Support Desk — Password Reset',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#3b82f6">Password Reset Request</h2>
          <p>Hello ${user.full_name},</p>
          <p>Click the button below to reset your password. This link expires in 1 hour.</p>
          <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Reset Password</a>
          <p style="color:#888;font-size:12px">If you didn't request this, ignore this email.</p>
        </div>`
    });

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (e) {
    console.error('Forgot password error:', e.message);
    res.status(500).json({ error: 'Failed to send reset email. Please contact admin.' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 8)
    return res.status(400).json({ error: 'Token and new password (min 8 chars) required' });
  const record = resetTokens.get(token);
  if (!record || record.expiry < Date.now())
    return res.status(400).json({ error: 'Reset link is invalid or expired' });
  try {
    const db = req.app.get('db');
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query(`UPDATE users SET password_hash=$1 WHERE user_id=$2`, [hash, record.userID]);
    resetTokens.delete(token);
    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
