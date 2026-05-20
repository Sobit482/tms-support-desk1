const express     = require('express');
const router      = express.Router();
const auth        = require('../middleware/auth');
const ExcelJS     = require('exceljs');
const PDFDocument = require('pdfkit');

async function fetchTickets(db) {
  const { rows } = await db.query(`
    SELECT t.ticket_id, t.heading, t.priority, t.status, t.raised_at,
           t.sla_breached, t.sla_deadline, t.client_account_id,
           b.broker_name, c.category_name, s.sub_issue_name,
           u.full_name AS raised_by, a.full_name AS assigned_to, t.resolution_notes
    FROM tickets t
    LEFT JOIN brokers b ON t.broker_id=b.broker_id
    LEFT JOIN ticket_categories c ON t.category_id=c.category_id
    LEFT JOIN sub_issues s ON t.sub_issue_id=s.sub_issue_id
    LEFT JOIN users u ON t.raised_by_user_id=u.user_id
    LEFT JOIN users a ON t.assigned_to_user_id=a.user_id
    ORDER BY t.raised_at DESC`
  );
  return rows;
}

router.get('/excel', auth, async (req, res) => {
  try {
    const tickets  = await fetchTickets(req.app.get('db'));
    const workbook = new ExcelJS.Workbook();
    const ws       = workbook.addWorksheet('Support Tickets');
    const headerFill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF1E2333'} };
    const headerFont = { bold:true, color:{argb:'FFE8EAF2'}, size:11 };
    ws.columns = [
      { header:'Ticket ID',        key:'ticket_id',        width:18 },
      { header:'Heading',          key:'heading',          width:35 },
      { header:'Broker',           key:'broker_name',      width:22 },
      { header:'Category',         key:'category_name',    width:18 },
      { header:'Sub Issue',        key:'sub_issue_name',   width:25 },
      { header:'Client Account',   key:'client_account_id',width:16 },
      { header:'Priority',         key:'priority',         width:12 },
      { header:'Status',           key:'status',           width:14 },
      { header:'Raised At',        key:'raised_at',        width:20 },
      { header:'SLA Deadline',     key:'sla_deadline',     width:20 },
      { header:'SLA Breached',     key:'sla_breached',     width:13 },
      { header:'Raised By',        key:'raised_by',        width:18 },
      { header:'Assigned To',      key:'assigned_to',      width:18 },
      { header:'Resolution Notes', key:'resolution_notes', width:40 },
    ];
    ws.getRow(1).eachCell(cell => {
      cell.fill = headerFill; cell.font = headerFont;
      cell.border = { bottom:{style:'thin',color:{argb:'FF5E72EB'}} };
      cell.alignment = { vertical:'middle' };
    });
    const priColours = { critical:'FFA78BFA', high:'FFF05C6E', medium:'FFF5A623', low:'FF22D3A0' };
    tickets.forEach((t, idx) => {
      const row = ws.addRow({
        ...t,
        raised_at:    t.raised_at    ? new Date(t.raised_at)    : null,
        sla_deadline: t.sla_deadline ? new Date(t.sla_deadline) : null,
        sla_breached: t.sla_breached ? 'YES' : 'NO',
      });
      if (idx % 2 === 1)
        row.eachCell(cell => cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF12151E'} });
      const priCell = row.getCell('priority');
      if (priColours[t.priority]) priCell.font = { color:{argb:priColours[t.priority]}, bold:true };
    });
    ws.views = [{ state:'frozen', ySplit:1 }];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="tickets_${new Date().toISOString().split('T')[0]}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error('GET /export/excel error:', e.message);
    res.status(500).json({ error: 'Failed to export Excel' });
  }
});

router.get('/pdf', auth, async (req, res) => {
  try {
    const tickets = await fetchTickets(req.app.get('db'));
    const doc = new PDFDocument({ margin:40, size:'A4', layout:'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="tickets_${new Date().toISOString().split('T')[0]}.pdf"`);
    doc.pipe(res);
    doc.fontSize(20).font('Helvetica-Bold').text('TMS Support Desk — Ticket Report', { align:'center' });
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString('en-IN')}`, { align:'center' });
    doc.moveDown(0.8);
    const stats = {
      total:      tickets.length,
      open:       tickets.filter(t => t.status==='open').length,
      inProgress: tickets.filter(t => t.status==='inprogress').length,
      resolved:   tickets.filter(t => t.status==='resolved').length,
      closed:     tickets.filter(t => t.status==='closed').length,
      breached:   tickets.filter(t => t.sla_breached).length,
      critical:   tickets.filter(t => t.priority==='critical').length,
    };
    doc.fontSize(11).font('Helvetica-Bold').text('Summary', { underline:true });
    doc.fontSize(10).font('Helvetica')
       .text(`Total Tickets : ${stats.total}`)
       .text(`Open: ${stats.open}  |  In Progress: ${stats.inProgress}  |  Resolved: ${stats.resolved}  |  Closed: ${stats.closed}`)
       .text(`SLA Breached: ${stats.breached}  |  Critical: ${stats.critical}`);
    doc.moveDown(1);
    const cols = [
      { label:'Ticket ID', x:40,  w:90  },
      { label:'Broker',    x:135, w:110 },
      { label:'Category',  x:250, w:100 },
      { label:'Priority',  x:355, w:65  },
      { label:'Status',    x:425, w:75  },
      { label:'SLA',       x:505, w:50  },
      { label:'Raised At', x:560, w:90  },
    ];
    const drawLine = (y) => doc.moveTo(40, y).lineTo(790, y).lineWidth(0.3).stroke('#cccccc');
    doc.fontSize(9).font('Helvetica-Bold');
    const hY = doc.y;
    cols.forEach(c => doc.text(c.label, c.x, hY, { width:c.w }));
    drawLine(hY + 14); doc.y = hY + 18;
    doc.font('Helvetica').fontSize(8);
    tickets.forEach(t => {
      if (doc.y > 520) {
        doc.addPage({ layout:'landscape' });
        doc.font('Helvetica-Bold').fontSize(9);
        const rhY = doc.y;
        cols.forEach(c => doc.text(c.label, c.x, rhY, { width:c.w }));
        drawLine(rhY + 14); doc.y = rhY + 18;
        doc.font('Helvetica').fontSize(8);
      }
      const rY = doc.y;
      const raisedStr = t.raised_at ? new Date(t.raised_at).toLocaleDateString('en-IN') : '—';
      doc.text(t.ticket_id || '—',                    cols[0].x, rY, { width:cols[0].w });
      doc.text(t.broker_name || '—',                  cols[1].x, rY, { width:cols[1].w });
      doc.text(t.category_name || '—',                cols[2].x, rY, { width:cols[2].w });
      doc.text((t.priority||'').toUpperCase(),         cols[3].x, rY, { width:cols[3].w });
      doc.text(t.status || '—',                       cols[4].x, rY, { width:cols[4].w });
      doc.text(t.sla_breached ? 'BREACHED' : 'OK',    cols[5].x, rY, { width:cols[5].w });
      doc.text(raisedStr,                              cols[6].x, rY, { width:cols[6].w });
      doc.y = rY + 16; drawLine(doc.y); doc.y += 2;
    });
    doc.end();
  } catch (e) {
    console.error('GET /export/pdf error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
