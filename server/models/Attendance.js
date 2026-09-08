import mongoose from 'mongoose';

const absentDateSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },

    reason: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    _id: true,
  }
);

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PersonalUser',
      required: true,
    },

    month: {
      type: String,
      required: true,
    },

    machineType: {
      type: String,
      enum: ['small', 'big'],
      default: 'small',
    },

    /*
     * Only ABSENT dates are stored.
     *
     * Example:
     *
     * absentDates: [
     *   {
     *     date: 2026-08-04,
     *     reason: "Going to native"
     *   },
     *   {
     *     date: 2026-08-10,
     *     reason: "Fever"
     *   }
     * ]
     *
     * Every other date is automatically considered PRESENT.
     */

    absentDates: {
      type: [absentDateSchema],
      default: [],
    },

    absentDays: {
      type: Number,
      default: 0,
    },

    notes: {
      type: String,
      trim: true,
      default: '',
    },

    createdBy: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

/*
 * One monthly attendance document
 * for one employee + machine.
 */
attendanceSchema.index(
  {
    employeeId: 1,
    month: 1,
    machineType: 1,
  },
  {
    unique: true,
  }
);

attendanceSchema.index({
  employeeId: 1,
});

attendanceSchema.index({
  month: 1,
});

attendanceSchema.index({
  machineType: 1,
});

/*
 * Keep absentDays automatically synchronized.
 */
attendanceSchema.pre('save', function (next) {
  this.absentDays = Array.isArray(this.absentDates)
    ? this.absentDates.length
    : 0;

  next();
});

export default mongoose.model('Attendance', attendanceSchema);