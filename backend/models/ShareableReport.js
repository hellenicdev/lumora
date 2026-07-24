import mongoose from 'mongoose';

const shareableReportSchema = new mongoose.Schema({
  repositoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  slug: { type: String, required: true, unique: true },
  reportType: {
    type: String,
    enum: ['onboarding', 'health', 'security', 'architecture'],
    default: 'onboarding',
  },
  title: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, default: null },
  views: { type: Number, default: 0 },
}, {
  timestamps: true,
});

shareableReportSchema.index({ userId: 1 });
shareableReportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('ShareableReport', shareableReportSchema);
