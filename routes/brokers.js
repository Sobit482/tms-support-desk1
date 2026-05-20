const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await req.app.get('db').query(
      `SELECT broker_id      AS "BrokerID",
              broker_name    AS "BrokerName",
              contact_person AS "ContactPerson",
              contact_email  AS "ContactEmail",
              contact_phone  AS "ContactPhone"
       FROM brokers WHERE is_active = true ORDER BY broker_name`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load brokers' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await req.app.get('db').query(
      `SELECT broker_id      AS "BrokerID",
              broker_name    AS "BrokerName",
              contact_person AS "ContactPerson",
              contact_email  AS "ContactEmail",
              contact_phone  AS "ContactPhone",
              is_active      AS "IsActive"
       FROM brokers WHERE broker_id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Broker not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load broker' });
  }
});

module.exports = router;
