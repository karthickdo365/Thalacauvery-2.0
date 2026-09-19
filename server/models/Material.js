import mongoose from 'mongoose';

// ============================================================
// MATERIAL MODEL
// ============================================================

const materialSchema = new mongoose.Schema(
  {
    // ============================================================
    // DATE
    // ============================================================

    date: {
      type: Date,
      required: true,
    },

    // ============================================================
    // MATERIAL TYPE
    // ============================================================

    type: {
      type: String,
      enum: [
        'Diesel',
        'Petrol',

        // Pipe types
        'Pipe',
        'Pipe Outer',
        'Pipe Inner',
        'Pipe J1',
        'Pipe Small',

        'Bit',
        'Hammer',
        'Others',
      ],
      required: true,
    },

    // ============================================================
    // MACHINE TYPE
    // ============================================================

    machineType: {
      type: String,
      enum: ['small', 'big'],
      required: true,
      index: true,
    },

    // ============================================================
    // OTHERS DESCRIPTION
    // ============================================================

    description: {
      type: String,
      trim: true,
      default: '',
    },

    // ============================================================
    // QUANTITY
    // ============================================================

    quantity: {
      type: Number,
      default: 0,
    },

    // ============================================================
    // COST PER UNIT / LITER
    // ============================================================

    costPerLiter: {
      type: Number,
      default: 0,
    },

    // ============================================================
    // TOTAL PRICE
    // ============================================================

    totalPrice: {
      type: Number,
      default: 0,
    },

    // ============================================================
    // OTHERS AMOUNT
    // ============================================================

    amount: {
      type: Number,
      default: 0,
    },

    // ============================================================
    // BILL FILE
    // ============================================================

    billFile: {
      type: String,
      default: '',
    },

    // ============================================================
    // CREATED BY
    // ============================================================

    createdBy: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// INDEXES
// ============================================================

materialSchema.index({
  date: -1,
});

materialSchema.index({
  machineType: 1,
});

materialSchema.index({
  machineType: 1,
  date: -1,
});

// ============================================================
// AUTO CALCULATE TOTAL BEFORE SAVE
// ============================================================

materialSchema.pre('save', function (next) {
  if (this.type === 'Others') {
    this.totalPrice =
      Number(this.amount) || 0;
  } else {
    this.totalPrice =
      (Number(this.quantity) || 0) *
      (Number(this.costPerLiter) || 0);

    // Normal material types do not use these fields
    this.amount = 0;
    this.description = '';
  }

  next();
});

// ============================================================
// AUTO CALCULATE TOTAL BEFORE UPDATE
// ============================================================

materialSchema.pre(
  'findOneAndUpdate',
  function (next) {
    const update = this.getUpdate() || {};

    // Support both:
    // { type: 'Pipe Inner' }
    //
    // and:
    // { $set: { type: 'Pipe Inner' } }

    const updateData =
      update.$set || update;

    const type =
      updateData.type;

    // ----------------------------------------------------------
    // OTHERS
    // ----------------------------------------------------------

    if (type === 'Others') {
      updateData.totalPrice =
        Number(updateData.amount) || 0;
    }

    // ----------------------------------------------------------
    // NORMAL MATERIALS
    // ----------------------------------------------------------

    else if (type) {
      updateData.totalPrice =
        (Number(updateData.quantity) || 0) *
        (Number(updateData.costPerLiter) || 0);

      updateData.amount = 0;
      updateData.description = '';
    }

    // ----------------------------------------------------------
    // PRESERVE $SET WHEN USED
    // ----------------------------------------------------------

    if (update.$set) {
      update.$set = updateData;
    }

    this.setUpdate(update);

    next();
  }
);

// ============================================================
// EXPORT
// ============================================================

export default mongoose.model(
  'Material',
  materialSchema
);
