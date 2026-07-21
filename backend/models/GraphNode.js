import mongoose from 'mongoose';

const graphNodeSchema = new mongoose.Schema({
  repositoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true,
  },
  type: {
    type: String,
    enum: ['file', 'function', 'class', 'route', 'model', 'service', 'dependency'],
    required: true,
  },
  name: { type: String, required: true },
  file: String,
  metadata: mongoose.Schema.Types.Mixed,
}, {
  timestamps: true,
});

graphNodeSchema.index({ repositoryId: 1, type: 1 });
graphNodeSchema.index({ name: 1, repositoryId: 1 }, { unique: true });

const GraphNode = mongoose.model('GraphNode', graphNodeSchema);
export default GraphNode;
