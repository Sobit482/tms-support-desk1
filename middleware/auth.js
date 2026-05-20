const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'supportdesk_secret_change_in_production';

function auth(rolesOrReq, res, next) {
  if (Array.isArray(rolesOrReq)) {
    const requiredRoles = rolesOrReq;
    return (req, res, next) => verifyToken(req, res, next, requiredRoles);
  }
  verifyToken(rolesOrReq, res, next, []);
}

function verifyToken(req, res, next, requiredRoles) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'No token provided' });
  try {
    const token   = header.slice(7);
    const decoded = jwt.verify(token, SECRET);
    req.user      = decoded;
    if (requiredRoles.length && !requiredRoles.includes(decoded.role))
      return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = auth;
