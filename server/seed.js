import dotenv from 'dotenv';
dotenv.config();

import connectDB from './config/db.js';
import AuthUser from './models/AuthUser.js';

const seed = async () => {
  await connectDB();
  console.log('🌱 Seeding...');

  // Delete existing auth users
  await AuthUser.deleteMany({});

  await AuthUser.create([
    { name: 'Admin',   username: 'admin',   password: 'admin123',   role: 'admin',   isActive: true },
    { name: 'Partner', username: 'partner', password: 'partner123', role: 'partner', isActive: true },
    { name: 'Viewer',  username: 'viewer',  password: 'viewer123',  role: 'viewer',  isActive: true },
  ]);

  console.log('✅ Done!');
  console.log('');
  console.log('Login credentials:');
  console.log('  Admin   → username: admin   | password: admin123   (full control)');
  console.log('  Partner → username: partner | password: partner123 (full control)');
  console.log('  Viewer  → username: viewer  | password: viewer123  (read-only)');
  console.log('');
  console.log('Public registration at /register always creates read-only viewer accounts.');
  console.log('Partners can promote accounts from the Accounts page in the app.');
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
