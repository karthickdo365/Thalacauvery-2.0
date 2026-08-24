import mongoose from 'mongoose';

// People records managed in PersonalInfo page
// type: Partner | Employee | Broker
//
// IMPORTANT:
// Every person belongs to ONE machine only.
// Allowed values:
//   big
//   small
//
// "both" is intentionally NOT allowed.

const personalUserSchema = new mongoose.Schema(
  {
    // ----------------------------------------------------------
    // Date
    // ----------------------------------------------------------
    date: {
      type: Date,
      required: true,
    },

    // ----------------------------------------------------------
    // Person Type
    // ----------------------------------------------------------
    type: {
      type: String,
      enum: ['Partner', 'Employee', 'Broker'],
      required: true,
    },

    // ----------------------------------------------------------
    // Name
    // ----------------------------------------------------------
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // ----------------------------------------------------------
    // Login Username
    // ----------------------------------------------------------
    username: {
      type: String,
      trim: true,
    },

    // ----------------------------------------------------------
    // Login Password
    // ----------------------------------------------------------
    password: {
      type: String,
      trim: true,
    },

    // ----------------------------------------------------------
    // Phone
    // ----------------------------------------------------------
    phone: {
      type: String,
      required: true,
      trim: true,
    },

    // ----------------------------------------------------------
    // Email
    // ----------------------------------------------------------
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // ----------------------------------------------------------
    // Salary
    // ----------------------------------------------------------
    salary: {
      type: Number,
      default: 0,
    },

    // ----------------------------------------------------------
    // MACHINE TYPE
    // ----------------------------------------------------------
    //
    // A person belongs to ONE machine.
    //
    // BIG:
    // machineType = "big"
    //
    // SMALL:
    // machineType = "small"
    //
    // There is NO "both".
    //
    machineType: {
      type: String,
      enum: ['small', 'big'],
      required: true,
    },
  },

  {
    timestamps: true,
  }
);


// ============================================================
// INDEXES
// ============================================================

// Search by person type and name
personalUserSchema.index({
  type: 1,
  name: 1,
});

// Machine filtering
personalUserSchema.index({
  machineType: 1,
});

// Faster machine + type filtering
personalUserSchema.index({
  machineType: 1,
  type: 1,
});


// ============================================================
// MODEL
// ============================================================

export default mongoose.model(
  'PersonalUser',
  personalUserSchema
);