const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');

router.get('/broker-summary', auth, async (req, res) => {
  try {
    const { rows } = await req.app.get('db').query(`
      SELECT b.broker_id, b.broker_name, b.contact_person,
        COUNT(t.ticket_id) AS total_tickets,
        SUM(CASE WHEN t.status='open'       THEN 1 ELSE 0 END) AS open_tickets,
        SUM(CASE WHEN t.status='inprogress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN t.status IN('resolved','closed') THEN 1 ELSE 0 END) AS resolved,
        SUM(CASE WHEN t.status='rejected'   THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN t.priority='critical' THEN 1 ELSE 0 END) AS critical_tickets,
        SUM(CASE WHEN t.sla_breached=true   THEN 1 ELSE 0 END) AS sla_breached,
        AVG(CASE WHEN t.closed_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (t.closed_at - t.raised_at))/60 ELSE NULL END) AS avg_resolution_minutes
      FROM brokers b LEFT JOIN tickets t ON b.broker_id=t.broker_id
      WHERE b.is_active=true
      GROUP BY b.broker_id, b.broker_name, b.contact_person
      ORDER BY total_tickets DESC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load broker report' });
  }
});

router.get('/date-range', auth, async (req, res) => {
  const { dateFrom, dateTo, categoryName, brokerID } = req.query;
  if (!dateFrom || !dateTo) return res.status(400).json({ error: 'dateFrom and dateTo required' });
  try {
    const db = req.app.get('db');
    const params = [new Date(dateFrom), new Date(new Date(dateTo).setHours(23,59,59,999))];
    let catFilter = '', brokerFilter = '';
    if (categoryName) { params.push(categoryName); catFilter   = ` AND c.category_name=$${params.length}`; }
    if (brokerID)     { params.push(brokerID);     brokerFilter = ` AND t.broker_id=$${params.length}`; }
    const { rows: tickets } = await db.query(`
      SELECT t.ticket_id, t.heading, t.priority, t.status, t.raised_at,
             t.sla_breached, t.client_account_id, t.is_rejected, t.rejection_reason,
             b.broker_name, c.category_name, s.sub_issue_name,
             u.full_name AS raised_by, a.full_name AS assigned_to, t.resolution_notes
      FROM tickets t
      LEFT JOIN brokers b ON t.broker_id=b.broker_id
      LEFT JOIN ticket_categories c ON t.category_id=c.category_id
      LEFT JOIN sub_issues s ON t.sub_issue_id=s.sub_issue_id
      LEFT JOIN users u ON t.raised_by_user_id=u.user_id
      LEFT JOIN users a ON t.assigned_to_user_id=a.user_id
      WHERE t.raised_at BETWEEN $1 AND $2 ${catFilter} ${brokerFilter}
      ORDER BY t.raised_at DESC`, params
    );
    let fieldMap = {};
    if (tickets.length) {
      const tids = tickets.map(t => t.ticket_id);
      const { rows: fRows } = await db.query(
        `SELECT ticket_id, field_name, field_value FROM ticket_fields WHERE ticket_id = ANY($1)`, [tids]
      );
      fRows.forEach(f => {
        if (!fieldMap[f.ticket_id]) fieldMap[f.ticket_id] = {};
        fieldMap[f.ticket_id][f.field_name] = f.field_value;
      });
    }
    const enriched = tickets.map(t => ({ ...t, fields: fieldMap[t.ticket_id] || {} }));
    const stats = {
      total:      enriched.length,
      open:       enriched.filter(t => t.status==='open').length,
      inProgress: enriched.filter(t => t.status==='inprogress').length,
      resolved:   enriched.filter(t => t.status==='resolved').length,
      closed:     enriched.filter(t => t.status==='closed').length,
      rejected:   enriched.filter(t => t.status==='rejected').length,
      slaBreached:enriched.filter(t => t.sla_breached).length,
      critical:   enriched.filter(t => t.priority==='critical').length,
      high:       enriched.filter(t => t.priority==='high').length,
    };
    const catBreakdown = {};
    enriched.forEach(t => { catBreakdown[t.category_name] = (catBreakdown[t.category_name]||0)+1; });
    res.json({ tickets: enriched, stats, catBreakdown, dateFrom, dateTo });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Failed to load date-range report' });
  }
});

router.get('/weekly', auth, async (req, res) => {
  try {
    const { rows } = await req.app.get('db').query(`
      SELECT DATE_TRUNC('day', raised_at) AS day,
        COUNT(*) AS total,
        SUM(CASE WHEN priority='critical' THEN 1 ELSE 0 END) AS critical,
        SUM(CASE WHEN status IN('resolved','closed') THEN 1 ELSE 0 END) AS resolved
      FROM tickets WHERE raised_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE_TRUNC('day', raised_at) ORDER BY day`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load weekly report' });
  }
});

router.get('/dashboard', auth, async (req, res) => {
  try {
    const { rows } = await req.app.get('db').query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status='open'       THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN status='inprogress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status='resolved'   THEN 1 ELSE 0 END) AS resolved,
        SUM(CASE WHEN status='closed'     THEN 1 ELSE 0 END) AS closed,
        SUM(CASE WHEN status='rejected'   THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN sla_breached=true   THEN 1 ELSE 0 END) AS sla_breached,
        SUM(CASE WHEN priority='critical' THEN 1 ELSE 0 END) AS critical
      FROM tickets`
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

module.exports = router;
