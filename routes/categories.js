const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const db = req.app.get('db');
    const { rows: cats } = await db.query(
      `SELECT category_id   AS "CategoryID",
              category_name AS "CategoryName",
              sla_hours     AS "SLAHours"
       FROM ticket_categories WHERE is_active = true ORDER BY category_name`
    );
    const { rows: subs } = await db.query(
      `SELECT sub_issue_id   AS "SubIssueID",
              category_id    AS "CategoryID",
              sub_issue_name AS "SubIssueName"
       FROM sub_issues WHERE is_active = true ORDER BY sub_issue_name`
    );
    res.json({ categories: cats, subIssues: subs });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

router.get('/:id/subissues', auth, async (req, res) => {
  try {
    const { rows } = await req.app.get('db').query(
      `SELECT sub_issue_id   AS "SubIssueID",
              sub_issue_name AS "SubIssueName"
       FROM sub_issues WHERE category_id = $1 AND is_active = true ORDER BY sub_issue_name`,
      [+req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load sub-issues' });
  }
});

module.exports = router;
