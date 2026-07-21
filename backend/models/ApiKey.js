import mongoose from 'mongoose';

const apiKeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
  },
  name: { type: String, required: true },
  hashedKey: { type: String, required: true, unique: true },
  permissions: [String],
  lastUsed: Date,
}, {
  timestamps: true,
});

apiKeySchema.index({ userId: 1 });
apiKeySchema.index({ hashedKey: 1 });

const ApiKey = mongoose.model('ApiKey', apiKeySchema);
export default ApiKey;
