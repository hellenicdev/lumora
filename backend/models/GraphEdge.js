import mongoose from 'mongoose';

const graphEdgeSchema = new mongoose.Schema({
  repositoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true,
  },
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GraphNode',
    required: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GraphNode',
    required: true,
  },
  type: {
    type: String,
    enum: ['IMPORTS', 'CALLS', 'USES', 'CONNECTS_TO', 'DEPENDS_ON', 'CREATES', 'EXTENDS'],
    required: true,
  },
  metadata: mongoose.Schema.Types.Mixed,
}, {
  timestamps: true,
});

graphEdgeSchema.index({ repositoryId: 1 });
graphEdgeSchema.index({ sourceId: 1, targetId: 1, type: 1 }, { unique: true });

const GraphEdge = mongoose.model('GraphEdge', graphEdgeSchema);
export default GraphEdge;
