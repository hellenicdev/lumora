import mongoose from 'mongoose';

const usageRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['repositories', 'aiQuestions', 'docGenerations', 'securityScans'],
    required: true,
  },
  count: { type: Number, default: 0 },
  month: { type: Date, required: true },
}, {
  timestamps: true,
});

usageRecordSchema.index({ userId: 1, type: 1, month: 1 }, { unique: true });

const UsageRecord = mongoose.model('UsageRecord', usageRecordSchema);
export default UsageRecord;
