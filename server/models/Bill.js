import mongoose from 'mongoose';

const billSchema = new mongoose.Schema(
  {
    // ============================================================
    // DATE
    // ============================================================

    date: {
      type: Date,
      required: true,
    },

    // ============================================================
    // BROKER
    // ============================================================

    brokerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PersonalUser',
      default: null,
    },

    partyName: {
      type: String,
      trim: true,
      default: '',
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
    // SMALL MACHINE PIPES
    // ============================================================

    outerPipeFeet: {
      type: Number,
      default: 0,
    },

    innerPipeFeet: {
      type: Number,
      default: 0,
    },

    smallPipeFeet: {
      type: Number,
      default: 0,
    },

    // ============================================================
    // BIG MACHINE PIPES
    // ============================================================

    plasticOuterFeet: {
      type: Number,
      default: 0,
    },

    plasticInnerFeet: {
      type: Number,
      default: 0,
    },

    jiOuterFeet: {
      type: Number,
      default: 0,
    },

    jiInnerFeet: {
      type: Number,
      default: 0,
    },

    // ============================================================
    // DEPTH
    // ============================================================

    depthFeet: {
      type: Number,
      default: 0,
    },

    // ============================================================
    // SERVICE
    // ============================================================

    serviceType: {
      type: String,
      enum: [
        'Point',
        'Flushing',
        'Rod Flushing',
        '',
      ],
      default: '',
    },

    flushingAmount: {
      type: Number,
      default: 0,
    },

    rodFlushingAmount: {
      type: Number,
      default: 0,
    },

    // ============================================================
    // AMOUNTS
    // ============================================================

    totalAmount: {
      type: Number,
      default: 0,
    },

    paidAmount: {
      type: Number,
      default: 0,
    },

    // ============================================================
    // PAYMENT STATUS
    // ============================================================

    paymentStatus: {
      type: String,
      enum: [
        'Paid',
        'Unpaid',
        'Partial',
        'Other',
      ],
      default: 'Unpaid',
    },

    // ============================================================
    // RATE BREAKDOWN
    // ============================================================

    breakdown: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // ============================================================
    // AGENT POINT
    // ============================================================

    agentPointId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BorewellPoint',
      default: null,
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

billSchema.index({
  date: -1,
});

billSchema.index({
  paymentStatus: 1,
});

billSchema.index({
  brokerId: 1,
});

billSchema.index({
  machineType: 1,
});

billSchema.index({
  machineType: 1,
  date: -1,
});


// ============================================================
// MODEL
// ============================================================

export default mongoose.model(
  'Bill',
  billSchema
);