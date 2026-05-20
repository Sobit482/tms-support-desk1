const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const auth    = require('../middleware/auth');
const pptxgen = require('pptxgenjs');

const C = {
  navy:'1E2761',blue:'2563EB',teal:'0891B2',green:'16A34A',amber:'D97706',
  red:'DC2626',purple:'7C3AED',white:'FFFFFF',light:'F1F5F9',muted:'64748B',dark:'1E293B',border:'E2E8F0',
};
function makeShadow(){return{type:'outer',color:'000000',opacity:0.08,blur:8,offset:3,angle:135};}

router.get('/weekly', auth, async (req, res) => {
  try {
    const db=req.app.get('db');
    const today=new Date();
    const dow=today.getDay();
    const weekStart=new Date(today);
    weekStart.setDate(today.getDate()+(dow===0?-6:1-dow));
    weekStart.setHours(0,0,0,0);

    const {rows:ticketRows}=await db.query(`
      SELECT t.ticket_id,t.heading,t.priority,t.status,t.raised_at,t.sla_breached,
             b.broker_name,c.category_name,s.sub_issue_name,
             u.full_name AS raised_by,t.is_rejected,t.rejection_reason
      FROM tickets t
      LEFT JOIN brokers b ON t.broker_id=b.broker_id
      LEFT JOIN ticket_categories c ON t.category_id=c.category_id
      LEFT JOIN sub_issues s ON t.sub_issue_id=s.sub_issue_id
      LEFT JOIN users u ON t.raised_by_user_id=u.user_id
      WHERE t.raised_at BETWEEN $1 AND $2
      ORDER BY t.priority,t.raised_at DESC`,[weekStart,today]);

    const {rows:brokerRows}=await db.query(`
      SELECT b.broker_name,COUNT(t.ticket_id) AS total,
        SUM(CASE WHEN t.sla_breached=true THEN 1 ELSE 0 END) AS sla_breached,
        SUM(CASE WHEN t.status IN('resolved','closed') THEN 1 ELSE 0 END) AS resolved,
        SUM(CASE WHEN t.status='rejected' THEN 1 ELSE 0 END) AS rejected
      FROM brokers b LEFT JOIN tickets t ON b.broker_id=t.broker_id AND t.raised_at BETWEEN $1 AND $2
      WHERE b.is_active=true GROUP BY b.broker_name ORDER BY total DESC`,[weekStart,today]);

    const {rows:catRows}=await db.query(`
      SELECT c.category_name,COUNT(t.ticket_id) AS total,
        SUM(CASE WHEN t.status IN('resolved','closed') THEN 1 ELSE 0 END) AS resolved,
        SUM(CASE WHEN t.sla_breached=true THEN 1 ELSE 0 END) AS sla_breached
      FROM ticket_categories c LEFT JOIN tickets t ON c.category_id=t.category_id AND t.raised_at BETWEEN $1 AND $2
      WHERE c.is_active=true GROUP BY c.category_name ORDER BY total DESC`,[weekStart,today]);

    const {rows:featRows}=await db.query(`
      SELECT title,priority,status,module,created_at FROM feature_requests
      WHERE status NOT IN('completed','rejected')
      ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,created_at DESC
      LIMIT 8`);

    const all=ticketRows;
    const stats={
      total:all.length,open:all.filter(t=>t.status==='open').length,
      inProgress:all.filter(t=>t.status==='inprogress').length,
      resolved:all.filter(t=>['resolved','closed'].includes(t.status)).length,
      rejected:all.filter(t=>t.status==='rejected').length,
      slaBreached:all.filter(t=>t.sla_breached).length,
      critical:all.filter(t=>t.priority==='critical').length,
      slaRate:all.length>0?Math.round((all.filter(t=>!t.sla_breached).length/all.length)*100):100,
    };
    const weekLabel=`${weekStart.toLocaleDateString('en-IN',{day:'2-digit',month:'short'})} - ${today.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}`;
    const priColors={critical:C.purple,high:C.red,medium:C.amber,low:C.green};

    const pres=new pptxgen();
    pres.layout='LAYOUT_16x9';pres.title=`TMS Weekly Report - ${weekLabel}`;pres.author='TMS Support Desk';

    const s1=pres.addSlide();s1.background={color:C.navy};
    s1.addShape(pres.shapes.RECTANGLE,{x:0,y:0,w:0.4,h:5.625,fill:{color:C.teal}});
    s1.addText('TMS SUPPORT DESK',{x:0.7,y:1.4,w:8.6,h:0.5,fontSize:13,fontFace:'Calibri',color:C.teal,bold:true,charSpacing:4});
    s1.addText('Weekly Performance Report',{x:0.7,y:1.95,w:8.6,h:1.0,fontSize:38,fontFace:'Calibri',color:C.white,bold:true});
    s1.addText(weekLabel,{x:0.7,y:3.0,w:6,h:0.5,fontSize:16,fontFace:'Calibri',color:'CADCFC'});
    s1.addText(`Generated: ${today.toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}`,{x:0.7,y:3.55,w:6,h:0.4,fontSize:12,fontFace:'Calibri',color:C.muted});
    s1.addShape(pres.shapes.RECTANGLE,{x:7.5,y:1.5,w:2.0,h:2.0,fill:{color:C.teal,transparency:80},line:{color:C.teal,width:1}});
    s1.addText(String(stats.total),{x:7.5,y:1.8,w:2.0,h:0.9,fontSize:52,fontFace:'Calibri',color:C.white,bold:true,align:'center'});
    s1.addText('TOTAL TICKETS',{x:7.5,y:2.75,w:2.0,h:0.4,fontSize:9,fontFace:'Calibri',color:C.teal,bold:true,align:'center',charSpacing:2});

    const s2=pres.addSlide();s2.background={color:'F8FAFC'};
    s2.addShape(pres.shapes.RECTANGLE,{x:0,y:0,w:10,h:0.75,fill:{color:C.navy}});
    s2.addText('WEEKLY KPI SUMMARY',{x:0.3,y:0.1,w:9.4,h:0.55,fontSize:18,fontFace:'Calibri',color:C.white,bold:true});
    s2.addText(weekLabel,{x:7,y:0.1,w:2.8,h:0.55,fontSize:11,fontFace:'Calibri',color:'CADCFC',align:'right'});
    const kpis=[{label:'Total Tickets',val:stats.total,color:C.blue},{label:'Open',val:stats.open,color:C.teal},{label:'In Progress',val:stats.inProgress,color:C.amber},{label:'Resolved',val:stats.resolved,color:C.green},{label:'Rejected',val:stats.rejected,color:C.purple}];
    const kpiW=1.75,kpiH=1.5,kpiGap=0.1,kpiStartX=0.3,kpiY=0.95;
    kpis.forEach((k,i)=>{const x=kpiStartX+i*(kpiW+kpiGap);s2.addShape(pres.shapes.RECTANGLE,{x,y:kpiY,w:kpiW,h:kpiH,fill:{color:C.white},shadow:makeShadow(),line:{color:C.border,width:0.5}});s2.addShape(pres.shapes.RECTANGLE,{x,y:kpiY,w:kpiW,h:0.06,fill:{color:k.color}});s2.addText(k.label,{x:x+0.1,y:kpiY+0.12,w:kpiW-0.2,h:0.32,fontSize:10,fontFace:'Calibri',color:C.muted,bold:true});s2.addText(String(k.val),{x:x+0.1,y:kpiY+0.5,w:kpiW-0.2,h:0.7,fontSize:40,fontFace:'Calibri',color:k.color,bold:true,align:'center'});});
    const slaCards=[{label:'SLA Compliance',val:stats.slaRate+'%',color:stats.slaRate>=90?C.green:stats.slaRate>=75?C.amber:C.red},{label:'SLA Breached',val:stats.slaBreached,color:stats.slaBreached>0?C.red:C.green},{label:'Critical Tickets',val:stats.critical,color:C.red}];
    const row2Y=kpiY+kpiH+0.2;slaCards.forEach((k,i)=>{const x=kpiStartX+i*(kpiW*1.8+kpiGap);s2.addShape(pres.shapes.RECTANGLE,{x,y:row2Y,w:kpiW*1.78,h:1.1,fill:{color:C.white},shadow:makeShadow(),line:{color:C.border,width:0.5}});s2.addShape(pres.shapes.RECTANGLE,{x,y:row2Y,w:kpiW*1.78,h:0.06,fill:{color:k.color}});s2.addText(k.label,{x:x+0.15,y:row2Y+0.12,w:kpiW*1.5,h:0.28,fontSize:10,fontFace:'Calibri',color:C.muted,bold:true});s2.addText(String(k.val),{x:x+0.15,y:row2Y+0.42,w:kpiW*1.5,h:0.55,fontSize:32,fontFace:'Calibri',color:k.color,bold:true,align:'center'});});

    const s3=pres.addSlide();s3.background={color:'F8FAFC'};
    s3.addShape(pres.shapes.RECTANGLE,{x:0,y:0,w:10,h:0.75,fill:{color:C.navy}});
    s3.addText('TICKETS BY CATEGORY',{x:0.3,y:0.1,w:9.4,h:0.55,fontSize:18,fontFace:'Calibri',color:C.white,bold:true});
    const cats=catRows.filter(c=>c.total>0);
    if(cats.length>0){s3.addChart(pres.charts.BAR,[{name:'Total',labels:cats.map(c=>c.category_name),values:cats.map(c=>+c.total)},{name:'Resolved',labels:cats.map(c=>c.category_name),values:cats.map(c=>+c.resolved)},{name:'SLA Breach',labels:cats.map(c=>c.category_name),values:cats.map(c=>+c.sla_breached)}],{x:0.3,y:0.85,w:6.0,h:4.2,barDir:'col',barGrouping:'clustered',chartColors:[C.blue,C.green,C.red],showValue:true,showLegend:true,legendPos:'b'});}
    s3.addShape(pres.shapes.RECTANGLE,{x:6.5,y:0.85,w:3.2,h:4.3,fill:{color:C.white},shadow:makeShadow(),line:{color:C.border,width:0.5}});
    s3.addText('Category Detail',{x:6.6,y:0.92,w:3.0,h:0.35,fontSize:11,fontFace:'Calibri',color:C.navy,bold:true});
    s3.addTable([[{text:'Category',options:{bold:true,fill:{color:C.navy},color:C.white,fontSize:9}},{text:'Total',options:{bold:true,fill:{color:C.navy},color:C.white,fontSize:9,align:'center'}},{text:'Resolved',options:{bold:true,fill:{color:C.navy},color:C.white,fontSize:9,align:'center'}}],...cats.map(c=>[{text:c.category_name,options:{fontSize:9}},{text:String(c.total),options:{align:'center',fontSize:9,bold:true}},{text:String(c.resolved),options:{align:'center',fontSize:9,color:C.green}}])],{x:6.55,y:1.3,w:3.1,colW:[1.7,0.65,0.75],border:{pt:0.5,color:C.border}});

    const s4=pres.addSlide();s4.background={color:'F8FAFC'};
    s4.addShape(pres.shapes.RECTANGLE,{x:0,y:0,w:10,h:0.75,fill:{color:C.navy}});
    s4.addText('BROKER PERFORMANCE',{x:0.3,y:0.1,w:9.4,h:0.55,fontSize:18,fontFace:'Calibri',color:C.white,bold:true});
    const brokers=brokerRows.filter(b=>b.total>0);
    if(brokers.length>0){s4.addChart(pres.charts.BAR,[{name:'Total',labels:brokers.map(b=>b.broker_name),values:brokers.map(b=>+b.total)},{name:'Resolved',labels:brokers.map(b=>b.broker_name),values:brokers.map(b=>+b.resolved)},{name:'Rejected',labels:brokers.map(b=>b.broker_name),values:brokers.map(b=>+b.rejected)}],{x:0.3,y:0.85,w:5.8,h:4.2,barDir:'bar',barGrouping:'clustered',chartColors:[C.blue,C.green,C.red],showValue:true,showLegend:true,legendPos:'b'});s4.addShape(pres.shapes.RECTANGLE,{x:6.3,y:0.85,w:3.4,h:4.3,fill:{color:C.white},shadow:makeShadow(),line:{color:C.border,width:0.5}});s4.addTable([[{text:'Broker',options:{bold:true,fill:{color:C.navy},color:C.white,fontSize:9}},{text:'Total',options:{bold:true,fill:{color:C.navy},color:C.white,fontSize:9,align:'center'}},{text:'SLA Fail',options:{bold:true,fill:{color:C.navy},color:C.white,fontSize:9,align:'center'}},{text:'Rejected',options:{bold:true,fill:{color:C.navy},color:C.white,fontSize:9,align:'center'}}],...brokers.slice(0,8).map(b=>[{text:b.broker_name,options:{fontSize:9}},{text:String(b.total),options:{align:'center',fontSize:9,bold:true}},{text:String(b.sla_breached),options:{align:'center',fontSize:9,color:b.sla_breached>0?C.red:C.green}},{text:String(b.rejected),options:{align:'center',fontSize:9,color:b.rejected>0?C.purple:C.muted}}])],{x:6.35,y:0.9,w:3.3,colW:[1.5,0.55,0.6,0.6],border:{pt:0.5,color:C.border}});}

    const s5=pres.addSlide();s5.background={color:'F8FAFC'};
    s5.addShape(pres.shapes.RECTANGLE,{x:0,y:0,w:10,h:0.75,fill:{color:C.navy}});
    s5.addText('CRITICAL & HIGH PRIORITY TICKETS',{x:0.3,y:0.1,w:9.4,h:0.55,fontSize:18,fontFace:'Calibri',color:C.white,bold:true});
    const criticalHigh=all.filter(t=>['critical','high'].includes(t.priority)).slice(0,12);
    if(criticalHigh.length>0){s5.addTable([[{text:'Ticket ID',options:{bold:true,fill:{color:C.navy},color:C.white,fontSize:8}},{text:'Subject',options:{bold:true,fill:{color:C.navy},color:C.white,fontSize:8}},{text:'Broker',options:{bold:true,fill:{color:C.navy},color:C.white,fontSize:8}},{text:'Priority',options:{bold:true,fill:{color:C.navy},color:C.white,fontSize:8,align:'center'}},{text:'Status',options:{bold:true,fill:{color:C.navy},color:C.white,fontSize:8,align:'center'}},{text:'SLA',options:{bold:true,fill:{color:C.navy},color:C.white,fontSize:8,align:'center'}}],...criticalHigh.map((t,i)=>[{text:t.ticket_id,options:{fontSize:8,fontFace:'Courier New',color:C.teal,fill:{color:i%2===0?C.white:C.light}}},{text:(t.heading||'').substring(0,35),options:{fontSize:8,fill:{color:i%2===0?C.white:C.light}}},{text:(t.broker_name||'').substring(0,18),options:{fontSize:8,fill:{color:i%2===0?C.white:C.light}}},{text:t.priority.toUpperCase(),options:{fontSize:8,bold:true,align:'center',color:priColors[t.priority]||C.dark,fill:{color:i%2===0?C.white:C.light}}},{text:t.status,options:{fontSize:8,align:'center',fill:{color:i%2===0?C.white:C.light}}},{text:t.sla_breached?'BREACH':'OK',options:{fontSize:8,align:'center',color:t.sla_breached?C.red:C.green,fill:{color:i%2===0?C.white:C.light}}}])],{x:0.2,y:0.82,w:9.6,colW:[1.3,3.0,1.9,0.9,0.9,0.8],border:{pt:0.5,color:C.border}});}
    else{s5.addText('No critical or high priority tickets this week.',{x:1,y:2.5,w:8,h:1,fontSize:18,fontFace:'Calibri',color:C.green,align:'center'});}

    const s6=pres.addSlide();s6.background={color:'F8FAFC'};
    s6.addShape(pres.shapes.RECTANGLE,{x:0,y:0,w:10,h:0.75,fill:{color:C.red}});
    s6.addText('REJECTED TICKETS - TECHNICAL TEAM FEEDBACK',{x:0.3,y:0.1,w:9.4,h:0.55,fontSize:16,fontFace:'Calibri',color:C.white,bold:true});
    const rejected=all.filter(t=>t.is_rejected||t.status==='rejected');
    if(rejected.length>0){s6.addTable([[{text:'Ticket ID',options:{bold:true,fill:{color:C.red},color:C.white,fontSize:9}},{text:'Subject',options:{bold:true,fill:{color:C.red},color:C.white,fontSize:9}},{text:'Broker',options:{bold:true,fill:{color:C.red},color:C.white,fontSize:9}},{text:'Rejection Reason',options:{bold:true,fill:{color:C.red},color:C.white,fontSize:9}}],...rejected.slice(0,10).map((t,i)=>[{text:t.ticket_id,options:{fontSize:8,fontFace:'Courier New',fill:{color:i%2===0?C.white:C.light}}},{text:(t.heading||'').substring(0,25),options:{fontSize:8,fill:{color:i%2===0?C.white:C.light}}},{text:(t.broker_name||'').substring(0,15),options:{fontSize:8,fill:{color:i%2===0?C.white:C.light}}},{text:(t.rejection_reason||'').substring(0,80),options:{fontSize:8,fill:{color:i%2===0?C.white:C.light},color:C.dark}}])],{x:0.2,y:0.85,w:9.6,colW:[1.2,2.2,1.4,4.8],border:{pt:0.5,color:C.border}});}
    else{s6.addText('No tickets were rejected this week',{x:1,y:2.5,w:8,h:1,fontSize:14,fontFace:'Calibri',color:C.green,align:'center',bold:true});}

    const s7=pres.addSlide();s7.background={color:'F8FAFC'};
    s7.addShape(pres.shapes.RECTANGLE,{x:0,y:0,w:10,h:0.75,fill:{color:C.purple}});
    s7.addText('FEATURE REQUESTS - PENDING & IN PROGRESS',{x:0.3,y:0.1,w:9.4,h:0.55,fontSize:18,fontFace:'Calibri',color:C.white,bold:true});
    if(featRows.length>0){const statusColors={pending:'D97706',under_review:C.teal,approved:C.green,in_development:C.blue,completed:C.green,rejected:C.red};s7.addTable([[{text:'Title',options:{bold:true,fill:{color:C.purple},color:C.white,fontSize:9}},{text:'Module',options:{bold:true,fill:{color:C.purple},color:C.white,fontSize:9}},{text:'Priority',options:{bold:true,fill:{color:C.purple},color:C.white,fontSize:9,align:'center'}},{text:'Status',options:{bold:true,fill:{color:C.purple},color:C.white,fontSize:9,align:'center'}}],...featRows.map((f,i)=>[{text:(f.title||'').substring(0,45),options:{fontSize:9,fill:{color:i%2===0?C.white:C.light}}},{text:(f.module||'General').substring(0,18),options:{fontSize:9,fill:{color:i%2===0?C.white:C.light},color:C.muted}},{text:(f.priority||'medium').toUpperCase(),options:{fontSize:9,bold:true,align:'center',color:priColors[f.priority]||C.dark,fill:{color:i%2===0?C.white:C.light}}},{text:(f.status||'pending').replace('_',' ').toUpperCase(),options:{fontSize:9,align:'center',color:statusColors[f.status]||C.muted,bold:true,fill:{color:i%2===0?C.white:C.light}}}])],{x:0.3,y:0.85,w:9.4,colW:[4.8,2.0,1.2,1.4],border:{pt:0.5,color:C.border}});}
    else{s7.addText('No pending feature requests.',{x:1,y:2.5,w:8,h:1,fontSize:16,fontFace:'Calibri',color:C.muted,align:'center'});}

    const s8=pres.addSlide();s8.background={color:C.navy};
    s8.addShape(pres.shapes.RECTANGLE,{x:0,y:0,w:0.4,h:5.625,fill:{color:C.teal}});
    s8.addText('ACTION ITEMS & NEXT STEPS',{x:0.7,y:0.8,w:9,h:0.6,fontSize:24,fontFace:'Calibri',color:C.teal,bold:true});
    const actions=[
      stats.slaBreached>0?`${stats.slaBreached} SLA breach(es) need immediate review and escalation`:null,
      stats.rejected>0?`${stats.rejected} rejected ticket(s) - support team to re-check and resubmit`:null,
      stats.critical>0?`${stats.critical} critical ticket(s) require priority resolution`:null,
      stats.open>5?`${stats.open} open tickets - ensure timely assignment`:null,
      featRows.length>0?`${featRows.length} feature request(s) awaiting review by management`:null,
      'Review weekly SLA compliance trend with technical team',
      'Update all in-progress tickets with latest status before next meeting',
    ].filter(Boolean);
    s8.addText(actions.map(a=>({text:a,options:{bullet:true,breakLine:true,paraSpaceAfter:6}})),{x:0.7,y:1.5,w:8.8,h:3.5,fontSize:13,fontFace:'Calibri',color:'E2E8F0',lineSpacingMultiple:1.3});
    s8.addText(`TMS Support Desk  |  Week of ${weekLabel}`,{x:0.7,y:5.1,w:8.8,h:0.35,fontSize:10,fontFace:'Calibri',color:C.muted,align:'right'});

    const tmpFile=path.join(require('os').tmpdir(),`tms_weekly_${Date.now()}.pptx`);
    await pres.writeFile({fileName:tmpFile});
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition',`attachment; filename="TMS_Weekly_Report.pptx"`);
    const stream=fs.createReadStream(tmpFile);
    stream.pipe(res);
    stream.on('end',()=>{try{fs.unlinkSync(tmpFile);}catch{}});
  } catch(e){
    console.error('GET /pptx/weekly error:',e.message,e.stack);
    if(!res.headersSent) res.status(500).json({error:'Failed to generate PowerPoint: '+e.message});
  }
});

module.exports = router;
