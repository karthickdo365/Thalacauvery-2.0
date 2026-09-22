import bcrypt from 'bcryptjs';
import AuthUser from '../models/AuthUser.js';

const createAdmin = async () => {
  // ==========================================
  // ADMIN
  // ==========================================
  const adminPassword = await bcrypt.hash(
    'admin123',
    12
  );

  await AuthUser.findOneAndUpdate(
    { username: 'admin' },
    {
      name: 'Admin',
      username: 'admin',
      password: adminPassword,
      role: 'admin',
      isActive: true,
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
    }
  );

  console.log('✅ Admin account ready');

  // ==========================================
  // BIG MACHINE
  // ==========================================
  const bigMachinePassword = await bcrypt.hash(
    'big123',
    12
  );

  await AuthUser.findOneAndUpdate(
    { username: 'bigmachine' },
    {
      name: 'Big Machine',
      username: 'bigmachine',
      password: bigMachinePassword,
      role: 'viewer',
      isActive: true,
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
    }
  );

  console.log('✅ Big Machine account ready');

  // ==========================================
  // SMALL MACHINE
  // ==========================================
  const smallMachinePassword = await bcrypt.hash(
    'small123',
    12
  );

  await AuthUser.findOneAndUpdate(
    { username: 'smallmachine' },
    {
      name: 'Small Machine',
      username: 'smallmachine',
      password: smallMachinePassword,
      role: 'viewer',
      isActive: true,
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
    }
  );

  console.log('✅ Small Machine account ready');
};

export default createAdmin;
