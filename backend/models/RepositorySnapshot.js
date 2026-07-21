import mongoose from 'mongoose';

const repositorySnapshotSchema = new mongoose.Schema({
  repositoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true,
  },
  commitHash: { type: String, required: true },
  branch: { type: String, default: 'main' },
  filesCount: Number,
  size: Number,
  tree: mongoose.Schema.Types.Mixed,
}, {
  timestamps: true,
});

repositorySnapshotSchema.index({ repositoryId: 1, createdAt: -1 });

const RepositorySnapshot = mongoose.model('RepositorySnapshot', repositorySnapshotSchema);
export default RepositorySnapshot;
