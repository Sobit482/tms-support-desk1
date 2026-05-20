const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const auth    = require('../middleware/auth');

const SECRET = process.env.JWT_SECRET || 'supportdesk_secret_change_in_production';

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

router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
