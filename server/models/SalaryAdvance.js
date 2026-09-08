import mongoose from 'mongoose';

const salaryAdvanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PersonalUser',
      required: true,
    },

    // Actual date the advance was given
    advanceDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // Keep month for salary/report filtering
    month: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },

    // Comes automatically from MachineContext
    machineType: {
      type: String,
      enum: ['small', 'big'],
      required: true,
    },

    advanceAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    paymentMode: {
      type: String,
      enum: [
        'cash',
        'gpay',
        'net_banking',
        'cheque',
      ],
      default: 'cash',
    },

    notes: {
      type: String,
      trim: true,
      default: '',
    },

    createdBy: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);


// Fast machine + date queries
salaryAdvanceSchema.index({
  machineType: 1,
  advanceDate: -1,
});


// Employee salary history
salaryAdvanceSchema.index({
  employeeId: 1,
  machineType: 1,
  advanceDate: -1,
});


// Prevent duplicate advance record if the same
// employee, date, machine and amount are accidentally
// submitted twice.
salaryAdvanceSchema.index({
  employeeId: 1,
  advanceDate: 1,
  machineType: 1,
  advanceAmount: 1,
});


export default mongoose.model(
  'SalaryAdvance',
  salaryAdvanceSchema
);