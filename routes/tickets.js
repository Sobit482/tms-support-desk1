const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');

const CATEGORY_FIELDS = {
  'kyc issue':        [{key:'ClientID',label:'Client ID',required:true},{key:'BOID',label:'BOID',required:true}],
  'dp issue':         [{key:'ClientCode',label:'Client Code',required:true},{key:'BOID',label:'BOID',required:true},{key:'Script',label:'Script',required:true},{key:'Quantity',label:'Quantity',required:true}],
  'order issue':      [{key:'Exchange',label:'Exchange',required:true},{key:'OrderID',label:'Order ID',required:true},{key:'BrokerNum',label:'Broker Number',required:true},{key:'Script',label:'Script',required:true},{key:'Quantity',label:'Quantity',required:true}],
  'collateral issue': [{key:'CollateralAmount',label:'Collateral to Release (Amount)',required:true},{key:'ClientCode',label:'Client Code',required:true},{key:'Script',label:'Script / Security',required:false}],
  'payment pending':  [{key:'ClientCode',label:'Client Code',required:true},{key:'Amount',label:'Amount',required:true},{key:'BankRef',label:'Bank Reference',required:false}],
  'deactivation':     [{key:'ClientCode',label:'Client Code',required:true},{key:'BOID',label:'BOID',required:false}],
};

function getCategoryFields(cat) {
  if (!cat) return [];
  return CATEGORY_FIELDS[cat.toLowerCase()] || [];
}

async function generateTicketID(client) {           // ← was (db)
  const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const prefix  = `TKT-${dateStr}-`;
  const { rows } = await client.query(
    `SELECT ticket_id FROM tickets WHERE ticket_id LIKE $1 ORDER BY ticket_id DESC LIMIT 1 FOR UPDATE`,
    [`${prefix}%`]
  );
  const seq = rows.length ? parseInt(rows[0].ticket_id.slice(-3)) + 1 : 1;
  return `${prefix}${String(seq).padStart(3,'0')}`;
}
router.get('/category-fields', auth, (req, res) => {
  res.json(getCategoryFields(req.query.categoryName || ''));
});

router.get('/', auth, async (req, res) => {
  const { brokerID, categoryID, priority, status, dateFrom, dateTo } = req.query;
  try {
    const db = req.app.get('db');
    const params = [];
    let where = 'WHERE 1=1';
    if (brokerID)   { params.push(brokerID);          where += ` AND t.broker_id=$${params.length}`; }
    if (categoryID) { params.push(+categoryID);        where += ` AND t.category_id=$${params.length}`; }
    if (priority)   { params.push(priority);           where += ` AND t.priority=$${params.length}`; }
    if (status)     { params.push(status);             where += ` AND t.status=$${params.length}`; }
    if (dateFrom)   { params.push(new Date(dateFrom)); where += ` AND t.raised_at>=$${params.length}`; }
    if (dateTo)     { params.push(new Date(dateTo));   where += ` AND t.raised_at<=$${params.length}`; }
    const { rows } = await db.query(`
      SELECT t.ticket_id                  AS "TicketID",
             t.heading                    AS "Heading",
             t.priority                   AS "Priority",
             t.status                     AS "Status",
             t.raised_at                  AS "RaisedAt",
             t.sla_breached               AS "SLABreached",
             t.sla_deadline               AS "SLADeadline",
             t.client_account_id          AS "ClientAccountID",
             t.is_rejected                AS "IsRejected",
             t.rejection_reason           AS "RejectionReason",
             EXTRACT(EPOCH FROM (t.sla_deadline - NOW()))/60 AS "SLARemainingMinutes",
             CASE WHEN t.status IN('closed','rejected') THEN 'N/A'
                  WHEN NOW() > t.sla_deadline THEN 'BREACHED'
                  WHEN EXTRACT(EPOCH FROM (t.sla_deadline - NOW()))/60 < 60 THEN 'WARNING'
                  ELSE 'OK' END           AS "SLAStatus",
             b.broker_id                  AS "BrokerID",
             b.broker_name                AS "BrokerName",
             c.category_name              AS "CategoryName",
             s.sub_issue_name             AS "SubIssueName",
             u.full_name                  AS "RaisedBy",
             a.full_name                  AS "AssignedTo"
      FROM tickets t
      LEFT JOIN brokers b ON t.broker_id=b.broker_id
      LEFT JOIN ticket_categories c ON t.category_id=c.category_id
      LEFT JOIN sub_issues s ON t.sub_issue_id=s.sub_issue_id
      LEFT JOIN users u ON t.raised_by_user_id=u.user_id
      LEFT JOIN users a ON t.assigned_to_user_id=a.user_id
      ${where}
      ORDER BY CASE t.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, t.raised_at DESC`,
      params
    );
    res.json(rows);
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Failed to load tickets' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const db = req.app.get('db');
    const id = req.params.id;
    const { rows: tRows } = await db.query(`
      SELECT t.*,
             b.broker_name                AS "BrokerName",
             b.contact_email              AS "BrokerEmail",
             c.category_name              AS "CategoryName",
             c.sla_hours                  AS "SLAHours",
             s.sub_issue_name             AS "SubIssueName",
             u1.full_name                 AS "RaisedBy",
             u2.full_name                 AS "AssignedTo",
             u3.full_name                 AS "ClosedBy",
             u4.full_name                 AS "RejectedByName",
             t.ticket_id                  AS "TicketID",
             t.heading                    AS "Heading",
             t.priority                   AS "Priority",
             t.status                     AS "Status",
             t.raised_at                  AS "RaisedAt",
             t.sla_breached               AS "SLABreached",
             t.sla_deadline               AS "SLADeadline",
             t.client_account_id          AS "ClientAccountID",
             t.last_updated_at            AS "LastUpdatedAt",
             t.resolution_notes           AS "ResolutionNotes",
             EXTRACT(EPOCH FROM (t.sla_deadline - NOW()))/60 AS "SLARemainingMinutes",
             CASE WHEN t.status IN('closed','rejected') THEN 'N/A'
                  WHEN NOW() > t.sla_deadline THEN 'BREACHED'
                  WHEN EXTRACT(EPOCH FROM (t.sla_deadline - NOW()))/60 < 60 THEN 'WARNING'
                  ELSE 'OK' END           AS "SLAStatus"
      FROM tickets t
      LEFT JOIN brokers b ON t.broker_id=b.broker_id
      LEFT JOIN ticket_categories c ON t.category_id=c.category_id
      LEFT JOIN sub_issues s ON t.sub_issue_id=s.sub_issue_id
      LEFT JOIN users u1 ON t.raised_by_user_id=u1.user_id
      LEFT JOIN users u2 ON t.assigned_to_user_id=u2.user_id
      LEFT JOIN users u3 ON t.closed_by_user_id=u3.user_id
      LEFT JOIN users u4 ON t.rejected_by_user_id=u4.user_id
      WHERE t.ticket_id=$1`, [id]
    );
    if (!tRows.length) return res.status(404).json({ error: 'Ticket not found' });
    const ticket = tRows[0];
    const { rows: timeline } = await db.query(`
      SELECT tl.action_type                AS "ActionType",
             tl.action_note               AS "ActionNote",
             tl.action_at                 AS "ActionAt",
             u.full_name                  AS "ActionByName"
      FROM ticket_timeline tl LEFT JOIN users u ON tl.action_by=u.user_id
      WHERE tl.ticket_id=$1 ORDER BY tl.action_at ASC`, [id]
    );
    const { rows: fields } = await db.query(
      `SELECT field_name AS "FieldName", field_value AS "FieldValue"
       FROM ticket_fields WHERE ticket_id=$1 ORDER BY field_id`, [id]
    );
    ticket.timeline      = timeline;
    ticket.dynamicFields = fields;
    res.json(ticket);
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Failed to load ticket' });
  }
});

router.post('/', auth, async (req, res) => {
  const { brokerID, categoryID, subIssueID, priority, heading, remarks,
          clientAccountID, categoryName, dynamicFields = {} } = req.body;
  if (!brokerID || !categoryID || !subIssueID || !priority || !heading || !remarks)
    return res.status(400).json({ error: 'Missing required fields' });
  if (!['low','medium','high','critical'].includes(priority.toLowerCase()))
    return res.status(400).json({ error: 'Invalid priority' });
  if (heading.length < 3 || heading.length > 200)
    return res.status(400).json({ error: 'Heading 3-200 chars' });
  const fieldDefs = getCategoryFields(categoryName || '');
  for (const fd of fieldDefs) {
    if (fd.required && !dynamicFields[fd.key])
      return res.status(400).json({ error: `${fd.label} is required for ${categoryName} tickets` });
  }
  const db = req.app.get('db');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const ticketID = await generateTicketID(client);
    const { rows: catRows } = await client.query(
      `SELECT sla_hours FROM ticket_categories WHERE category_id=$1`, [+categoryID]
    );
    const slaHours = catRows.length ? catRows[0].sla_hours : 24;
    await client.query(`
  INSERT INTO tickets (
    ticket_id, broker_id, category_id, sub_issue_id,
    heading, remarks, client_account_id, priority,
    status, raised_by_user_id, sla_deadline
  ) VALUES ($1::text,$2,$3,$4,$5,$6,$7,$8::text,'open',$9, NOW() + ($10::text || ' hours')::INTERVAL)`,
  [ticketID, brokerID, +categoryID, +subIssueID,
   heading, remarks, clientAccountID || null, priority.toLowerCase(),
   req.user.userID, slaHours]
);
    await client.query(
      `INSERT INTO ticket_timeline (ticket_id, action_by, action_type, action_note) VALUES ($1,$2,'raised','Ticket raised')`,
      [ticketID, req.user.userID]
    );
    for (const [key, value] of Object.entries(dynamicFields)) {
      if (value !== null && value !== undefined && value !== '') {
        await client.query(
          `INSERT INTO ticket_fields (ticket_id, field_name, field_value) VALUES ($1,$2,$3)`,
          [ticketID, key, String(value)]
        );
      }
    }
    await client.query('COMMIT');
    res.status(201).json({ ticketID, message: 'Ticket raised successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e.message);
    res.status(500).json({ error: 'Failed to create ticket' });
  } finally {
    client.release();
  }
});

router.patch('/:id/status', auth, async (req, res) => {
  const { status, note, resolutionNotes } = req.body;
  if (!status || !['open','inprogress','resolved','closed'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });
  const db = req.app.get('db');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    if (status === 'closed') {
      const { rows } = await client.query(`SELECT role FROM users WHERE user_id=$1`, [req.user.userID]);
      if (!rows.length || !['admin','technical'].includes(rows[0].role)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Only admin or technical staff can close tickets' });
      }
    }
   await client.query(`
  UPDATE tickets SET
    status            = $1::text,
    last_updated_at   = NOW(),
    closed_at         = CASE WHEN $1::text='closed' THEN NOW() ELSE closed_at END,
    closed_by_user_id = CASE WHEN $1::text='closed' THEN $2::integer ELSE closed_by_user_id END,
    resolution_notes  = COALESCE($3::text, resolution_notes)
  WHERE ticket_id=$4::text`,
  [status, req.user.userID, resolutionNotes || null, req.params.id]
);
    await client.query(
      `INSERT INTO ticket_timeline (ticket_id, action_by, action_type, action_note) VALUES ($1,$2,$3,$4)`,
      [req.params.id, req.user.userID, status, note || `Status changed to ${status}`]
    );
    await client.query('COMMIT');
    res.json({ message: `Status updated to ${status}` });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.post('/:id/reject', auth(['admin','technical']), async (req, res) => {
  const { reason } = req.body;
  if (!reason || reason.trim().length < 10)
    return res.status(400).json({ error: 'Rejection reason must be at least 10 characters' });
  const db = req.app.get('db');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      UPDATE tickets SET
        status              = 'rejected',
        is_rejected         = true,
        rejected_at         = NOW(),
        rejected_by_user_id = $1,
        rejection_reason    = $2,
        last_updated_at     = NOW()
      WHERE ticket_id=$3`,
      [req.user.userID, reason.trim(), req.params.id]
    );
    await client.query(
      `INSERT INTO ticket_timeline (ticket_id, action_by, action_type, action_note) VALUES ($1,$2,'rejected',$3)`,
      [req.params.id, req.user.userID, reason.trim()]
    );
    await client.query('COMMIT');
    res.json({ message: 'Ticket rejected.' });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.patch('/:id/assign', auth(['admin','technical']), async (req, res) => {
  const { assignedToUserID } = req.body;
  if (!assignedToUserID) return res.status(400).json({ error: 'assignedToUserID required' });
  const db = req.app.get('db');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE tickets SET assigned_to_user_id=$1, last_updated_at=NOW() WHERE ticket_id=$2`,
      [+assignedToUserID, req.params.id]
    );
    await client.query(
      `INSERT INTO ticket_timeline (ticket_id, action_by, action_type, action_note) VALUES ($1,$2,'assigned','Ticket assigned to agent')`,
      [req.params.id, req.user.userID]
    );
    await client.query('COMMIT');
    res.json({ message: 'Ticket assigned successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.delete('/:id', auth(['admin']), async (req, res) => {
  const db = req.app.get('db');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT ticket_id FROM tickets WHERE ticket_id=$1`, [req.params.id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ticket not found' });
    }
    await client.query(`DELETE FROM ticket_fields   WHERE ticket_id=$1`, [req.params.id]);
    await client.query(`DELETE FROM ticket_timeline WHERE ticket_id=$1`, [req.params.id]);
    await client.query(`DELETE FROM tickets          WHERE ticket_id=$1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({ message: 'Ticket deleted successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;