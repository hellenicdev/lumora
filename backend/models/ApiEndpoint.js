import mongoose from 'mongoose';

const apiEndpointSchema = new mongoose.Schema({
  repositoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true,
  },
  method: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    required: true,
  },
  path: { type: String, required: true },
  file: String,
  function: String,
  middleware: [String],
  description: String,
}, {
  timestamps: true,
});

apiEndpointSchema.index({ repositoryId: 1 });
apiEndpointSchema.index({ repositoryId: 1, method: 1, path: 1 });

const ApiEndpoint = mongoose.model('ApiEndpoint', apiEndpointSchema);
export default ApiEndpoint;
