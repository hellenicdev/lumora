import mongoose from 'mongoose';

const dependencySchema = new mongoose.Schema({
  repositoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true,
  },
  name: { type: String, required: true },
  version: String,
  type: {
    type: String,
    enum: ['production', 'development', 'optional', 'system'],
    default: 'production',
  },
  ecosystem: {
    type: String,
    enum: ['npm', 'pip', 'go', 'cargo', 'composer', 'system'],
    default: 'npm',
  },
  files: [String],
}, {
  timestamps: true,
});

dependencySchema.index({ repositoryId: 1 });

const Dependency = mongoose.model('Dependency', dependencySchema);
export default Dependency;
