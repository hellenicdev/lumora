import mongoose from 'mongoose';

const documentationVersionSchema = new mongoose.Schema({
  repositoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true,
  },
  type: {
    type: String,
    enum: ['README', 'WIKI', 'API_DOC', 'ARCHITECTURE'],
    required: true,
  },
  title: { type: String, default: '' },
  content: { type: String, required: true },
  commitHash: String,
  generatedBy: {
    type: String,
    enum: ['ai', 'user', 'system'],
    default: 'ai',
  },
  qualityScore: {
    type: Number,
    min: 0,
    max: 100,
  },
  metadata: mongoose.Schema.Types.Mixed,
}, {
  timestamps: true,
});

documentationVersionSchema.index({ repositoryId: 1, type: 1, createdAt: -1 });

const DocumentationVersion = mongoose.model('DocumentationVersion', documentationVersionSchema);
export default DocumentationVersion;
