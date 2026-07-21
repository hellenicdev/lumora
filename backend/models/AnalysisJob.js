import mongoose from 'mongoose';

const analysisJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  repositoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
  },
  type: {
    type: String,
    enum: ['import', 'analysis', 'documentation', 'security', 'sync'],
    required: true,
  },
  status: {
    type: String,
    enum: ['queued', 'running', 'completed', 'failed'],
    default: 'queued',
  },
  progress: {
    type: Number,
    default: 0,
  },
  error: String,
  result: mongoose.Schema.Types.Mixed,
}, {
  timestamps: true,
});

analysisJobSchema.index({ userId: 1, createdAt: -1 });
analysisJobSchema.index({ status: 1 });

const AnalysisJob = mongoose.model('AnalysisJob', analysisJobSchema);
export default AnalysisJob;
