import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'AuthUser' },
    userName:    { type: String },
    action:      { type: String, enum: ['create', 'update', 'delete', 'generate', 'email'], required: true },
    module:      {
      type: String,
      enum: ['users', 'materials', 'points', 'invoices', 'attendance', 'salary', 'auth'],
      required: true,
    },
    machineType: { type: String, enum: ['small', 'big', null], default: null },
    description: { type: String, required: true },
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ module: 1, action: 1 });
activityLogSchema.index({ machineType: 1 });

export default mongoose.model('ActivityLog', activityLogSchema);
