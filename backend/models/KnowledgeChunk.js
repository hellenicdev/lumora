import mongoose from 'mongoose';

const knowledgeChunkSchema = new mongoose.Schema({
  repositoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true,
  },
  type: {
    type: String,
    enum: ['file', 'function', 'class', 'route', 'model', 'service', 'dependency', 'env_var', 'architecture'],
    required: true,
  },
  title: { type: String, required: true },
  content: { type: String, required: true },
  sourceFile: String,
  metadata: mongoose.Schema.Types.Mixed,
  embedding: [Number],
}, {
  timestamps: true,
});

knowledgeChunkSchema.index({ repositoryId: 1, type: 1 });
knowledgeChunkSchema.index({ repositoryId: 1, title: 1 });

const KnowledgeChunk = mongoose.model('KnowledgeChunk', knowledgeChunkSchema);
export default KnowledgeChunk;
