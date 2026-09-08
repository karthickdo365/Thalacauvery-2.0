import jwt from 'jsonwebtoken';
import AuthUser from '../models/AuthUser.js';

// Roles allowed to create / update / delete data.
// Everyone else (viewer) gets read-only access.
export const WRITE_ROLES = ['partner', 'admin'];

export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await AuthUser.findById(decoded.id).select('-password');
    if (!req.user || !req.user.isActive) {
      return res.status(401).json({ success: false, message: 'Account not found or deactivated' });
    }
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Read-only access — only partners can make changes',
    });
  }
  next();
};

// Guard for every mutating endpoint
export const requireWrite = requireRole(...WRITE_ROLES);

export default protect;
