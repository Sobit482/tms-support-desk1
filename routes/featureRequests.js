const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await req.app.get('db').query(`
      SELECT fr.*, u.full_name AS requested_by_name
      FROM feature_requests fr
      LEFT JOIN users u ON fr.requested_by=u.user_id
      ORDER BY CASE fr.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, fr.created_at DESC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load feature requests' });
  }
});

router.post('/', auth, async (req, res) => {
  const { title, description, priority, module: mod } = req.body;
  if (!title || !description)
    return res.status(400).json({ error: 'Title and description are required' });
  if (title.length > 200 || description.length > 5000)
    return res.status(400).json({ error: 'Title max 200 chars, description max 5000 chars' });
  try {
    const { rows } = await req.app.get('db').query(
      `INSERT INTO feature_requests (title, description, priority, module, requested_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING request_id`,
      [title, description, priority || 'medium', mod || null, req.user.userID]
    );
    res.status(201).json({ requestID: rows[0].request_id, message: 'Feature request submitted' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit feature request' });
  }
});

router.patch('/:id/status', auth(['admin']), async (req, res) => {
  const { status, adminNotes, estimatedEffort } = req.body;
  const valid = ['pending','under_review','approved','in_development','completed','rejected'];
  if (!status || !valid.includes(status))
    return res.status(400).json({ error: 'Invalid status' });
  try {
    await req.app.get('db').query(`
      UPDATE feature_requests SET
        status           = $1,
        admin_notes      = COALESCE($2, admin_notes),
        estimated_effort = COALESCE($3, estimated_effort),
        updated_at       = NOW(),
        completed_at     = CASE WHEN $1='completed' THEN NOW() ELSE completed_at END
      WHERE request_id=$4`,
      [status, adminNotes || null, estimatedEffort || null, +req.params.id]
    );
    res.json({ message: 'Feature request updated' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update feature request' });
  }
});

module.exports = router;
