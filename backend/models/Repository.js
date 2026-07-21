import mongoose from 'mongoose';

const repositorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  githubId: Number,
  name: { type: String, required: true },
  fullName: String,
  description: String,
  private: Boolean,
  language: String,
  defaultBranch: { type: String, default: 'main' },
  cloneUrl: String,
  lastCommit: String,
  analysisStatus: {
    type: String,
    enum: ['pending', 'analyzing', 'completed', 'failed'],
    default: 'pending',
  },
  size: Number,
  filesCount: Number,
}, {
  timestamps: true,
});

repositorySchema.index({ userId: 1 });
repositorySchema.index({ githubId: 1 });

const Repository = mongoose.model('Repository', repositorySchema);
export default Repository;
