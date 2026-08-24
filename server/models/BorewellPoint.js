import mongoose from 'mongoose';

const borewellPointSchema = new mongoose.Schema(
  {
    date:             { type: Date, required: true },
    brokerId:         { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalUser', default: null },
    manualBrokerName: { type: String, trim: true, default: '' }, // for new/unnamed brokers
    machineType:      { type: String, enum: ['small', 'big'], default: 'small' },
    outerPipe:        { rate: { type: Number, default: 0 } },
    innerPipe:        { rate: { type: Number, default: 0 } },
    smallInnerPipe:   { rate: { type: Number, default: 0 } },
    plasticOuter:     { rate: { type: Number, default: 0 } },
    plasticInner:     { rate: { type: Number, default: 0 } },
    jiOuter:          { rate: { type: Number, default: 0 } },
    jiInner:          { rate: { type: Number, default: 0 } },
    depthDetails: [{ range: { type: String }, rate: { type: Number, default: 0 } }],
    createdBy:        { type: String },
  },
  { timestamps: true }
);

export default mongoose.model('BorewellPoint', borewellPointSchema);
