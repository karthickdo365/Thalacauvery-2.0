import mongoose from 'mongoose';

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
    'Pipe',
    'Bit',
    'Hammer',
    'Others'
  ],
  required: true
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

    const type = update.type;

    if (type === 'Others') {
      update.totalPrice =
        Number(update.amount) || 0;
    } else if (type) {
      update.totalPrice =
        (Number(update.quantity) || 0) *
        (Number(update.costPerLiter) || 0);

      update.amount = 0;
      update.description = '';
    }

    this.setUpdate(update);

    next();
  }
);


export default mongoose.model(
  'Material',
  materialSchema
);