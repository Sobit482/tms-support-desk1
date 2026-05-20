-- ============================================================
--  SEED DATA — Run AFTER 01_schema.sql
-- ============================================================

-- Brokers
INSERT INTO brokers (broker_id, broker_name, contact_person, contact_email, contact_phone) VALUES
('BRK-001','Kumari Securities Private Limited','Manager 001','broker001@tms.com','9800000001'),
('BRK-003','Arun Securities (PVT) Ltd.','Manager 002','broker003@tms.com','9800000002'),
('BRK-004','Opal Securities Investment (PVT) Ltd.','Manager 003','broker004@tms.com','9800000003'),
('BRK-005','Market Securities & Exchange (PVT) Ltd.','Manager 004','broker005@tms.com','9800000004'),
('BRK-006','Agrawal Securities (PVT) Ltd.','Manager 005','broker006@tms.com','9800000005'),
('BRK-007','J.F. Securites (PVT) Ltd.','Manager 006','broker007@tms.com','9800000006'),
('BRK-008','Ashutosh Brokerage & Securities (PVT) Ltd.','Manager 007','broker008@tms.com','9800000007'),
('BRK-010','Pragyan Securities (PVT) Ltd.','Manager 008','broker010@tms.com','9800000008'),
('BRK-011','Malla & Malla Stock Broking Company Pvt. Limited','Manager 009','broker011@tms.com','9800000009'),
('BRK-013','Thrive Brokerage House Pvt. Ltd','Manager 010','broker013@tms.com','9800000010'),
('BRK-014','Nepal Stock House (PVT) Ltd.','Manager 011','broker014@tms.com','9800000011'),
('BRK-016','Primo Securities (PVT) Ltd.','Manager 012','broker016@tms.com','9800000012'),
('BRK-017','ABC Securities Private Limited','Manager 013','broker017@tms.com','9800000013'),
('BRK-018','Sagarmatha Securities Private Limited','Manager 014','broker018@tms.com','9800000014'),
('BRK-019','Nepal Investment And Securities Trading Private Limited','Manager 015','broker019@tms.com','9800000015'),
('BRK-020','Sipla Securities Private Limited','Manager 016','broker020@tms.com','9800000016'),
('BRK-021','Midas Stock Broking Company Private Limited','Manager 017','broker021@tms.com','9800000017'),
('BRK-022','Siprabi Securities Pvt. Ltd.','Manager 018','broker022@tms.com','9800000018'),
('BRK-025','Sweta Securities Private Limited','Manager 019','broker025@tms.com','9800000019'),
('BRK-026','Asian Securities Private Ltd.','Manager 020','broker026@tms.com','9800000020'),
('BRK-028','Shree Krishna Securities Ltd.','Manager 021','broker028@tms.com','9800000021'),
('BRK-029','Trisul Securities & Invt. Ltd.','Manager 022','broker029@tms.com','9800000022'),
('BRK-032','Premier Securities Company Ltd.','Manager 023','broker032@tms.com','9800000023'),
('BRK-033','Dakshinkali Investment & Securities Pvt. Ltd.','Manager 025','broker033@tms.com','9800000025'),
('BRK-034','Vision Securities Pvt. Ltd','Manager 027','broker034@tms.com','9800000027'),
('BRK-035','Kohinoor Investment & Securities Pvt. Ltd.','Manager 028','broker035@tms.com','9800000028'),
('BRK-036','Secured Securities Ltd.','Manager 029','broker036@tms.com','9800000029'),
('BRK-037','Swarna Laxmi Securities Pvt. Ltd.','Manager 030','broker037@tms.com','9800000030'),
('BRK-038','Dipshikha Dhitopatra Karobar Co. Pvt Ltd.','Manager 032','broker038@tms.com','9800000032'),
('BRK-039','Sumeru Securities Pvt. Ltd.','Manager 034','broker039@tms.com','9800000034'),
('BRK-040','Creative Securities Pvt Ltd','Manager 024','broker040@tms.com','9800000024'),
('BRK-041','Linch Stock Market Ltd.','Manager 026','broker041@tms.com','9800000026'),
('BRK-042','Sani Securities Company Ltd.','Manager 031','broker042@tms.com','9800000031'),
('BRK-043','South Asian Bulls Pvt. Ltd.','Manager 033','broker043@tms.com','9800000033'),
('BRK-044','Dynamic Money Managers Securities Pvt. Ltd.','Manager 035','broker044@tms.com','9800000035'),
('BRK-045','Imperial Securities Company Pvt. Ltd.','Manager 036','broker045@tms.com','9800000036'),
('BRK-046','Kalika Securities Pvt. Ltd.','Manager 037','broker046@tms.com','9800000037'),
('BRK-047','Neev Securities Pvt. Ltd.','Manager 038','broker047@tms.com','9800000038'),
('BRK-048','Trishakti Securities Public Limited','Manager 039','broker048@tms.com','9800000039'),
('BRK-049','Online Securities Pvt. Ltd.','Manager 040','broker049@tms.com','9800000040'),
('BRK-050','Cristal Kanchanjanga Securites Pvt. Ltd.','Manager 041','broker050@tms.com','9800000041'),
('BRK-051','Oxford Securities Pvt. Ltd.','Manager 042','broker051@tms.com','9800000042'),
('BRK-052','Sundhara Securities Limited','Manager 043','broker052@tms.com','9800000043'),
('BRK-053','Investment Management Nepal Pvt. Ltd.','Manager 047','broker053@tms.com','9800000047'),
('BRK-054','Sewa Securities Pvt. Ltd.','Manager 046','broker054@tms.com','9800000046'),
('BRK-055','Bhrikuti Stock Broking Co. Pvt. Ltd.','Manager 045','broker055@tms.com','9800000045'),
('BRK-056','Sri Hari Securities Pvt. Ltd.','Manager 044','broker056@tms.com','9800000044'),
('BRK-057','Aryatara Investment & Securities','Manager 048','broker057@tms.com','9800000048'),
('BRK-058','Naasa Securities Co. Ltd.','Manager 049','broker058@tms.com','9800000049'),
('BRK-059','Deevyaa Securities & Stock House Pvt. Ltd','Manager 050','broker059@tms.com','9800000050')
ON CONFLICT (broker_id) DO NOTHING;

-- Categories
INSERT INTO ticket_categories (category_name, sla_hours) VALUES
('Trade Execution',    4),
('Account Management', 24),
('Settlement Issues',  8),
('KYC & Compliance',   48),
('Technical Support',  12),
('Payment & Funds',    8),
('Reporting',          24),
('DP Issue',           4),
('Order Issue',        6),
('Collateral Issue',   6)
ON CONFLICT (category_name) DO NOTHING;

-- Sub Issues
INSERT INTO sub_issues (category_id, sub_issue_name)
SELECT c.category_id, v.sub_issue_name
FROM (VALUES
  ('Trade Execution',    'Order Not Executed'),
  ('Trade Execution',    'Wrong Price Execution'),
  ('Trade Execution',    'Partial Fill Issue'),
  ('Trade Execution',    'Order Cancellation Failed'),
  ('Account Management', 'Account Activation'),
  ('Account Management', 'Password Reset'),
  ('Account Management', 'Profile Update'),
  ('Account Management', 'Account Suspension Query'),
  ('Settlement Issues',  'Delayed Settlement'),
  ('Settlement Issues',  'Failed Settlement'),
  ('Settlement Issues',  'Incorrect Settlement Amount'),
  ('KYC & Compliance',   'KYC Document Submission'),
  ('KYC & Compliance',   'KYC Rejection'),
  ('KYC & Compliance',   'Compliance Query'),
  ('Technical Support',  'Platform Login Issue'),
  ('Technical Support',  'Market Data Feed Error'),
  ('Technical Support',  'API Integration Issue'),
  ('Technical Support',  'Performance Issue'),
  ('Payment & Funds',    'Funds Not Credited'),
  ('Payment & Funds',    'Withdrawal Delay'),
  ('Payment & Funds',    'Wrong Deduction'),
  ('Reporting',          'Incorrect P&L Report'),
  ('Reporting',          'Missing Trade Report'),
  ('Reporting',          'Statement Request'),
  ('DP Issue',           'DP Release Request'),
  ('DP Issue',           'DP Transfer Issue'),
  ('Order Issue',        'Order Modification'),
  ('Order Issue',        'Order Rejection'),
  ('Collateral Issue',   'Collateral Release'),
  ('Collateral Issue',   'Collateral Shortfall')
) AS v(category_name, sub_issue_name)
JOIN ticket_categories c ON c.category_name = v.category_name
WHERE NOT EXISTS (
  SELECT 1 FROM sub_issues si WHERE si.sub_issue_name = v.sub_issue_name AND si.category_id = c.category_id
);

-- Users  (default password for all: Admin@123)
INSERT INTO users (full_name, email, password_hash, role) VALUES
  ('System Admin',    'admin@tms.com',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin'),
  ('Support Agent 1', 'support1@tms.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'support'),
  ('Support Agent 2', 'support2@tms.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'support'),
  ('Tech Analyst 1',  'tech1@tms.com',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'technical'),
  ('Tech Analyst 2',  'tech2@tms.com',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'technical')
ON CONFLICT (email) DO NOTHING;
