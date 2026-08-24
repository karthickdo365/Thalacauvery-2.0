import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Auth accounts — who can LOGIN to the app
const authUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    phone: { type: String, trim: true },
    role: { type: String, enum: ['admin', 'partner', 'viewer'], default: 'viewer' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

authUserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

authUserSchema.methods.comparePassword = async function (pwd) {
  return bcrypt.compare(pwd, this.password);
};

authUserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.model('AuthUser', authUserSchema);
