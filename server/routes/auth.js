import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import AuthUser from '../models/AuthUser.js';
import { protect, requireWrite } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import logActivity from '../utils/activityLog.js';

const router = express.Router();

const genToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// Brute-force protection on credential endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later' },
});

const validateCredentials = ({ name, username, password }) => {
  if (!name?.trim()) return 'Full name is required';
  if (!username?.trim()) return 'Username is required';
  if (!password || password.length < 6) return 'Password must be at least 6 characters';
  return null;
};

// ── POST /api/auth/register ───────────────────────────────────────────────────
// Public sign-up ALWAYS creates a read-only viewer account.
// Only an existing partner/admin can grant elevated roles (see /accounts below).
router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const name = req.body.name || req.body.fullName;
  const { username, password, phone } = req.body;

  const invalid = validateCredentials({ name, username, password });
  if (invalid) return res.status(400).json({ success: false, message: invalid });

  const exists = await AuthUser.findOne({ username: username.toLowerCase().trim() });
  if (exists) return res.status(400).json({ success: false, message: 'Username already taken' });

  const user = await AuthUser.create({
    name: name.trim(),
    username: username.toLowerCase().trim(),
    password,
    phone,
    role: 'viewer',
    isActive: true,
  });

  res.status(201).json({ success: true, token: genToken(user._id), user: user.toJSON() });
}));

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const user = await AuthUser.findOne({ username: username.toLowerCase().trim() });
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Account is deactivated' });
  }

  res.json({ success: true, token: genToken(user._id), user: user.toJSON() });
}));

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', protect, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ── PUT /api/auth/change-password ─────────────────────────────────────────────
router.put('/change-password', protect, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Both passwords are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
  }
  const user = await AuthUser.findById(req.user._id);
  if (!(await user.comparePassword(currentPassword))) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }
  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: 'Password updated' });
}));

// ═══ Account management — partner/admin only ══════════════════════════════════

// GET /api/auth/accounts
router.get('/accounts', protect, requireWrite, asyncHandler(async (req, res) => {
  const accounts = await AuthUser.find().select('-password').sort({ createdAt: -1 }).lean();
  res.json({ success: true, accounts });
}));

// POST /api/auth/accounts — create an account with a chosen role
router.post('/accounts', protect, requireWrite, asyncHandler(async (req, res) => {
  const { name, username, password, phone, role = 'viewer' } = req.body;

  const invalid = validateCredentials({ name, username, password });
  if (invalid) return res.status(400).json({ success: false, message: invalid });
  if (!['partner', 'viewer'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Role must be partner or viewer' });
  }

  const exists = await AuthUser.findOne({ username: username.toLowerCase().trim() });
  if (exists) return res.status(400).json({ success: false, message: 'Username already taken' });

  const user = await AuthUser.create({
    name: name.trim(),
    username: username.toLowerCase().trim(),
    password,
    phone,
    role,
    isActive: true,
  });

  logActivity(req, { action: 'create', module: 'auth', description: `Created ${role} account: ${user.username}` });
  res.status(201).json({ success: true, account: user.toJSON() });
}));

// PATCH /api/auth/accounts/:id — change role / activate / deactivate
router.patch('/accounts/:id', protect, requireWrite, asyncHandler(async (req, res) => {
  const { role, isActive, name, phone } = req.body;

  if (req.params.id === String(req.user._id) && (role !== undefined || isActive !== undefined)) {
    return res.status(400).json({ success: false, message: 'You cannot change your own role or deactivate yourself' });
  }

  const update = {};
  if (role !== undefined) {
    if (!['partner', 'viewer'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be partner or viewer' });
    }
    update.role = role;
  }
  if (isActive !== undefined) update.isActive = Boolean(isActive);
  if (name) update.name = name.trim();
  if (phone !== undefined) update.phone = phone;

  const account = await AuthUser.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select('-password');
  if (!account) return res.status(404).json({ success: false, message: 'Account not found' });

  logActivity(req, { action: 'update', module: 'auth', description: `Updated account ${account.username} (${Object.keys(update).join(', ')})` });
  res.json({ success: true, account });
}));

export default router;
