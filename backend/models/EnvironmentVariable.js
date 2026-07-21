import mongoose from 'mongoose';

const environmentVariableSchema = new mongoose.Schema({
  repositoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true,
  },
  name: { type: String, required: true },
  files: [String],
  purpose: String,
  isSecure: { type: Boolean, default: false },
}, {
  timestamps: true,
});

environmentVariableSchema.index({ repositoryId: 1 });

const EnvironmentVariable = mongoose.model('EnvironmentVariable', environmentVariableSchema);
export default EnvironmentVariable;
