const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const auth    = require('../middleware/auth');

router.get('/', auth(['admin']), async (req, res) => {
  try {
    const { rows } = await req.app.get('db').query(
      `SELECT user_id    AS "UserID",
              full_name  AS "FullName",
              email      AS "Email",
              role       AS "Role",
              is_active  AS "IsActive",
              created_at AS "CreatedAt"
       FROM users ORDER BY full_name`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load users' });
  }
});

router.get('/agents', auth, async (req, res) => {
  try {
    const { rows } = await req.app.get('db').query(
      `SELECT user_id   AS "UserID",
              full_name AS "FullName",
              role      AS "Role"
       FROM users WHERE role IN ('support','technical') AND is_active = true ORDER BY full_name`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load agents' });
  }
});

router.post('/', auth(['admin']), async (req, res) => {
  const { fullName, email, password, role } = req.body;
  if (!fullName || !email || !password || !role)
    return res.status(400).json({ error: 'fullName, email, password and role are required' });
  if (!['support','technical','admin'].includes(role))
    return res.status(400).json({ error: 'Role must be one of: support, technical, admin' });
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await req.app.get('db').query(
      `INSERT INTO users (full_name, email, password_hash, role) VALUES ($1,$2,$3,$4)`,
      [fullName, email, passwordHash, role]
    );
    res.status(201).json({ message: 'User created successfully' });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.patch('/:id/password', auth, async (req, res) => {
  const targetID = +req.params.id;
  if (req.user.userID !== targetID && req.user.role !== 'admin')
    return res.status(403).json({ error: "Not allowed to change another user's password" });
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  try {
    const db = req.app.get('db');
    const { rows } = await db.query(`SELECT password_hash FROM users WHERE user_id=$1`, [targetID]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    if (req.user.role !== 'admin') {
      if (!currentPassword) return res.status(400).json({ error: 'currentPassword is required' });
      const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query(`UPDATE users SET password_hash=$1 WHERE user_id=$2`, [newHash, targetID]);
    res.json({ message: 'Password updated successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update password' });
  }
});

router.patch('/:id/toggle', auth(['admin']), async (req, res) => {
  try {
    await req.app.get('db').query(
      `UPDATE users SET is_active = NOT is_active WHERE user_id=$1`, [+req.params.id]
    );
    res.json({ message: 'User status toggled' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to toggle user status' });
  }
});

module.exports = router;
